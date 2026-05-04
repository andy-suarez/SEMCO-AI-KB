"""Per-user "me" endpoints — currently just permissions."""

from fastapi import APIRouter, Depends

from app.auth import AuthUser, verify_jwt
from app.services.permissions import get_user_permissions

router = APIRouter(prefix="/me", tags=["Me"], dependencies=[Depends(verify_jwt)])


@router.get("/permissions")
def my_permissions(user: AuthUser = Depends(verify_jwt)) -> dict:
    """Returns the calling user's permission flags (defaults if no row)."""
    perms = get_user_permissions(user.user_id)
    return {
        "user_id": user.user_id,
        "email": user.email,
        **perms.to_dict(),
    }
