import hashlib
import os
import sys
from datetime import datetime, timezone

import pytest


sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import scan_manager
import sensor_manager
from database import get_connection, init_db
from models import SensorHeartbeat


OWNER_A = "98a345c1-6b65-4d93-96d6-59bec63fb4cf"
OWNER_B = "00000000-0000-4000-8000-000000000003"
SENSOR_A = "00000000-0000-4000-8000-00000000000a"
SENSOR_B = "00000000-0000-4000-8000-00000000000b"


def add_sensor(sensor_id, owner_id, name):
    conn = get_connection()
    try:
        conn.execute(
            """
            INSERT INTO sensors
                (id, owner_id, name, platform, version, token_hash, created_at)
            VALUES (?, ?, ?, 'macOS', 'test', ?, ?)
            """,
            (
                sensor_id,
                owner_id,
                name,
                hashlib.sha256(sensor_id.encode()).hexdigest(),
                datetime.now(timezone.utc).isoformat(),
            ),
        )
        conn.commit()
    finally:
        conn.close()


@pytest.fixture(autouse=True)
def reset_state():
    init_db()
    conn = get_connection()
    try:
        conn.execute("DELETE FROM sensor_scan_state")
        conn.execute("DELETE FROM sensors")
        conn.commit()
    finally:
        conn.close()
    add_sensor(SENSOR_A, OWNER_A, "Owner A Mac")
    add_sensor(SENSOR_B, OWNER_B, "Owner B Mac")
    yield
    scan_manager.reset_scan_state()


def heartbeat(sensor_id, packet_count=0, monitoring=True):
    return SensorHeartbeat(
        sensor_id=sensor_id,
        interface="en0",
        monitoring=monitoring,
        packet_count=packet_count,
        version="test",
    )


def principal(sensor_id, owner_id):
    return {"sensor_id": sensor_id, "owner_id": owner_id, "auth_type": "sensor"}


def test_heartbeat_updates_only_authenticated_sensor():
    command = sensor_manager.record_heartbeat(
        heartbeat(SENSOR_A, packet_count=12), principal(SENSOR_A, OWNER_A)
    )
    own_status = sensor_manager.get_sensor_status(OWNER_A, SENSOR_A)
    other_status = sensor_manager.get_sensor_status(OWNER_B, SENSOR_B)

    assert command["monitoring_enabled"] is True
    assert own_status["online"] is True
    assert own_status["packet_count"] == 12
    assert other_status["online"] is False
    assert other_status["packet_count"] == 0


def test_sensor_credential_cannot_heartbeat_as_another_sensor():
    with pytest.raises(sensor_manager.SensorNotFoundError):
        sensor_manager.record_heartbeat(
            heartbeat(SENSOR_B), principal(SENSOR_A, OWNER_A)
        )


def test_owner_cannot_pause_another_owners_sensor():
    with pytest.raises(sensor_manager.SensorNotFoundError):
        sensor_manager.set_monitoring(OWNER_A, SENSOR_B, False)

    assert sensor_manager.get_sensor_status(OWNER_B, SENSOR_B)["desired_monitoring"] is True


def test_monitoring_preferences_are_independent():
    sensor_manager.set_monitoring(OWNER_A, SENSOR_A, False)

    assert sensor_manager.get_sensor_status(OWNER_A, SENSOR_A)["desired_monitoring"] is False
    assert sensor_manager.get_sensor_status(OWNER_B, SENSOR_B)["desired_monitoring"] is True


def test_scan_states_are_isolated_per_owner_and_sensor(monkeypatch):
    sensor_manager.record_heartbeat(
        heartbeat(SENSOR_A, packet_count=10), principal(SENSOR_A, OWNER_A)
    )
    sensor_manager.record_heartbeat(
        heartbeat(SENSOR_B, packet_count=30), principal(SENSOR_B, OWNER_B)
    )
    monkeypatch.setattr(scan_manager, "_total_alerts", lambda owner, sensor: 0)

    scan_manager.start_scan(OWNER_A, SENSOR_A)
    sensor_manager.record_heartbeat(
        heartbeat(SENSOR_A, packet_count=25), principal(SENSOR_A, OWNER_A)
    )
    scan_manager.finish_scan(OWNER_A, SENSOR_A)

    owner_a = scan_manager.get_scan_status(OWNER_A, SENSOR_A)
    owner_b = scan_manager.get_scan_status(OWNER_B, SENSOR_B)
    assert owner_a["state"] == "secure"
    assert owner_a["packets_analyzed"] == 15
    assert owner_b["state"] == "idle"
    assert owner_b["packets_analyzed"] == 0


def test_cross_owner_scan_is_rejected():
    with pytest.raises(scan_manager.SensorUnavailableError):
        scan_manager.start_scan(OWNER_A, SENSOR_B)


def test_schedules_are_persisted_independently(monkeypatch):
    sensor_manager.record_heartbeat(heartbeat(SENSOR_A), principal(SENSOR_A, OWNER_A))
    sensor_manager.record_heartbeat(heartbeat(SENSOR_B), principal(SENSOR_B, OWNER_B))
    monkeypatch.setattr(scan_manager, "_total_alerts", lambda owner, sensor: 0)

    scan_manager.set_schedule(OWNER_A, SENSOR_A, True, 5)

    owner_a = scan_manager.get_scan_status(OWNER_A, SENSOR_A)
    owner_b = scan_manager.get_scan_status(OWNER_B, SENSOR_B)
    assert owner_a["enabled"] is True
    assert owner_a["interval_minutes"] == 5
    assert owner_b["enabled"] is False
