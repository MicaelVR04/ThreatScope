"""
Tracks the live packet sensor and the monitoring command sent by the dashboard.

The sensor service stays online even when packet capture is paused. It reports a
heartbeat every few seconds and receives the desired monitoring state in the
heartbeat response.
"""

import os
import threading
from datetime import datetime, timezone

from database import get_runtime_state, set_runtime_state

HEARTBEAT_TIMEOUT_SECONDS = int(os.getenv("SENSOR_HEARTBEAT_TIMEOUT_SECONDS", "20"))
HEARTBEAT_COMMAND_SECONDS = int(os.getenv("SENSOR_HEARTBEAT_COMMAND_SECONDS", "5"))
DEFAULT_MONITORING_ENABLED = (
    os.getenv("MONITORING_DEFAULT_ENABLED", "true").strip().lower() == "true"
)
RUNTIME_STATE_KEY = "sensor_config"

_lock = threading.Lock()
_state = {
    "desired_monitoring": DEFAULT_MONITORING_ENABLED,
    "sensor_id": None,
    "interface": None,
    "monitoring": False,
    "packet_count": 0,
    "last_heartbeat_at": None,
    "last_error": None,
    "version": None,
}


def _now():
    return datetime.now(timezone.utc)


def _is_online_locked(now=None):
    last_heartbeat = _state["last_heartbeat_at"]
    if not last_heartbeat:
        return False
    elapsed = ((now or _now()) - last_heartbeat).total_seconds()
    return elapsed <= HEARTBEAT_TIMEOUT_SECONDS


def _status_locked():
    return {
        "online": _is_online_locked(),
        "desired_monitoring": _state["desired_monitoring"],
        "monitoring": _state["monitoring"],
        "sensor_id": _state["sensor_id"],
        "interface": _state["interface"],
        "packet_count": _state["packet_count"],
        "last_heartbeat_at": (
            _state["last_heartbeat_at"].isoformat()
            if _state["last_heartbeat_at"]
            else None
        ),
        "last_error": _state["last_error"],
        "version": _state["version"],
    }


def get_sensor_status():
    with _lock:
        return _status_locked()


def record_heartbeat(payload):
    with _lock:
        _state.update({
            "sensor_id": payload.sensor_id,
            "interface": payload.interface,
            "monitoring": payload.monitoring,
            "packet_count": max(0, payload.packet_count),
            "last_heartbeat_at": _now(),
            "last_error": payload.last_error,
            "version": payload.version,
        })
        return {
            "monitoring_enabled": _state["desired_monitoring"],
            "heartbeat_interval_seconds": HEARTBEAT_COMMAND_SECONDS,
        }


def set_monitoring(enabled):
    with _lock:
        _state["desired_monitoring"] = enabled
        status = _status_locked()
    set_runtime_state(
        RUNTIME_STATE_KEY,
        {"desired_monitoring": bool(enabled)},
    )
    return status


def restore_sensor_state():
    """Restores the operator's monitoring preference after an API restart."""
    persisted = get_runtime_state(RUNTIME_STATE_KEY)
    if not persisted or not isinstance(persisted.get("desired_monitoring"), bool):
        return get_sensor_status()

    with _lock:
        _state["desired_monitoring"] = persisted["desired_monitoring"]
        return _status_locked()


def reset_sensor_state():
    """Test helper that restores a clean, offline sensor state."""
    with _lock:
        _state.update({
            "desired_monitoring": DEFAULT_MONITORING_ENABLED,
            "sensor_id": None,
            "interface": None,
            "monitoring": False,
            "packet_count": 0,
            "last_heartbeat_at": None,
            "last_error": None,
            "version": None,
        })
