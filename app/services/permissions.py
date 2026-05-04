"""Per-user permission lookups.

Permissions live in the user_permissions table. Missing row = defaults.
The frontend fetches its own row directly via Supabase + RLS; the
backend fetches via the service-role client to enforce on protected
endpoints.
"""

from dataclasses import dataclass

from app.db import get_supabase


@dataclass
class UserPermissions:
    can_delete_kb: bool = False
    can_sync_lyro: bool = False
    can_use_calculator: bool = True
    can_see_prices: bool = True
    is_admin: bool = False

    def to_dict(self) -> "dict[str, bool]":
        return {
            "can_delete_kb": self.can_delete_kb,
            "can_sync_lyro": self.can_sync_lyro,
            "can_use_calculator": self.can_use_calculator,
            "can_see_prices": self.can_see_prices,
            "is_admin": self.is_admin,
        }


def get_user_permissions(user_id: str) -> UserPermissions:
    """
    Fetch a user's permissions. If no row exists in user_permissions,
    return the defaults (no destructive actions, full calculator access).
    """
    if not user_id:
        return UserPermissions()

    sb = get_supabase()
    result = (
        sb.table("user_permissions")
        .select("*")
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    rows = result.data or []
    if not rows:
        return UserPermissions()

    row = rows[0]
    return UserPermissions(
        can_delete_kb=bool(row.get("can_delete_kb", False)),
        can_sync_lyro=bool(row.get("can_sync_lyro", False)),
        can_use_calculator=bool(row.get("can_use_calculator", True)),
        can_see_prices=bool(row.get("can_see_prices", True)),
        is_admin=bool(row.get("is_admin", False)),
    )
