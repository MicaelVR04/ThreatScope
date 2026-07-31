"""Persistent owner- and sensor-scoped network assessment state."""

import os
import threading
import logging
from datetime import datetime, timedelta, timezone

from database import (
    clear_scan_states,
    get_owned_sensor,
    get_scan_state,
    get_summary,
    list_scan_states,
    list_scheduler_scan_states,
    save_scan_state,
)
from sensor_manager import get_sensor_status, resolve_owned_sensor


SCAN_WINDOW_SECONDS = int(os.getenv("SCAN_WINDOW_SECONDS", "8"))
SCHEDULER_POLL_SECONDS = max(
    2,
    min(int(os.getenv("SCAN_SCHEDULER_POLL_SECONDS", "5")), 30),
)
DEFAULT_INTERVAL_MINUTES = int(os.getenv("SCAN_INTERVAL_MINUTES", "5"))
ALLOWED_INTERVALS = {5, 10}

_lock = threading.RLock()
_scheduler_stop = threading.Event()
_scheduler_thread = None
logger = logging.getLogger(__name__)


class SensorUnavailableError(RuntimeError):
    pass


def _now():
    return datetime.now(timezone.utc)


def _iso(value):
    return value.isoformat() if isinstance(value, datetime) else value


def _parse_datetime(value):
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
    except (TypeError, ValueError):
        return None


