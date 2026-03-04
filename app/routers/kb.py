from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from app.db import get_supabase
from app.models.kb import KBEntryCreate, KBEntryUpdate, KBEntryRead, KBEntryList

router = APIRouter(prefix="/kb", tags=["Knowledge Base"])


@router.get("/", response_model=KBEntryList)
def list_entries(
    category: Optional[str] = Query(None, description="Filter by category"),
    source: Optional[str] = Query(None, description="Filter by source"),
    limit: int = Query(50, ge=1, le=500, description="Max entries to return"),
    offset: int = Query(0, ge=0, description="Offset for pagination"),
):
    """List KB entries with optional filtering and pagination."""
    sb = get_supabase()
    query = sb.table("kb_entries").select("*", count="exact")

    if category:
        query = query.eq("category", category)
    if source:
        query = query.eq("source", source)

    query = query.order("created_at", desc=True).range(offset, offset + limit - 1)
    result = query.execute()

    return KBEntryList(data=result.data, count=result.count or len(result.data))


@router.get("/{entry_id}", response_model=KBEntryRead)
def get_entry(entry_id: int):
    """Get a single KB entry by ID."""
    sb = get_supabase()
    result = sb.table("kb_entries").select("*").eq("id", entry_id).execute()

    if not result.data:
        raise HTTPException(status_code=404, detail=f"KB entry {entry_id} not found")

    return result.data[0]


@router.post("/", response_model=KBEntryRead, status_code=201)
def create_entry(entry: KBEntryCreate):
    """Create a new KB entry."""
    sb = get_supabase()
    result = sb.table("kb_entries").insert(entry.model_dump()).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create KB entry")

    return result.data[0]


@router.patch("/{entry_id}", response_model=KBEntryRead)
def update_entry(entry_id: int, entry: KBEntryUpdate):
    """Update a KB entry (partial update)."""
    sb = get_supabase()

    # Only send fields that were explicitly provided
    update_data = entry.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    result = (
        sb.table("kb_entries")
        .update(update_data)
        .eq("id", entry_id)
        .execute()
    )

    if not result.data:
        raise HTTPException(status_code=404, detail=f"KB entry {entry_id} not found")

    return result.data[0]


@router.delete("/{entry_id}", status_code=204)
def delete_entry(entry_id: int):
    """Delete a KB entry."""
    sb = get_supabase()
    result = sb.table("kb_entries").delete().eq("id", entry_id).execute()

    if not result.data:
        raise HTTPException(status_code=404, detail=f"KB entry {entry_id} not found")

    return None
