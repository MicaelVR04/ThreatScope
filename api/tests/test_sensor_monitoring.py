import os
import sys

import pytest
from fastapi.testclient import TestClient


sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import scan_manager
import sensor_manager
from database import clear_runtime_state, init_db
from main import app
from models import SensorHeartbeat


client = TestClient(app)


@pytest.fixture(autouse=True)
def reset_state():
    init_db()
    clear_runtime_state()
    sensor_manager.reset_sensor_state()
    scan_manager.reset_scan_state()
    yield
    scan_manager.reset_scan_state()
    sensor_manager.reset_sensor_state()
    clear_runtime_state()


def heartbeat(packet_count=0, monitoring=True):
    return SensorHeartbeat(
        sensor_id="test-sensor",
        interface="en0",
        monitoring=monitoring,
        packet_count=packet_count,
        version="test",
    )


def test_heartbeat_marks_sensor_online():
    command = sensor_manager.record_heartbeat(heartbeat(packet_count=12))
    status = sensor_manager.get_sensor_status()

    assert command["monitoring_enabled"] is True
    assert status["online"] is True
    assert status["monitoring"] is True
    assert status["packet_count"] == 12


def test_monitoring_command_is_returned_on_next_heartbeat():
    sensor_manager.set_monitoring(False)

    command = sensor_manager.record_heartbeat(heartbeat())

    assert command["monitoring_enabled"] is False


def test_assessment_refuses_to_claim_safety_without_sensor():
    with pytest.raises(scan_manager.SensorUnavailableError):
        scan_manager.start_scan()


def test_assessment_requires_packet_activity(monkeypatch):
    alert_count = 4
    sensor_manager.record_heartbeat(heartbeat(packet_count=10))
    monkeypatch.setattr(scan_manager, "_total_alerts", lambda: alert_count)

    scan_manager.start_scan()
    scan_manager.finish_scan()
    status = scan_manager.get_scan_status()

    assert status["state"] == "no_data"
    assert status["packets_analyzed"] == 0


def test_assessment_reports_secure_only_after_packets(monkeypatch):
    alert_count = 4
    sensor_manager.record_heartbeat(heartbeat(packet_count=10))
    monkeypatch.setattr(scan_manager, "_total_alerts", lambda: alert_count)

    scan_manager.start_scan()
    sensor_manager.record_heartbeat(heartbeat(packet_count=25))
    scan_manager.finish_scan()
    status = scan_manager.get_scan_status()

    assert status["state"] == "secure"
    assert status["packets_analyzed"] == 15
    assert status["message"] == (
        "Assessment complete. 15 packets inspected; none matched "
        "ThreatScope's enabled detection rules."
    )


def test_new_alert_supersedes_clear_assessment(monkeypatch):
    alert_count = 4
    sensor_manager.record_heartbeat(heartbeat(packet_count=10))
    monkeypatch.setattr(scan_manager, "_total_alerts", lambda: alert_count)

    scan_manager.start_scan()
    sensor_manager.record_heartbeat(heartbeat(packet_count=25))
    scan_manager.finish_scan()
    scan_manager.record_detected_alert()
    status = scan_manager.get_scan_status()

    assert status["state"] == "threats_found"
    assert status["alerts_detected"] == 1
    assert status["message"] == (
        "A new threat alert was detected after the latest assessment."
    )


def test_heartbeat_endpoint_requires_engine_key(monkeypatch):
    monkeypatch.setenv("ENGINE_API_KEY", "sensor-secret")
    monkeypatch.setenv("ALLOW_INSECURE_LOCAL_DEV", "false")
    payload = heartbeat().model_dump()

    denied = client.post("/sensor/heartbeat", json=payload)
    accepted = client.post(
        "/sensor/heartbeat",
        json=payload,
        headers={"X-Engine-Key": "sensor-secret"},
    )

    assert denied.status_code == 401
    assert accepted.status_code == 200


def test_monitoring_preference_survives_api_restart():
    sensor_manager.set_monitoring(False)
    sensor_manager.reset_sensor_state()

    status = sensor_manager.restore_sensor_state()

    assert status["desired_monitoring"] is False


def test_scan_result_and_schedule_survive_api_restart(monkeypatch):
    alert_count = 4
    sensor_manager.record_heartbeat(heartbeat(packet_count=10))
    monkeypatch.setattr(scan_manager, "_total_alerts", lambda: alert_count)

    scan_manager.set_schedule(True, 5)
    sensor_manager.record_heartbeat(heartbeat(packet_count=25))
    scan_manager.finish_scan()
    scan_manager.reset_scan_state()

    status = scan_manager.restore_scan_state()

    assert status["enabled"] is True
    assert status["interval_minutes"] == 5
    assert status["state"] == "secure"
    assert status["packets_analyzed"] == 15
    assert status["next_scan_at"] is not None


def test_interrupted_scan_is_not_restored_as_running(monkeypatch):
    sensor_manager.record_heartbeat(heartbeat(packet_count=10))
    monkeypatch.setattr(scan_manager, "_total_alerts", lambda: 0)

    scan_manager.start_scan()
    scan_manager.reset_scan_state()
    status = scan_manager.restore_scan_state()

    assert status["state"] == "idle"
    assert "interrupted" in status["message"].lower()
