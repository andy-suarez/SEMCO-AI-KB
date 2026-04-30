"""JWT verification for Supabase-issued tokens.

Supabase projects sign auth tokens with asymmetric keys (ES256 by default,
sometimes RS256). The public keys are published at the project's JWKS
endpoint; we fetch them on first use and PyJWT caches them for an hour.
"""

from dataclasses import dataclass
from functools import lru_cache
from typing import Optional

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import PyJWKClient

from app.config import get_settings

bearer_scheme = HTTPBearer(auto_error=True)


@dataclass
class AuthUser:
    user_id: str
    email: Optional[str]
    role: str


@lru_cache
def _get_jwks_client() -> PyJWKClient:
    settings = get_settings()
    if not settings.supabase_url:
        raise RuntimeError("SUPABASE_URL not set; cannot build JWKS URL")
    # Supabase publishes auth signing keys here.
    return PyJWKClient(f"{settings.supabase_url}/auth/v1/.well-known/jwks.json")


def verify_jwt(
    creds: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> AuthUser:
    """
    Verify a Supabase-issued JWT against the project's published JWKS.
    Returns the authenticated user. Raises 401 on invalid/expired tokens,
    or 500 if JWKS fetch fails.
    """
    try:
        jwks_client = _get_jwks_client()
        signing_key = jwks_client.get_signing_key_from_jwt(creds.credentials)
        payload = jwt.decode(
            creds.credentials,
            signing_key.key,
            algorithms=["ES256", "RS256"],
            audience="authenticated",
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {e}")
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"JWT verification error: {e}",
        )

    return AuthUser(
        user_id=payload.get("sub", ""),
        email=payload.get("email"),
        role=payload.get("role", "authenticated"),
    )
