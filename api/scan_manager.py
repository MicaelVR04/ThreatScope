"""Verified network-assessment windows for the ThreatScope sensor."""

import os
import threading
from datetime import datetime, timedelta, timezone
from typing import Optional

from database import get_runtime_state, get_summary, set_runtime_state
from sensor_manager import get_sensor_status

SCAN_WINDOW_SECONDS = int(os.getenv("SCAN_WINDOW_SECONDS", "8"))
DEFAULT_INTERVAL_MINUTES = int(os.getenv("SCAN_INTERVAL_MINUTES", "5"))
ALLOWED_INTERVALS = {5, 10}
RUNTIME_STATE_KEY = "scan_config"

_lock = threading.Lock()
_scan_timer: Optional[threading.Timer] = None
_schedule_timer: Optional[threading.Timer] = None

_state = {
    "enabled": False,
    "interval_minutes": DEFAULT_INTERVAL_MINUTES if DEFAULT_INTERVAL_MINUTES in ALLOWED_INTERVALS else 5,
    "state": "idle",
    "message": "Scheduled assessments are off.",
    "last_started_at": None,
    "last_finished_at": None,
    "next_scan_at": None,
    "baseline_alert_count": 0,
    "baseline_packet_count": 0,
    "packets_analyzed": 0,
    "alerts_detected": 0,
}


class SensorUnavailableError(RuntimeError):
    pass


def _now():
    return datetime.now(timezone.utc)


def _iso(value):
    return value.isoformat() if value else None


def _parse_datetime(value):
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except (TypeError, ValueError):
        return None


def _total_alerts():
    owner_id = os.getenv("SENSOR_OWNER_USER_ID", "").strip() or None
    return get_summary(user_id=owner_id)["total"]


def _status_locked():
    sensor = get_sensor_status()
    return {
        "enabled": _state["enabled"],
        "interval_minutes": _state["interval_minutes"],
        "state": _state["state"],
        "message": _state["message"],
        "last_started_at": _iso(_state["last_started_at"]),
        "last_finished_at": _iso(_state["last_finished_at"]),
        "next_scan_at": _iso(_state["next_scan_at"]),
        "alerts_detected": _state["alerts_detected"],
        "packets_analyzed": _state["packets_analyzed"],
        "sensor": sensor,
    }


def _persistent_state_locked():
    return {
        "enabled": _state["enabled"],
        "interval_minutes": _state["interval_minutes"],
        "state": _state["state"],
        "message": _state["message"],
        "last_started_at": _iso(_state["last_started_at"]),
        "last_finished_at": _iso(_state["last_finished_at"]),
        "packets_analyzed": _state["packets_analyzed"],
        "alerts_detected": _state["alerts_detected"],
    }


def _save_state(payload):
    set_runtime_state(RUNTIME_STATE_KEY, payload)


def get_scan_status():
    with _lock:
        return _status_locked()


def record_detected_alert():
    """Makes a new alert supersede any earlier clear assessment result."""
    with _lock:
        if _state["state"] != "running":
            _state["state"] = "threats_found"
            _state["alerts_detected"] = max(1, _state["alerts_detected"] + 1)
            _state["message"] = (
                "A new threat alert was detected after the latest assessment."
            )
        status = _status_locked()
        persisted = _persistent_state_locked()
    _save_state(persisted)
    return status


def record_alert_history_cleared():
    """Removes stale alert results after a user clears their history."""
    with _lock:
        if _state["state"] != "running":
            _state["state"] = "idle"
            _state["message"] = (
                "Alert history cleared. Run an assessment to confirm current network status."
            )
            _state["alerts_detected"] = 0
            _state["packets_analyzed"] = 0
        status = _status_locked()
        persisted = _persistent_state_locked()
    _save_state(persisted)
    return status


def start_scan():
    global _scan_timer

    sensor = get_sensor_status()
    if not sensor["online"]:
        raise SensorUnavailableError(
            "The network sensor is offline. Install or start the ThreatScope sensor before running an assessment."
        )
    if not sensor["monitoring"]:
        raise SensorUnavailableError(
            "Continuous monitoring is paused. Start monitoring before running an assessment."
        )

    with _lock:
        if _state["state"] == "running":
            return _status_locked()

        if _scan_timer:
            _scan_timer.cancel()

        started_at = _now()
        _state.update({
            "state": "running",
            "message": "Scan started. ThreatScope is watching for new alerts.",
            "last_started_at": started_at,
            "last_finished_at": None,
            "baseline_alert_count": _total_alerts(),
            "baseline_packet_count": sensor["packet_count"],
            "packets_analyzed": 0,
            "alerts_detected": 0,
        })
        _scan_timer = threading.Timer(SCAN_WINDOW_SECONDS, finish_scan)
        _scan_timer.daemon = True
        _scan_timer.start()
        status = _status_locked()
        persisted = _persistent_state_locked()
    _save_state(persisted)
    return status


