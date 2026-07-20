import os
import sys

import pytest
import jwt
from fastapi import HTTPException
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import auth
from main import app


client = TestClient(app)


def test_dashboard_auth_fails_closed_without_secret(monkeypatch):
    monkeypatch.delenv("SUPABASE_JWT_SECRET", raising=False)
    monkeypatch.setenv("ALLOW_INSECURE_LOCAL_DEV", "false")
    token = jwt.encode({"aud": "authenticated"}, "unused-test-secret", algorithm="HS256")

    with pytest.raises(HTTPException) as exc:
        auth.decode_dashboard_token(token)

    assert exc.value.status_code == 503


def test_dashboard_auth_rejects_missing_token(monkeypatch):
    monkeypatch.setenv("ALLOW_INSECURE_LOCAL_DEV", "false")

    with pytest.raises(HTTPException) as exc:
        auth.decode_dashboard_token("")

    assert exc.value.status_code == 401


def test_engine_key_rejects_missing_or_wrong_value(monkeypatch):
    monkeypatch.setenv("ENGINE_API_KEY", "expected-key")
    monkeypatch.setenv("ALLOW_INSECURE_LOCAL_DEV", "false")

    class Request:
        headers = {"X-Engine-Key": "wrong-key"}

    with pytest.raises(HTTPException) as exc:
        auth.verify_engine_key(Request())

    assert exc.value.status_code == 401


def test_engine_key_accepts_exact_value(monkeypatch):
    monkeypatch.setenv("ENGINE_API_KEY", "expected-key")

    class Request:
        headers = {"X-Engine-Key": "expected-key"}

    assert auth.verify_engine_key(Request()) is None


def test_dashboard_alert_read_rejects_missing_token(monkeypatch):
    monkeypatch.setenv("SUPABASE_JWT_SECRET", "test-secret")
    monkeypatch.setenv("ALLOW_INSECURE_LOCAL_DEV", "false")

    response = client.get("/alerts")

    assert response.status_code == 401


def test_engine_alert_ingestion_rejects_missing_key(monkeypatch):
    monkeypatch.setenv("ENGINE_API_KEY", "expected-key")
    monkeypatch.setenv("ALLOW_INSECURE_LOCAL_DEV", "false")
    payload = {
        "type": "PORT_SCAN",
        "src_ip": "192.168.1.10",
        "dst_ip": "192.168.1.1",
        "severity": "MEDIUM",
        "message": "Test port scan",
        "timestamp": "2026-07-19T00:00:00+00:00",
    }

    response = client.post("/alerts", json=payload)

    assert response.status_code == 401


def test_engine_alert_ingestion_accepts_valid_key(monkeypatch):
    monkeypatch.setenv("ENGINE_API_KEY", "expected-key")
    monkeypatch.setenv("ALLOW_INSECURE_LOCAL_DEV", "false")
    payload = {
        "type": "PING_SWEEP",
        "src_ip": "192.168.1.11",
        "dst_ip": "192.168.1.1",
        "severity": "LOW",
        "message": "Test ping sweep",
        "timestamp": "2026-07-19T00:00:00+00:00",
    }

    response = client.post("/alerts", json=payload, headers={"X-Engine-Key": "expected-key"})

    assert response.status_code == 200
    assert response.json()["type"] == "PING_SWEEP"


def test_demo_reset_rejects_missing_engine_key(monkeypatch):
    monkeypatch.setenv("ENGINE_API_KEY", "expected-key")
    monkeypatch.setenv("ALLOW_INSECURE_LOCAL_DEV", "false")

    response = client.delete("/alerts")

    assert response.status_code == 401
