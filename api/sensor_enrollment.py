"""Secure one-time enrollment and per-sensor credential verification."""

import hashlib
import hmac
import os
import secrets
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, Request

from auth import verify_engine_key
from database import (
    consume_sensor_enrollment,
    create_sensor_enrollment,
    get_owned_sensor,
    get_sensor_credential,
    list_sensors,
    mark_sensor_seen,
    revoke_sensor,
)
from sensor_manager import list_sensor_statuses


TOKEN_PREFIX = "ts1"


def _now():
    return datetime.now(timezone.utc)


def _digest(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def _ttl_seconds() -> int:
    configured = int(os.getenv("SENSOR_ENROLLMENT_TTL_SECONDS", "600"))
    return max(300, min(configured, 1800))


def _max_sensors_per_user() -> int:
    configured = int(os.getenv("SENSOR_MAX_PER_USER", "10"))
    return max(1, min(configured, 50))


def create_code(owner_id: str) -> dict:
    """Creates a high-entropy enrollment code that is returned only once."""
    active_count = sum(
        1 for sensor in list_sensors(owner_id) if not sensor.get("revoked_at")
    )
    if active_count >= _max_sensors_per_user():
        raise HTTPException(
            status_code=409,
            detail="This account has reached its active sensor limit.",
        )
    now = _now()
    code = secrets.token_urlsafe(24)
    expires_at = now + timedelta(seconds=_ttl_seconds())
    create_sensor_enrollment({
        "id": str(uuid.uuid4()),
        "owner_id": owner_id,
        "code_hash": _digest(code),
        "expires_at": expires_at.isoformat(),
        "used_at": None,
        "created_at": now.isoformat(),
    })
    return {
        "code": code,
        "expires_at": expires_at.isoformat(),
        "expires_in_seconds": _ttl_seconds(),
    }


def exchange_code(code: str, name: str, platform: str, version: str) -> dict:
    """Consumes an enrollment code and returns a new credential exactly once."""
    sensor_id = str(uuid.uuid4())
    secret = secrets.token_urlsafe(32)
    token = f"{TOKEN_PREFIX}.{sensor_id}.{secret}"
    now = _now().isoformat()
    sensor = {
        "id": sensor_id,
        "name": name,
        "platform": platform,
        "version": version,
        "token_hash": _digest(token),
        "created_at": now,
    }
    consumed = consume_sensor_enrollment(
        _digest(code),
        sensor,
        max_sensors=_max_sensors_per_user(),
    )
    if not consumed:
        raise HTTPException(
            status_code=400,
            detail="This installation code is invalid, expired, or has already been used.",
        )
    return {
        "sensor_id": sensor_id,
        "sensor_token": token,
    }


def authenticate_sensor_token(token: str) -> dict:
    """Validates a sensor bearer credential without exposing lookup details."""
    parts = token.split(".")
    if len(parts) != 3 or parts[0] != TOKEN_PREFIX:
        raise HTTPException(status_code=401, detail="Invalid sensor credential")
    try:
        sensor_id = str(uuid.UUID(parts[1]))
    except ValueError as exc:
        raise HTTPException(status_code=401, detail="Invalid sensor credential") from exc

    credential = get_sensor_credential(sensor_id)
    if (
        not credential
        or credential.get("revoked_at")
        or not hmac.compare_digest(credential.get("token_hash", ""), _digest(token))
    ):
        raise HTTPException(status_code=401, detail="Invalid sensor credential")
    return {
        "sensor_id": credential["id"],
        "owner_id": credential["owner_id"],
        "auth_type": "sensor",
    }


def verify_sensor_request(request: Request) -> dict:
    """FastAPI dependency for endpoints used by installed sensors."""
    token = request.headers.get("X-Sensor-Token", "").strip()
    if not token:
        raise HTTPException(status_code=401, detail="Missing sensor credential")
    return authenticate_sensor_token(token)


def verify_sensor_or_engine(request: Request) -> dict:
    """Supports enrolled sensors and the separately managed demo-engine key."""
    sensor_token = request.headers.get("X-Sensor-Token", "").strip()
    if sensor_token:
        return authenticate_sensor_token(sensor_token)

    verify_engine_key(request)
    owner_id = os.getenv("SENSOR_OWNER_USER_ID", "").strip()
    if not owner_id and os.getenv("ALLOW_INSECURE_LOCAL_DEV", "false").lower() != "true":
        raise HTTPException(
            status_code=503,
            detail="SENSOR_OWNER_USER_ID is required for secure alert ingestion",
        )
    return {
        "sensor_id": None,
        "owner_id": owner_id or None,
        "auth_type": "engine",
    }


def record_sensor_seen(principal: dict, version: str = None):
    if principal.get("auth_type") == "sensor":
        mark_sensor_seen(principal["sensor_id"], version=version)


def sensors_for_owner(owner_id: str):
    return list_sensor_statuses(owner_id)


def revoke_owned_sensor(sensor_id: str, owner_id: str) -> bool:
    return revoke_sensor(sensor_id, owner_id=owner_id)


def revoke_current_sensor(principal: dict) -> bool:
    if principal.get("auth_type") != "sensor":
        return False
    return revoke_sensor(principal["sensor_id"])


def current_sensor_readiness(principal: dict) -> dict:
    """Returns heartbeat readiness only for the calling sensor credential."""
    if principal.get("auth_type") != "sensor":
        return {"ready": False}
    sensor = get_owned_sensor(principal["sensor_id"], principal["owner_id"])
    if not sensor:
        return {"ready": False}
    return {
        "sensor_id": sensor["id"],
        "ready": bool(sensor.get("last_seen_at")),
        "last_seen_at": sensor.get("last_seen_at"),
        "version": sensor.get("version"),
    }
