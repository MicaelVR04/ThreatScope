"""
auth.py — JWT authentication for ThreatScope API
Person 2 owns this file.

Responsibilities:
- Verify Supabase JWT tokens on protected endpoints
- Reject requests without a valid token
"""

import os
import logging
import hmac
import jwt
from functools import lru_cache
from pathlib import Path
from typing import Optional
from uuid import UUID
from dotenv import load_dotenv
from fastapi import HTTPException, Request, Security
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import PyJWKClient
from jwt.exceptions import PyJWKClientError

logger = logging.getLogger(__name__)

security = HTTPBearer(auto_error=False)

load_dotenv(Path(__file__).resolve().parents[1] / ".env")


def _allow_insecure_local_dev() -> bool:
    """Allow unauthenticated local smoke tests only when explicitly enabled."""
    return os.getenv("ALLOW_INSECURE_LOCAL_DEV", "false").strip().lower() == "true"


def _jwt_secret() -> str:
    return os.getenv("SUPABASE_JWT_SECRET", "").strip()


def _supabase_url() -> str:
    return os.getenv("SUPABASE_URL", "").strip().rstrip("/")


@lru_cache(maxsize=4)
def _jwks_client(supabase_url: str):
    return PyJWKClient(f"{supabase_url}/auth/v1/.well-known/jwks.json")


def _validated_claims(payload: dict) -> dict:
    subject = payload.get("sub", "")
    try:
        payload["sub"] = str(UUID(subject))
    except (TypeError, ValueError) as exc:
        raise HTTPException(status_code=401, detail="Invalid authorization subject") from exc
    return payload


def decode_dashboard_token(token: str) -> dict:
    """Validate a dashboard access token for HTTP or WebSocket requests."""
    if _allow_insecure_local_dev():
        logger.warning("Dashboard auth bypassed because ALLOW_INSECURE_LOCAL_DEV=true")
        return {"sub": "00000000-0000-4000-8000-000000000001"}

    if not token:
        raise HTTPException(status_code=401, detail="Missing authorization token")

    try:
        algorithm = jwt.get_unverified_header(token).get("alg")
        if algorithm == "HS256":
            secret = _jwt_secret()
            supabase_url = _supabase_url()
            if not secret:
                raise HTTPException(
                    status_code=503,
                    detail="SUPABASE_JWT_SECRET is required for legacy HS256 tokens",
                )
            if not supabase_url:
                raise HTTPException(
                    status_code=503,
                    detail="SUPABASE_URL is required for issuer validation",
                )
            return _validated_claims(jwt.decode(
                token,
                secret,
                algorithms=["HS256"],
                audience="authenticated",
                issuer=f"{supabase_url}/auth/v1",
            ))

        if algorithm in {"ES256", "RS256"}:
            supabase_url = _supabase_url()
            if not supabase_url:
                raise HTTPException(
                    status_code=503,
                    detail="SUPABASE_URL is required for asymmetric JWT verification",
                )
            jwks = _jwks_client(supabase_url)
            signing_key = jwks.get_signing_key_from_jwt(token)
            return _validated_claims(jwt.decode(
                token,
                signing_key.key,
                algorithms=[algorithm],
                audience="authenticated",
                issuer=f"{supabase_url}/auth/v1",
            ))

        raise HTTPException(status_code=401, detail="Unsupported JWT signing algorithm")
    except jwt.ExpiredSignatureError as exc:
        raise HTTPException(status_code=401, detail="Token expired") from exc
    except HTTPException:
        raise
    except PyJWKClientError as exc:
        raise HTTPException(status_code=503, detail="Unable to verify Supabase JWT signing key") from exc
    except jwt.InvalidTokenError as exc:
        raise HTTPException(status_code=401, detail="Invalid authorization token") from exc


def verify_token(credentials: Optional[HTTPAuthorizationCredentials] = Security(security)):
    """
    Verifies the JWT token sent by the dashboard.
    Raises 401 if the token is missing or invalid.
    """
    if credentials is None:
        if _allow_insecure_local_dev():
            logger.warning("Dashboard auth bypassed because ALLOW_INSECURE_LOCAL_DEV=true")
            return {"sub": "00000000-0000-4000-8000-000000000001"}
        raise HTTPException(status_code=401, detail="Missing authorization token")

    return decode_dashboard_token(credentials.credentials)


def verify_engine_key(request: Request):
    """Authorize engine ingestion and demo reset without exposing a user JWT."""
    expected_key = os.getenv("ENGINE_API_KEY", "").strip()
    if not expected_key:
        if _allow_insecure_local_dev():
            logger.warning("Engine auth bypassed because ALLOW_INSECURE_LOCAL_DEV=true")
            return
        raise HTTPException(status_code=503, detail="Engine authentication is not configured on this server")

    provided_key = request.headers.get("X-Engine-Key", "")
    if not hmac.compare_digest(provided_key, expected_key):
        raise HTTPException(status_code=401, detail="Invalid engine key")