def _default_state(owner_id: str, sensor_id: str):
    return {
        "sensor_id": sensor_id,
        "owner_id": owner_id,
        "enabled": False,
        "interval_minutes": (
            DEFAULT_INTERVAL_MINUTES if DEFAULT_INTERVAL_MINUTES in ALLOWED_INTERVALS else 5
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
    }


def _load_state(owner_id: str, sensor_id: str):
    stored = get_scan_state(sensor_id, owner_id)
    if not stored:
        return _default_state(owner_id, sensor_id)
    state = _default_state(owner_id, sensor_id)
    state.update({key: stored.get(key, default) for key, default in state.items()})
    state["enabled"] = bool(state["enabled"])
    for key in (
        "baseline_alert_count",
        "baseline_packet_count",
        "packets_analyzed",
        "alerts_detected",
    ):
        state[key] = max(0, int(state.get(key) or 0))
    if state["interval_minutes"] not in ALLOWED_INTERVALS:
        state["interval_minutes"] = 5
    return state


def _save(state):
    payload = {**state}
    for key in ("last_started_at", "last_finished_at", "next_scan_at"):
        payload[key] = _iso(payload.get(key))
    saved = save_scan_state(payload)
    if not saved:
        raise RuntimeError("Scan state could not be persisted")
    return payload


def _public_status(state, sensor):
    return {
        "enabled": bool(state["enabled"]),
        "interval_minutes": state["interval_minutes"],
        "state": state["state"],
        "message": state["message"],
        "last_started_at": _iso(state.get("last_started_at")),
        "last_finished_at": _iso(state.get("last_finished_at")),
        "next_scan_at": _iso(state.get("next_scan_at")),
        "alerts_detected": state["alerts_detected"],
        "packets_analyzed": state["packets_analyzed"],
        "sensor": sensor,
    }


def _total_alerts(owner_id: str, sensor_id: str):
    return get_summary(user_id=owner_id, sensor_id=sensor_id)["total"]


def get_scan_status(owner_id: str, sensor_id: str = None):
    sensor_record = resolve_owned_sensor(owner_id, sensor_id)
    if not sensor_record:
        empty = _default_state(owner_id, sensor_id)
        return _public_status(empty, get_sensor_status(owner_id, sensor_id))
    resolved_id = sensor_record["id"]
    with _lock:
        state = _load_state(owner_id, resolved_id)
        return _public_status(state, get_sensor_status(owner_id, resolved_id))


def record_detected_alert(owner_id: str, sensor_id: str = None):
    sensor = resolve_owned_sensor(owner_id, sensor_id)
    if not sensor:
        return None
    with _lock:
        state = _load_state(owner_id, sensor["id"])
        if state["state"] != "running":
            state["state"] = "threats_found"
            state["alerts_detected"] = max(1, state["alerts_detected"] + 1)
            state["message"] = "The sensor reported a new threat alert during continuous monitoring."
            _save(state)
        return _public_status(state, get_sensor_status(owner_id, sensor["id"]))


def record_alert_history_cleared(owner_id: str):
    with _lock:
        for stored in list_scan_states():
            if stored.get("owner_id") != owner_id:
                continue
            state = _load_state(owner_id, stored["sensor_id"])
            if state["state"] != "running":
                state.update({
                    "state": "idle",
                    "message": "Alert history cleared. Run an assessment to confirm current network status.",
                    "alerts_detected": 0,
                    "packets_analyzed": 0,
                })
                _save(state)


def start_scan(owner_id: str, sensor_id: str):
    sensor = get_sensor_status(owner_id, sensor_id)
    if not sensor["sensor_id"]:
        raise SensorUnavailableError("Sensor not found")
    if not sensor["online"]:
        raise SensorUnavailableError(
            "The network sensor is offline. Install or start it before running an assessment."
        )
    if not sensor["monitoring"]:
        raise SensorUnavailableError(
            "Continuous monitoring is paused. Start monitoring before running an assessment."
        )

    with _lock:
        state = _load_state(owner_id, sensor_id)
        if state["state"] == "running":
            return _public_status(state, sensor)
        state.update({
            "state": "running",
            "message": "Scan started. ThreatScope is watching for new alerts.",
            "last_started_at": _now(),
            "last_finished_at": None,
            "baseline_alert_count": _total_alerts(owner_id, sensor_id),
            "baseline_packet_count": sensor["packet_count"],
            "packets_analyzed": 0,
            "alerts_detected": 0,
        })
        _save(state)
        return _public_status(state, sensor)


def finish_scan(owner_id: str, sensor_id: str):
    with _lock:
        state = _load_state(owner_id, sensor_id)
        sensor = get_sensor_status(owner_id, sensor_id)
        if state["state"] != "running":
            return _public_status(state, sensor)
        detected = max(
            0,
            _total_alerts(owner_id, sensor_id) - state["baseline_alert_count"],
        )
        packets_analyzed = max(
            0,
            sensor["packet_count"] - state["baseline_packet_count"],
        )
        state.update({
            "alerts_detected": detected,
            "packets_analyzed": packets_analyzed,
            "last_finished_at": _now(),
        })

        if not sensor["online"] or not sensor["monitoring"]:
            state["state"] = "sensor_offline"
            state["message"] = "Assessment stopped because the network sensor went offline."
        elif packets_analyzed == 0:
            state["state"] = "no_data"
            state["message"] = (
                "No network packets were observed. ThreatScope cannot determine whether the network is secure."
            )
        elif detected:
            state["state"] = "threats_found"
            state["message"] = (
                f"Scan finished. {detected} new alert{'s' if detected != 1 else ''} detected."
            )
        else:
            state["state"] = "secure"
            state["message"] = (
                f"Assessment complete. {packets_analyzed} packet"
                f"{'s' if packets_analyzed != 1 else ''} inspected; none matched "
                "ThreatScope's enabled detection rules."
            )
        _save(state)
        return _public_status(state, sensor)


def set_schedule(owner_id: str, sensor_id: str, enabled: bool, interval_minutes: int):
    if interval_minutes not in ALLOWED_INTERVALS:
        raise ValueError("interval_minutes must be 5 or 10")
    sensor = get_sensor_status(owner_id, sensor_id)
    if not sensor["sensor_id"]:
        raise SensorUnavailableError("Sensor not found")
    if enabled and (not sensor["online"] or not sensor["monitoring"]):
        raise SensorUnavailableError(
            "The sensor must be online with continuous monitoring active before scheduling assessments."
        )

    with _lock:
        state = _load_state(owner_id, sensor_id)
        state.update({
            "enabled": bool(enabled),
            "interval_minutes": interval_minutes,
            "next_scan_at": (
                _now() + timedelta(minutes=interval_minutes) if enabled else None
            ),
            "message": (
                f"Scheduled assessments are on every {interval_minutes} minutes."
                if enabled else "Scheduled assessments are off."
            ),
        })
        _save(state)
    return start_scan(owner_id, sensor_id) if enabled else get_scan_status(owner_id, sensor_id)


def _scheduler_tick():
    now = _now()
    for stored in list_scheduler_scan_states():
        owner_id = stored.get("owner_id")
        sensor_id = stored.get("sensor_id")
        if not owner_id or not sensor_id or not get_owned_sensor(sensor_id, owner_id):
            continue
        state = _load_state(owner_id, sensor_id)
        started = _parse_datetime(state.get("last_started_at"))
        next_scan = _parse_datetime(state.get("next_scan_at"))
        if state["state"] == "running" and started:
            if now >= started + timedelta(seconds=SCAN_WINDOW_SECONDS):
                finish_scan(owner_id, sensor_id)
            continue
        if state["enabled"] and next_scan and now >= next_scan:
            try:
                start_scan(owner_id, sensor_id)
                state = _load_state(owner_id, sensor_id)
            except SensorUnavailableError as exc:
                state["state"] = "sensor_offline"
                state["message"] = str(exc)
            state["next_scan_at"] = now + timedelta(minutes=state["interval_minutes"])
            _save(state)


def _scheduler_loop():
    while not _scheduler_stop.wait(SCHEDULER_POLL_SECONDS):
        try:
            with _lock:
                _scheduler_tick()
        except Exception:
            # The next tick retries; endpoint requests remain available.
            logger.exception("Scheduled assessment tick failed")
            continue


def restore_scan_state():
    """Starts one scheduler worker for all persisted tenant scan records."""
    global _scheduler_thread
    if _scheduler_thread and _scheduler_thread.is_alive():
        return
    _scheduler_stop.clear()
    _scheduler_thread = threading.Thread(
        target=_scheduler_loop,
        name="threatscope-scan-scheduler",
        daemon=True,
    )
    _scheduler_thread.start()


def shutdown_scan_manager():
    global _scheduler_thread
    _scheduler_stop.set()
    if _scheduler_thread:
        _scheduler_thread.join(timeout=2)
    _scheduler_thread = None


def reset_scan_state(owner_id: str = None):
    """Test helper for clearing persisted tenant scan state."""
    clear_scan_states(owner_id)
