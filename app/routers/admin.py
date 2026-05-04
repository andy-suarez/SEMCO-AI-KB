"""Admin-only endpoints for managing user permissions.

Lists every user from auth.users joined with their permission row (or
defaults if no row exists), and lets an admin toggle any of the five
flags via PATCH. Self-unadmin is blocked so an admin can't lock
themselves out.
"""

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.auth import AuthUser, require_admin
from app.db import get_supabase
from app.services.permissions import UserPermissions

router = APIRouter(prefix="/admin", tags=["Admin"])


class UserPermissionsRow(BaseModel):
    user_id: str
    email: Optional[str]
    can_delete_kb: bool
    can_sync_lyro: bool
    can_use_calculator: bool
    can_see_prices: bool
    is_admin: bool
    created_at: Optional[str] = None
    last_sign_in_at: Optional[str] = None


class PermissionPatch(BaseModel):
    can_delete_kb: Optional[bool] = None
    can_sync_lyro: Optional[bool] = None
    can_use_calculator: Optional[bool] = None
    can_see_prices: Optional[bool] = None
    is_admin: Optional[bool] = None


@router.get("/users", response_model=List[UserPermissionsRow])
def list_users(_admin: AuthUser = Depends(require_admin)) -> List[UserPermissionsRow]:
    """List every Supabase auth user with their current permission flags."""
    sb = get_supabase()

    auth_users = sb.auth.admin.list_users()
    perms_rows = sb.table("user_permissions").select("*").execute().data or []
    perms_by_id = {row["user_id"]: row for row in perms_rows}

    defaults = UserPermissions().to_dict()
    out: List[UserPermissionsRow] = []

    for au in auth_users:
        row = perms_by_id.get(au.id, {})
        out.append(
            UserPermissionsRow(
                user_id=au.id,
                email=au.email,
                can_delete_kb=bool(row.get("can_delete_kb", defaults["can_delete_kb"])),
                can_sync_lyro=bool(row.get("can_sync_lyro", defaults["can_sync_lyro"])),
                can_use_calculator=bool(
                    row.get("can_use_calculator", defaults["can_use_calculator"])
                ),
                can_see_prices=bool(row.get("can_see_prices", defaults["can_see_prices"])),
                is_admin=bool(row.get("is_admin", defaults["is_admin"])),
                created_at=str(au.created_at) if getattr(au, "created_at", None) else None,
                last_sign_in_at=(
                    str(au.last_sign_in_at)
                    if getattr(au, "last_sign_in_at", None)
                    else None
                ),
            )
        )

    out.sort(key=lambda r: (r.email or "").lower())
    return out


@router.patch("/users/{user_id}/permissions", response_model=UserPermissionsRow)
def update_permissions(
    user_id: str,
    body: PermissionPatch,
    admin: AuthUser = Depends(require_admin),
) -> UserPermissionsRow:
    """Upsert permission flags for a user. Admins can flip anything except
    their own is_admin."""
    update_data = {k: v for k, v in body.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    if user_id == admin.user_id and update_data.get("is_admin") is False:
        raise HTTPException(
            status_code=400,
            detail="You can't remove your own admin access. Have another admin do it.",
        )

    sb = get_supabase()
    update_data["user_id"] = user_id
    result = (
        sb.table("user_permissions")
        .upsert(update_data, on_conflict="user_id")
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to update permissions")

    # Re-fetch the user's email for the response.
    auth_users = sb.auth.admin.list_users()
    user = next((u for u in auth_users if u.id == user_id), None)
    row = result.data[0]
    return UserPermissionsRow(
        user_id=user_id,
        email=user.email if user else None,
        can_delete_kb=bool(row.get("can_delete_kb", False)),
        can_sync_lyro=bool(row.get("can_sync_lyro", False)),
        can_use_calculator=bool(row.get("can_use_calculator", True)),
        can_see_prices=bool(row.get("can_see_prices", True)),
        is_admin=bool(row.get("is_admin", False)),
        created_at=str(user.created_at) if user and getattr(user, "created_at", None) else None,
        last_sign_in_at=(
            str(user.last_sign_in_at)
            if user and getattr(user, "last_sign_in_at", None)
            else None
        ),
    )
