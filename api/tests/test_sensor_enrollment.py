import os
import sys
from datetime import datetime, timedelta, timezone

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient


sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from auth import verify_token
from database import get_connection, get_sensor_credential, init_db
from main import app, limiter
from sensor_enrollment import authenticate_sensor_token


client = TestClient(app)
OWNER_ID = "98a345c1-6b65-4d93-96d6-59bec63fb4cf"


@pytest.fixture(autouse=True)
def clean_enrollment_state():
    init_db()
    conn = get_connection()
    try:
        conn.execute("DELETE FROM sensors")
        conn.execute("DELETE FROM sensor_enrollment_codes")
        conn.commit()
    finally:
        conn.close()
    app.dependency_overrides[verify_token] = lambda: {"sub": OWNER_ID}
    limiter.enabled = False
    yield
    limiter.enabled = True
    app.dependency_overrides.pop(verify_token, None)


def create_and_exchange(name="Office Mac"):
    created = client.post("/sensors/enrollment")
    assert created.status_code == 200
    code = created.json()["code"]
    exchanged = client.post("/sensors/enroll", json={
        "code": code,
        "name": name,
        "platform": "macOS",
        "version": "1.1.0",
    })
    assert exchanged.status_code == 200
    return code, exchanged.json()


def test_code_is_one_time_and_secret_is_not_stored_verbatim():
    code, credential = create_and_exchange()

    reused = client.post("/sensors/enroll", json={
        "code": code,
        "name": "Second Mac",
        "platform": "macOS",
        "version": "1.1.0",
    })
    stored = get_sensor_credential(credential["sensor_id"])
    conn = get_connection()
    try:
        stored_code = conn.execute(
            "SELECT code_hash FROM sensor_enrollment_codes LIMIT 1"
        ).fetchone()["code_hash"]
    finally:
        conn.close()

    assert reused.status_code == 400
    assert credential["sensor_token"].startswith("ts1.")
    assert stored["token_hash"] != credential["sensor_token"]
    assert len(stored["token_hash"]) == 64
    assert stored_code != code
    assert len(stored_code) == 64


def test_new_code_invalidates_older_unused_code():
    first = client.post("/sensors/enrollment").json()["code"]
    second = client.post("/sensors/enrollment").json()["code"]

    rejected = client.post("/sensors/enroll", json={
        "code": first,
        "name": "Old code",
        "platform": "macOS",
        "version": "1.1.0",
    })
    accepted = client.post("/sensors/enroll", json={
        "code": second,
        "name": "New code",
        "platform": "macOS",
        "version": "1.1.0",
    })

    assert rejected.status_code == 400
    assert accepted.status_code == 200


def test_account_sensor_quota_is_enforced(monkeypatch):
    monkeypatch.setenv("SENSOR_MAX_PER_USER", "1")
    create_and_exchange()

    response = client.post("/sensors/enrollment")

    assert response.status_code == 409
    assert response.json()["detail"] == "This account has reached its active sensor limit."


def test_expired_code_cannot_be_exchanged():
    code = client.post("/sensors/enrollment").json()["code"]
    conn = get_connection()
    try:
        conn.execute(
            "UPDATE sensor_enrollment_codes SET expires_at = ?",
            ((datetime.now(timezone.utc) - timedelta(seconds=1)).isoformat(),),
        )
        conn.commit()
    finally:
        conn.close()

    response = client.post("/sensors/enroll", json={
        "code": code,
        "name": "Expired code",
        "platform": "macOS",
        "version": "1.1.0",
    })

    assert response.status_code == 400
    assert response.json()["detail"] == (
        "This installation code is invalid, expired, or has already been used."
    )


def test_sensor_token_scopes_alert_to_enrolling_owner():
    _, credential = create_and_exchange()
    response = client.post("/alerts", headers={
        "X-Sensor-Token": credential["sensor_token"],
    }, json={
        "type": "PING_SWEEP",
        "src_ip": "192.168.1.2",
        "dst_ip": "192.168.1.3",
        "severity": "LOW",
        "message": "Enrollment test",
        "timestamp": "2026-07-21T00:00:00+00:00",
    })

    assert response.status_code == 200
    assert response.json()["user_id"] == OWNER_ID
    assert response.json()["sensor_id"] == credential["sensor_id"]


def test_sensor_cannot_heartbeat_as_another_sensor():
    _, credential = create_and_exchange()
    response = client.post("/sensor/heartbeat", headers={
        "X-Sensor-Token": credential["sensor_token"],
    }, json={
        "sensor_id": "00000000-0000-0000-0000-000000000000",
        "interface": "en0",
        "monitoring": True,
        "packet_count": 1,
        "version": "1.1.0",
    })

    assert response.status_code == 403


def test_owner_list_omits_credentials_and_revoke_blocks_token():
    _, credential = create_and_exchange()
    listed = client.get("/sensors")

    assert listed.status_code == 200
    assert listed.json()[0]["id"] == credential["sensor_id"]
    assert "token_hash" not in listed.json()[0]
    assert "sensor_token" not in listed.json()[0]

    revoked = client.delete(f"/sensors/{credential['sensor_id']}")
    assert revoked.status_code == 200
    with pytest.raises(HTTPException) as exc:
        authenticate_sensor_token(credential["sensor_token"])
    assert exc.value.status_code == 401


def test_owner_cannot_list_or_revoke_another_owners_sensor():
    _, owned_credential = create_and_exchange()
    other_sensor_id = "00000000-0000-4000-8000-000000000002"
    conn = get_connection()
    try:
        conn.execute(
            """
            INSERT INTO sensors
                (id, owner_id, name, platform, version, token_hash, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                other_sensor_id,
                "00000000-0000-4000-8000-000000000003",
                "Another owner's Mac",
                "macOS",
                "1.1.0",
                "a" * 64,
                datetime.now(timezone.utc).isoformat(),
            ),
        )
        conn.commit()
    finally:
        conn.close()

    listed = client.get("/sensors")
    rejected = client.delete(f"/sensors/{other_sensor_id}")
    other_sensor = get_sensor_credential(other_sensor_id)

    assert listed.status_code == 200
    assert [sensor["id"] for sensor in listed.json()] == [owned_credential["sensor_id"]]
    assert rejected.status_code == 404
    assert other_sensor["revoked_at"] is None


def test_sensor_can_revoke_itself():
    _, credential = create_and_exchange()

    removed = client.delete("/sensors/self", headers={
        "X-Sensor-Token": credential["sensor_token"],
    })

    assert removed.status_code == 200
    with pytest.raises(HTTPException) as exc:
        authenticate_sensor_token(credential["sensor_token"])
    assert exc.value.status_code == 401


def test_invalid_token_returns_same_generic_error():
    response = client.post("/sensor/heartbeat", headers={
        "X-Sensor-Token": "ts1.00000000-0000-0000-0000-000000000000.not-a-secret",
    }, json={
        "sensor_id": "00000000-0000-0000-0000-000000000000",
        "interface": "en0",
        "monitoring": True,
        "packet_count": 1,
        "version": "1.1.0",
    })

    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid sensor credential"
