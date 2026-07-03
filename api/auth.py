"""
auth.py — JWT authentication for ThreatScope API
Person 2 owns this file.

Responsibilities:
- Verify Supabase JWT tokens on protected endpoints
- Reject requests without a valid token
"""

import os
import logging
import jwt
from fastapi import HTTPException, Security
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

logger = logging.getLogger(__name__)

security = HTTPBearer()

SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET", "").strip()


def verify_token(credentials: HTTPAuthorizationCredentials = Security(security)):
    """
    Verifies the JWT token sent by the dashboard.
    Raises 401 if the token is missing or invalid.
    """
    token = credentials.credentials

    if not SUPABASE_JWT_SECRET:
        logger.warning("SUPABASE_JWT_SECRET not set — skipping auth (dev mode)")
        return {}

    try:
        payload = jwt.decode(
            token,
            SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            audience="authenticated"
        )
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {e}")
