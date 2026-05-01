"""Sync KB entries from Supabase to Lyro via Tidio's OpenAPI."""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from app.auth import AuthUser, verify_jwt
from app.db import get_supabase
from app.services.tidio import SyncEntry, sync_entries_to_lyro

router = APIRouter(
    prefix="/sync",
    tags=["Sync"],
    dependencies=[Depends(verify_jwt)],
)


@router.post("/lyro")
async def sync_lyro(user: AuthUser = Depends(verify_jwt)) -> dict:
    """
    Push every kb_entries row to Lyro via PUT /lyro/data-sources/website.
    Idempotent — Lyro dedupes by URL, so re-running updates existing
    entries instead of duplicating.

    Records the run in sync_log for shared visibility across team members.
    """
    sb = get_supabase()

    # Insert a started row so the UI can show "in progress" if we later
    # split this into a background job. Right now the request blocks
    # until the run is done.
    started_at = datetime.now(timezone.utc).isoformat()
    log_insert = (
        sb.table("sync_log")
        .insert(
            {
                "target": "lyro",
                "started_at": started_at,
                "triggered_by": user.email,
            }
        )
        .execute()
    )
    if not log_insert.data:
        raise HTTPException(status_code=500, detail="Failed to start sync log entry")
    log_id = log_insert.data[0]["id"]

    try:
        # Fetch all entries. 148 rows fits comfortably in one query; we
        # paginate defensively in case the KB grows past the default page.
        from typing import List as _List
        entries: _List[SyncEntry] = []
        offset = 0
        chunk_size = 1000
        while True:
            chunk = (
                sb.table("kb_entries")
                .select("id, question, answer, category, products, substrates")
                .order("id")
                .range(offset, offset + chunk_size - 1)
                .execute()
            )
            rows = chunk.data or []
            if not rows:
                break
            for row in rows:
                entries.append(
                    SyncEntry(
                        id=row["id"],
                        question=row["question"],
                        answer=row["answer"],
                        category=row.get("category") or "",
                        products=row.get("products") or [],
                        substrates=row.get("substrates") or [],
                    )
                )
            if len(rows) < chunk_size:
                break
            offset += chunk_size

        result = await sync_entries_to_lyro(entries)

        error_summary = None
        if result.failed > 0:
            sample = result.failures[0]
            extra = f" (+{result.failed - 1} more)" if result.failed > 1 else ""
            error_summary = f"entry {sample.entry_id}: {sample.detail}{extra}"[:500]

        sb.table("sync_log").update(
            {
                "finished_at": datetime.now(timezone.utc).isoformat(),
                "total_entries": len(entries),
                "succeeded": result.succeeded,
                "failed": result.failed,
                "error_summary": error_summary,
            }
        ).eq("id", log_id).execute()

        return {
            "log_id": log_id,
            "total": len(entries),
            "succeeded": result.succeeded,
            "failed": result.failed,
            "failures": [
                {"entry_id": f.entry_id, "status": f.status, "detail": f.detail}
                for f in result.failures[:10]
            ],
        }

    except Exception as e:
        sb.table("sync_log").update(
            {
                "finished_at": datetime.now(timezone.utc).isoformat(),
                "failed": 1,
                "error_summary": f"sync errored: {str(e)[:400]}",
            }
        ).eq("id", log_id).execute()
        raise