def finish_scan():
    with _lock:
        sensor = get_sensor_status()
        current_total = _total_alerts()
        detected = max(0, current_total - _state["baseline_alert_count"])
        packets_analyzed = max(0, sensor["packet_count"] - _state["baseline_packet_count"])
        _state["alerts_detected"] = detected
        _state["packets_analyzed"] = packets_analyzed
        _state["last_finished_at"] = _now()

        if not sensor["online"] or not sensor["monitoring"]:
            _state["state"] = "sensor_offline"
            _state["message"] = "Assessment stopped because the network sensor went offline."
        elif packets_analyzed == 0:
            _state["state"] = "no_data"
            _state["message"] = "No network packets were observed. ThreatScope cannot determine whether the network is secure."
        elif detected:
            _state["state"] = "threats_found"
            _state["message"] = f"Scan finished. {detected} new alert{'s' if detected != 1 else ''} detected."
        else:
            _state["state"] = "secure"
            _state["message"] = (
                f"Assessment complete. {packets_analyzed} packet"
                f"{'s' if packets_analyzed != 1 else ''} inspected; none matched "
                "ThreatScope's enabled detection rules."
            )
        persisted = _persistent_state_locked()
    _save_state(persisted)


def _schedule_next_locked():
    global _schedule_timer

    if _schedule_timer:
        _schedule_timer.cancel()

    if not _state["enabled"]:
        _state["next_scan_at"] = None
        return

    delay = _state["interval_minutes"] * 60
    _state["next_scan_at"] = _now() + timedelta(seconds=delay)
    _schedule_timer = threading.Timer(delay, _scheduled_tick)
    _schedule_timer.daemon = True
    _schedule_timer.start()


def _scheduled_tick():
    try:
        start_scan()
    except SensorUnavailableError as exc:
        with _lock:
            _state["state"] = "sensor_offline"
            _state["message"] = str(exc)
    with _lock:
        _schedule_next_locked()
        persisted = _persistent_state_locked()
    _save_state(persisted)


def set_schedule(enabled: bool, interval_minutes: int):
    if interval_minutes not in ALLOWED_INTERVALS:
        raise ValueError("interval_minutes must be 5 or 10")

    if enabled:
        sensor = get_sensor_status()
        if not sensor["online"]:
            raise SensorUnavailableError(
                "The network sensor is offline. Install or start the ThreatScope sensor before scheduling assessments."
            )
        if not sensor["monitoring"]:
            raise SensorUnavailableError(
                "Continuous monitoring is paused. Start monitoring before scheduling assessments."
            )

    with _lock:
        _state["enabled"] = enabled
        _state["interval_minutes"] = interval_minutes
        _state["message"] = (
            f"Scheduled assessments are on every {interval_minutes} minutes."
            if enabled else
            "Scheduled assessments are off."
        )
        _schedule_next_locked()
        persisted = _persistent_state_locked()
    _save_state(persisted)

    if enabled:
        return start_scan()

    with _lock:
        return _status_locked()


def restore_scan_state():
    """Restores the schedule and last completed assessment after restart."""
    persisted = get_runtime_state(RUNTIME_STATE_KEY)
    if not persisted:
        return get_scan_status()

    interval = persisted.get("interval_minutes", DEFAULT_INTERVAL_MINUTES)
    if interval not in ALLOWED_INTERVALS:
        interval = 5

    restored_state = persisted.get("state", "idle")
    restored_message = persisted.get("message", "Scheduled assessments are off.")
    if restored_state == "running":
        restored_state = "idle"
        restored_message = (
            "The previous assessment was interrupted when the API restarted. "
            "Run another assessment to confirm network status."
        )

    with _lock:
        _state.update({
            "enabled": bool(persisted.get("enabled", False)),
            "interval_minutes": interval,
            "state": restored_state,
            "message": restored_message,
            "last_started_at": _parse_datetime(persisted.get("last_started_at")),
            "last_finished_at": _parse_datetime(persisted.get("last_finished_at")),
            "packets_analyzed": max(0, int(persisted.get("packets_analyzed", 0))),
            "alerts_detected": max(0, int(persisted.get("alerts_detected", 0))),
            "baseline_alert_count": 0,
            "baseline_packet_count": 0,
        })
        _schedule_next_locked()
        status = _status_locked()
        corrected = _persistent_state_locked()
    _save_state(corrected)
    return status


def shutdown_scan_manager():
    """Stops local timers during a graceful API shutdown."""
    global _scan_timer, _schedule_timer

    with _lock:
        if _scan_timer:
            _scan_timer.cancel()
        if _schedule_timer:
            _schedule_timer.cancel()
        _scan_timer = None
        _schedule_timer = None


def reset_scan_state():
    """Test helper that cancels timers and restores the initial scan state."""
    global _scan_timer, _schedule_timer

    with _lock:
        if _scan_timer:
            _scan_timer.cancel()
        if _schedule_timer:
            _schedule_timer.cancel()
        _scan_timer = None
        _schedule_timer = None
        _state.update({
            "enabled": False,
            "interval_minutes": (
                DEFAULT_INTERVAL_MINUTES
                if DEFAULT_INTERVAL_MINUTES in ALLOWED_INTERVALS
                else 5
            ),
            "state": "idle",
            "message": "Scheduled assessments are off.",
            "last_started_at": None,
            "last_finished_at": None,
            "next_scan_at": None,
            "baseline_alert_count": 0,
            "baseline_packet_count": 0,
            "packets_analyzed": 0,
            "alerts_detected": 0,
        })
