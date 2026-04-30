"""JWT verification for Supabase-issued tokens."""

from dataclasses import dataclass
from typing import Optional

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.config import get_settings

bearer_scheme = HTTPBearer(auto_error=True)


@dataclass
class AuthUser:
    user_id: str
    email: Optional[str]
    role: str


def verify_jwt(
    creds: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> AuthUser:
    """
    Verify a Supabase-issued JWT (HS256, signed with SUPABASE_JWT_SECRET).
    Returns the authenticated user. Raises 401 on invalid/expired tokens,
    or 500 if the server isn't configured with a JWT secret.
    """
    settings = get_settings()
    if not settings.supabase_jwt_secret:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Server misconfigured: SUPABASE_JWT_SECRET not set",
        )

    try:
        payload = jwt.decode(
            creds.credentials,
            settings.supabase_jwt_secret,
            algorithms=["HS256"],
            audience="authenticated",
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {e}")

    return AuthUser(
        user_id=payload.get("sub", ""),
        email=payload.get("email"),
        role=payload.get("role", "authenticated"),
    )
