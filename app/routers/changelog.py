"""KB Entries changelog (audit log).

A Postgres trigger writes a row to kb_changelog on every kb_entries
INSERT/UPDATE/DELETE. This endpoint surfaces those rows to admins,
joined with auth.users to expose actor emails for display.
"""

from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel

from app.auth import AuthUser, require_admin
from app.db import get_supabase

router = APIRouter(prefix="/changelog", tags=["Changelog"])


class ChangelogEntry(BaseModel):
    id: int
    kb_entry_id: Optional[int]
    action: str
    actor_user_id: Optional[str]
    actor_email: Optional[str]
    snapshot: Optional[dict]
    changed_fields: Optional[List[str]]
    occurred_at: str


class ChangelogPage(BaseModel):
    data: List[ChangelogEntry]
    count: int


@router.get("/", response_model=ChangelogPage)
def list_changelog(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    _admin: AuthUser = Depends(require_admin),
) -> ChangelogPage:
    """List KB changelog entries, newest first. Admin-only."""
    sb = get_supabase()

    result = (
        sb.table("kb_changelog")
        .select("*", count="exact")
        .order("occurred_at", desc=True)
        .range(offset, offset + limit - 1)
        .execute()
    )
    rows = result.data or []

    # Resolve actor emails via the auth admin API, batched once per page.
    actor_ids = {r["actor_user_id"] for r in rows if r.get("actor_user_id")}
    email_by_id: "dict[str, Optional[str]]" = {}
    if actor_ids:
        try:
            auth_users = sb.auth.admin.list_users()
            email_by_id = {
                u.id: u.email for u in auth_users if u.id in actor_ids
            }
        except Exception:
            # Non-fatal: changelog still renders without emails.
            email_by_id = {}

    return ChangelogPage(
        data=[
            ChangelogEntry(
                id=r["id"],
                kb_entry_id=r.get("kb_entry_id"),
                action=r["action"],
                actor_user_id=r.get("actor_user_id"),
                actor_email=email_by_id.get(r.get("actor_user_id") or ""),
                snapshot=r.get("snapshot"),
                changed_fields=r.get("changed_fields"),
                occurred_at=r["occurred_at"],
            )
            for r in rows
        ],
        count=result.count or len(rows),
    )
