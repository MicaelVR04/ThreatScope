"""Owner-scoped sensor heartbeat and monitoring control."""

import os
from datetime import datetime, timezone

from database import (
    get_owned_sensor,
    list_sensors,
    set_sensor_monitoring_state,
    update_sensor_heartbeat,
)


HEARTBEAT_TIMEOUT_SECONDS = int(os.getenv("SENSOR_HEARTBEAT_TIMEOUT_SECONDS", "20"))
HEARTBEAT_COMMAND_SECONDS = int(os.getenv("SENSOR_HEARTBEAT_COMMAND_SECONDS", "5"))


class SensorNotFoundError(RuntimeError):
    pass


def _parse_datetime(value):
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
    except (TypeError, ValueError):
        return None


def _public_status(sensor):
    if not sensor:
        return {
            "online": False,
            "desired_monitoring": False,
            "monitoring": False,
            "sensor_id": None,
            "name": None,
            "interface": None,
            "packet_count": 0,
            "last_heartbeat_at": None,
            "last_error": None,
            "version": None,
        }

    last_seen = _parse_datetime(sensor.get("last_seen_at"))
    online = bool(
        last_seen
        and (datetime.now(timezone.utc) - last_seen).total_seconds()
        <= HEARTBEAT_TIMEOUT_SECONDS
    )
    return {
        "online": online,
        "desired_monitoring": bool(sensor.get("desired_monitoring")),
        "monitoring": bool(sensor.get("monitoring")) if online else False,
        "sensor_id": sensor["id"],
        "name": sensor.get("name"),
        "interface": sensor.get("interface"),
        "packet_count": max(0, int(sensor.get("packet_count") or 0)),
        "last_heartbeat_at": sensor.get("last_seen_at"),
        "last_error": sensor.get("last_error"),
        "version": sensor.get("version"),
    }


def resolve_owned_sensor(owner_id: str, sensor_id: str = None):
    """Resolves one active sensor without revealing whether another owner has it."""
    if sensor_id:
        return get_owned_sensor(sensor_id, owner_id)
    active = [sensor for sensor in list_sensors(owner_id) if not sensor.get("revoked_at")]
    if not active:
        return None
    active.sort(
        key=lambda sensor: sensor.get("last_seen_at") or sensor.get("created_at") or "",
        reverse=True,
    )
    return active[0]


def get_sensor_status(owner_id: str, sensor_id: str = None):
    return _public_status(resolve_owned_sensor(owner_id, sensor_id))


def list_sensor_statuses(owner_id: str):
    return [
        {**sensor, **_public_status(sensor)}
        for sensor in list_sensors(owner_id)
    ]


def record_heartbeat(payload, principal: dict):
    """Updates only the sensor authenticated by its per-device credential."""
    sensor_id = principal["sensor_id"]
    owner_id = principal["owner_id"]
    if str(payload.sensor_id) != sensor_id:
        raise SensorNotFoundError("Sensor identity does not match credential")
    sensor = update_sensor_heartbeat(
        sensor_id,
        owner_id,
        payload.model_dump(),
    )
    if not sensor:
        raise SensorNotFoundError("Sensor credential is no longer active")
    return {
        "monitoring_enabled": bool(sensor.get("desired_monitoring")),
        "heartbeat_interval_seconds": HEARTBEAT_COMMAND_SECONDS,
    }


def set_monitoring(owner_id: str, sensor_id: str, enabled: bool):
    sensor = set_sensor_monitoring_state(sensor_id, owner_id, enabled)
    if not sensor:
        raise SensorNotFoundError("Sensor not found")
    return _public_status(sensor)


def restore_sensor_state():
    """Sensor state is persisted directly on each sensor record."""
    return None
