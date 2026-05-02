"""Tidio webhook receiver.

Public endpoint (no JWT) — Tidio calls it from outside our auth perimeter.
Protected by HMAC-SHA256 signature verification when TIDIO_WEBHOOK_SECRET
is set.

Currently the only event we act on is `conversation.solved_by_lyro` with
reason `handoff` or `inactive` — that's the signal Lyro couldn't finish
a customer conversation. We fetch the contact's messages, capture the
customer-side text, and write a row to `unanswered_questions` for the
admin UI to drain.
"""

import json
import logging

from fastapi import APIRouter, Header, HTTPException, Request

from app.config import get_settings
from app.db import get_supabase
from app.services.tidio import fetch_contact_messages
from app.services.webhook_signature import verify_tidio_signature

router = APIRouter(prefix="/webhooks", tags=["Webhooks"])
log = logging.getLogger("tidio.webhook")

RELEVANT_LYRO_REASONS = {"handoff", "inactive"}


@router.post("/tidio")
async def tidio_webhook(
    request: Request,
    x_tidio_signature: str = Header(default=""),
) -> dict:
    body = await request.body()

    settings = get_settings()
    if settings.tidio_webhook_secret:
        if not verify_tidio_signature(
            settings.tidio_webhook_secret,
            body,
            x_tidio_signature,
            max_age_seconds=settings.tidio_webhook_max_age_seconds,
        ):
            raise HTTPException(status_code=401, detail="Invalid webhook signature")
    else:
        log.warning(
            "tidio_webhook_secret not set — accepting webhook without signature check"
        )

    try:
        payload = json.loads(body.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        raise HTTPException(status_code=400, detail="Invalid JSON")

    topic = payload.get("topic", "")
    content = payload.get("content") or {}

    # Only act on Lyro can't-finish events. Everything else returns 200
    # so Tidio doesn't retry.
    if topic != "conversation.solved_by_lyro":
        return {"ok": True, "skipped": True, "topic": topic}

    reason = content.get("reason")
    if reason not in RELEVANT_LYRO_REASONS:
        return {"ok": True, "skipped": True, "reason": reason}

    contact_id = content.get("contact_id")
    solved_at = content.get("solved_at")
    if not contact_id:
        return {"ok": True, "skipped": True, "missing": "contact_id"}

    # Pull the conversation so we have the actual customer questions to show
    # reviewers. If this fails we still record the event with empty messages
    # — the conversation_url link to Tidio's panel is the fallback.
    conversation_url = None
    customer_messages: "list[dict]" = []
    try:
        msgs = await fetch_contact_messages(contact_id)
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
        log.exception("failed to fetch contact messages for %s: %s", contact_id, e)

    sb = get_supabase()
    try:
        sb.table("unanswered_questions").insert(
            {
                "tidio_contact_id": contact_id,
                "tidio_solved_at": solved_at,
                "reason": reason,
                "conversation_url": conversation_url,
                "customer_messages": customer_messages,
                "status": "pending",
            }
        ).execute()
    except Exception as e:
        # Unique-violation on (contact_id, solved_at) means we already saw
        # this delivery; treat as success so Tidio stops retrying.
        msg = str(e).lower()
        if "23505" in msg or "duplicate" in msg or "unique" in msg:
            return {"ok": True, "deduped": True}
        log.exception("failed to insert unanswered_questions row: %s", e)
        raise HTTPException(status_code=500, detail="Failed to record event")

    return {"ok": True}
