"""Admin-side endpoints for the unanswered-questions queue.

The list view is read directly from Supabase by the React app (RLS-gated),
so we don't expose a GET here. Promote/Dismiss flow through FastAPI so we
get a proper handled_by audit trail keyed on the JWT's email claim.
"""

from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.auth import AuthUser, verify_jwt
from app.db import get_supabase

router = APIRouter(
    prefix="/unanswered",
    tags=["Unanswered"],
    dependencies=[Depends(verify_jwt)],
)


class PromoteRequest(BaseModel):
    """Payload for promoting an unanswered question to a KB entry."""

    question: str = Field(..., min_length=1)
    answer: str = Field(..., min_length=1)
    category: str = ""
    products: List[str] = Field(default_factory=list)
    substrates: List[str] = Field(default_factory=list)
    source: str = "Tidio Unanswered"


def _utcnow_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


@router.post("/{unanswered_id}/promote")
def promote_unanswered(
    unanswered_id: int,
    body: PromoteRequest,
    user: AuthUser = Depends(verify_jwt),
) -> dict:
    """
    Create a kb_entries row from a pending unanswered question, and mark
    the unanswered row as promoted with a back-pointer for audit.
    """
    sb = get_supabase()

    existing = (
        sb.table("unanswered_questions")
        .select("status")
        .eq("id", unanswered_id)
        .limit(1)
        .execute()
    )
    if not existing.data:
        raise HTTPException(status_code=404, detail="Unanswered question not found")
    if existing.data[0]["status"] != "pending":
        raise HTTPException(
            status_code=400,
            detail=f"Already handled (status={existing.data[0]['status']})",
        )

    kb_insert = sb.table("kb_entries").insert(body.model_dump()).execute()
    if not kb_insert.data:
        raise HTTPException(status_code=500, detail="Failed to create KB entry")
    kb_id = kb_insert.data[0]["id"]

    update = (
        sb.table("unanswered_questions")
        .update(
            {
                "status": "promoted",
                "promoted_kb_entry_id": kb_id,
                "handled_at": _utcnow_iso(),
                "handled_by": user.email,
            }
        )
        .eq("id", unanswered_id)
        .execute()
    )
    if not update.data:
        # KB row was created but the unanswered status update failed —
        # surface the inconsistency so it can be fixed manually.
        raise HTTPException(
            status_code=500,
            detail=f"KB entry {kb_id} created but unanswered_questions row update failed",
        )

    return {"unanswered_id": unanswered_id, "kb_entry_id": kb_id, "status": "promoted"}


@router.post("/{unanswered_id}/dismiss")
def dismiss_unanswered(
    unanswered_id: int,
    user: AuthUser = Depends(verify_jwt),
) -> dict:
    """Mark a pending unanswered question as dismissed (no KB write)."""
    sb = get_supabase()

    existing = (
        sb.table("unanswered_questions")
        .select("status")
        .eq("id", unanswered_id)
        .limit(1)
        .execute()
    )
    if not existing.data:
        raise HTTPException(status_code=404, detail="Unanswered question not found")
    if existing.data[0]["status"] != "pending":
        raise HTTPException(
            status_code=400,
            detail=f"Already handled (status={existing.data[0]['status']})",
        )

    sb.table("unanswered_questions").update(
        {
            "status": "dismissed",
            "handled_at": _utcnow_iso(),
            "handled_by": user.email,
        }
    ).eq("id", unanswered_id).execute()

    return {"unanswered_id": unanswered_id, "status": "dismissed"}
