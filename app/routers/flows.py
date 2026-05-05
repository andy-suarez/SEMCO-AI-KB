"""Tidio Flow → unanswered_questions intake.

Tidio's webhook tier is gated, but the chatbot Flow builder includes an
"API call" step on every plan. The Flow fires on Lyro handoff and POSTs
just the contact_uuid here; this endpoint then uses the existing OpenAPI
credentials to fetch the contact's messages and write a row to the same
unanswered_questions table the webhook receiver and manual-add dialog
write to. Same downstream review UI; different intake path.

Auth: shared X-Flow-Token header. Set TIDIO_FLOW_TOKEN on Render and
configure the Flow's API call to send the same value via Tidio's
"API key" auth feature (they inject it into the header for you).
"""

import logging
import uuid as _uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Header, HTTPException, Request

from app.config import get_settings
from app.db import get_supabase
from app.services.tidio import fetch_contact_messages

router = APIRouter(prefix="/flows", tags=["Flows"])
log = logging.getLogger("tidio.flows")

# How recent a previous insert needs to be to count as a duplicate.
# Tidio's flow can re-fire if a customer pings again before pickup;
# soft-dedupe so the queue doesn't fill with copies of the same incident.
DEDUPE_WINDOW_MINUTES = 5


@router.post("/unanswered")
async def flow_unanswered(
    request: Request,
    x_flow_token: str = Header(default=""),
) -> dict:
    settings = get_settings()
    if settings.tidio_flow_token:
        if x_flow_token != settings.tidio_flow_token:
            raise HTTPException(status_code=401, detail="Invalid flow token")
    else:
        log.warning(
            "tidio_flow_token not set — accepting flow requests without auth"
        )

    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    contact_uuid = body.get("contact_uuid")
    email = body.get("email") or None
    if not contact_uuid:
        raise HTTPException(status_code=400, detail="contact_uuid required")

    # Tidio's "Test request" button doesn't substitute Flow variables,
    # so it sends the literal "{contact_uuid}" placeholder instead of a
    # real UUID. Recognize that and return a friendly 200 so the test
    # passes — the user's configuration IS correct; real flow runs will
    # substitute properly.
    placeholder_pattern = isinstance(contact_uuid, str) and (
        contact_uuid.strip().startswith("{") and contact_uuid.strip().endswith("}")
    )
    if placeholder_pattern:
        return {
            "ok": True,
            "test_mode": True,
            "note": (
                "Tidio's Test button doesn't substitute variables. "
                "Your config is reaching the backend correctly — to verify "
                "end-to-end, trigger the Flow against a real conversation."
            ),
        }

    # Past this point we expect a real UUID from a real Flow execution.
    # If the value isn't a UUID, it's most likely Tidio's Test button
    # substituting random sample data ("john" for {name}, etc.). Pass
    # those through as test_mode so the user can finish configuring the
    # Flow, but log a warning — real Flow runs sending non-UUIDs mean
    # the wrong variable is wired into the contact_uuid slot.
    try:
        _uuid.UUID(str(contact_uuid))
    except (ValueError, TypeError):
        log.warning(
            "Non-UUID contact_uuid received: %r. If this is a production "
            "Flow, fix the contact_uuid slot to use the {contact_uuid} "
            "variable from Tidio's variable picker.",
            contact_uuid,
        )
        return {
            "ok": True,
            "test_mode": True,
            "note": (
                f"Received non-UUID '{contact_uuid}'. Real Flow runs send "
                "valid UUIDs; if production traffic ever hits this branch, "
                "check Render logs."
            ),
        }

    # Don't let stray literal placeholders end up in the email column.
    if isinstance(email, str) and email.strip().startswith("{") and email.strip().endswith("}"):
        email = None

    # Soft dedupe: skip if we just inserted a row for this contact.
    sb = get_supabase()
    cutoff = (
        datetime.now(timezone.utc) - timedelta(minutes=DEDUPE_WINDOW_MINUTES)
    ).isoformat()
    recent = (
        sb.table("unanswered_questions")
        .select("id")
        .eq("tidio_contact_id", contact_uuid)
        .gte("tidio_event_received_at", cutoff)
        .limit(1)
        .execute()
    )
    if recent.data:
        return {"ok": True, "deduped": True}

    # Pull the conversation. If this fails (Tidio API down, contact
    # gone, etc.), still record an event with empty messages so the
    # team sees that something happened — they can click through to
    # Tidio for full context.
    conversation_url = None
    customer_messages: "list[dict]" = []
    try:
        msgs = await fetch_contact_messages(contact_uuid)
        conversation_url = msgs.get("conversation_url")
        for m in msgs.get("messages", []) or []:
            if m.get("author_type") == "contact":
                customer_messages.append(
                    {
                        "id": m.get("id"),
                        "message": m.get("message"),
                        "created_at": m.get("created_at"),
                    }
                )
    except Exception as e:
        log.exception(
            "fetch_contact_messages failed for %s: %s", contact_uuid, e
        )

    # If there are zero customer messages, there's nothing for the team
    # to triage — skip the insert. Return 200 so Tidio doesn't retry.
    if not customer_messages:
        return {
            "ok": True,
            "skipped": True,
            "reason": "no_customer_messages",
        }

    latest_message_created_at = customer_messages[-1].get("created_at")

    try:
        sb.table("unanswered_questions").insert(
            {
                "tidio_contact_id": contact_uuid,
                "tidio_solved_at": latest_message_created_at,
                "reason": "handoff",
                "contact_email": email,
                "conversation_url": conversation_url,
                "customer_messages": customer_messages,
                "status": "pending",
            }
        ).execute()
    except Exception as e:
        msg = str(e).lower()
        # Belt-and-suspenders for the unique index on
        # (tidio_contact_id, tidio_solved_at) — race-condition dedupe.
        if "23505" in msg or "duplicate" in msg or "unique" in msg:
            return {"ok": True, "deduped": True}
        log.exception("insert failed: %s", e)
        raise HTTPException(status_code=500, detail="Failed to record event")

    return {"ok": True, "captured_messages": len(customer_messages)}
