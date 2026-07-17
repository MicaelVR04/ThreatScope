"""
scan_manager.py — lightweight scheduled scan state for ThreatScope.

The engine remains responsible for packet analysis. A scan window marks when
ThreatScope is actively watching for new alerts, then reports whether any new
alerts appeared during that window.
"""

import os
import threading
from datetime import datetime, timedelta, timezone
from typing import Optional

from database import get_summary

SCAN_WINDOW_SECONDS = int(os.getenv("SCAN_WINDOW_SECONDS", "8"))
DEFAULT_INTERVAL_MINUTES = int(os.getenv("SCAN_INTERVAL_MINUTES", "5"))
ALLOWED_INTERVALS = {5, 10}

_lock = threading.Lock()
_scan_timer: Optional[threading.Timer] = None
_schedule_timer: Optional[threading.Timer] = None

_state = {
    "enabled": False,
    "interval_minutes": DEFAULT_INTERVAL_MINUTES if DEFAULT_INTERVAL_MINUTES in ALLOWED_INTERVALS else 5,
    "state": "idle",
    "message": "Scheduled scans are off.",
    "last_started_at": None,
    "last_finished_at": None,
    "next_scan_at": None,
    "baseline_alert_count": 0,
    "alerts_detected": 0,
}


def _now():
    return datetime.now(timezone.utc)


def _iso(value):
    return value.isoformat() if value else None


def _total_alerts():
    return get_summary()["total"]


def _status_locked():
    return {
        "enabled": _state["enabled"],
        "interval_minutes": _state["interval_minutes"],
        "state": _state["state"],
        "message": _state["message"],
        "last_started_at": _iso(_state["last_started_at"]),
        "last_finished_at": _iso(_state["last_finished_at"]),
        "next_scan_at": _iso(_state["next_scan_at"]),
        "alerts_detected": _state["alerts_detected"],
    }


def get_scan_status():
    with _lock:
        return _status_locked()


def start_scan():
    global _scan_timer

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
            "alerts_detected": 0,
        })
        _scan_timer = threading.Timer(SCAN_WINDOW_SECONDS, finish_scan)
        _scan_timer.daemon = True
        _scan_timer.start()
        return _status_locked()


def finish_scan():
    with _lock:
        current_total = _total_alerts()
        detected = max(0, current_total - _state["baseline_alert_count"])
        _state["alerts_detected"] = detected
        _state["last_finished_at"] = _now()

        if detected:
            _state["state"] = "threats_found"
            _state["message"] = f"Scan finished. {detected} new alert{'s' if detected != 1 else ''} detected."
        else:
            _state["state"] = "secure"
            _state["message"] = "Network is secure. No new threats were detected in the latest scan."


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
    start_scan()
    with _lock:
        _schedule_next_locked()


def set_schedule(enabled: bool, interval_minutes: int):
    if interval_minutes not in ALLOWED_INTERVALS:
        raise ValueError("interval_minutes must be 5 or 10")

    with _lock:
        _state["enabled"] = enabled
        _state["interval_minutes"] = interval_minutes
        _state["message"] = (
            f"Scheduled scans are on every {interval_minutes} minutes."
            if enabled else
            "Scheduled scans are off."
        )
        _schedule_next_locked()

    if enabled:
        return start_scan()

    with _lock:
        return _status_locked()
