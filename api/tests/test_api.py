"""
tests/test_api.py — Unit and integration tests for ThreatScope API
Person 2 owns this file.

Run with:
    pytest tests/test_api.py -v

Requirements:
    pip install pytest httpx
"""

import pytest
from fastapi.testclient import TestClient
from datetime import datetime, timezone
import sys
import os

# Add parent directory to path so we can import from api/
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from main import app
from database import init_db, clear_alerts

# ── Test Client ────────────────────────────────────────────────────────────
client = TestClient(app)


# ── Fixtures ───────────────────────────────────────────────────────────────
@pytest.fixture(autouse=True)
def setup_and_teardown():
    """
    Runs before and after every test.
    Initializes the DB and clears all alerts so tests don't affect each other.
    """
    init_db()
    clear_alerts()
    yield
    clear_alerts()


def make_alert(severity="HIGH", attack_type="PORT_SCAN"):
    """Helper to build a valid alert payload."""
    return {
        "type": attack_type,
        "src_ip": "192.168.1.100",
        "dst_ip": "192.168.1.1",
        "severity": severity,
        "message": f"Test alert — {attack_type}",
        "timestamp": datetime.now(timezone.utc).isoformat()
    }


# ── Health Check ───────────────────────────────────────────────────────────
class TestHealthCheck:
    def test_health_returns_ok(self):
        """API should respond with status ok."""
        response = client.get("/health")
        assert response.status_code == 200
        assert response.json()["status"] == "ok"
        assert response.json()["service"] == "ThreatScope API"


# ── POST /alerts ───────────────────────────────────────────────────────────
class TestCreateAlert:
    def test_create_valid_high_alert(self):
        """Should accept a valid HIGH severity alert."""
        response = client.post("/alerts", json=make_alert("HIGH"))
        assert response.status_code == 200
        data = response.json()
        assert data["severity"] == "HIGH"
        assert data["type"] == "PORT_SCAN"
        assert data["id"] is not None

    def test_create_valid_medium_alert(self):
        """Should accept a valid MEDIUM severity alert."""
        response = client.post("/alerts", json=make_alert("MEDIUM", "SYN_FLOOD"))
        assert response.status_code == 200
        assert response.json()["severity"] == "MEDIUM"

    def test_create_valid_low_alert(self):
        """Should accept a valid LOW severity alert."""
        response = client.post("/alerts", json=make_alert("LOW", "PING_SWEEP"))
        assert response.status_code == 200
        assert response.json()["severity"] == "LOW"

    def test_reject_invalid_severity(self):
        """Should reject alerts with invalid severity values."""
        bad_alert = make_alert()
        bad_alert["severity"] = "CRITICAL"
        response = client.post("/alerts", json=bad_alert)
        assert response.status_code == 422

    def test_reject_missing_fields(self):
        """Should reject alerts missing required fields."""
        incomplete = {"type": "PORT_SCAN", "severity": "HIGH"}
        response = client.post("/alerts", json=incomplete)
        assert response.status_code == 422

    def test_alert_gets_assigned_id(self):
        """Each alert should get a unique auto-incremented ID."""
        r1 = client.post("/alerts", json=make_alert())
        r2 = client.post("/alerts", json=make_alert())
        assert r1.json()["id"] != r2.json()["id"]


# ── GET /alerts ────────────────────────────────────────────────────────────
class TestReadAlerts:
    def test_get_alerts_empty(self):
        """Should return empty list when no alerts exist."""
        response = client.get("/alerts")
        assert response.status_code == 200
        assert response.json() == []

    def test_get_alerts_returns_created(self):
        """Should return alerts after they are created."""
        client.post("/alerts", json=make_alert("HIGH"))
        client.post("/alerts", json=make_alert("LOW"))
        response = client.get("/alerts")
        assert response.status_code == 200
        assert len(response.json()) == 2

    def test_filter_by_severity_high(self):
        """Should only return HIGH alerts when filtered."""
        client.post("/alerts", json=make_alert("HIGH"))
        client.post("/alerts", json=make_alert("LOW"))
        client.post("/alerts", json=make_alert("MEDIUM"))
        response = client.get("/alerts?severity=HIGH")
        data = response.json()
        assert all(a["severity"] == "HIGH" for a in data)
        assert len(data) == 1

    def test_filter_by_severity_low(self):
        """Should only return LOW alerts when filtered."""
        client.post("/alerts", json=make_alert("LOW"))
        client.post("/alerts", json=make_alert("HIGH"))
        response = client.get("/alerts?severity=LOW")
        data = response.json()
        assert all(a["severity"] == "LOW" for a in data)

    def test_invalid_severity_filter(self):
        """Should reject invalid severity filter values."""
        response = client.get("/alerts?severity=INVALID")
        assert response.status_code == 400

    def test_pagination_limit(self):
        """Should respect the limit parameter."""
        for _ in range(10):
            client.post("/alerts", json=make_alert())
        response = client.get("/alerts?limit=5")
        assert len(response.json()) == 5

    def test_pagination_offset(self):
        """Should skip alerts based on offset."""
        for _ in range(5):
            client.post("/alerts", json=make_alert())
        r_all = client.get("/alerts")
        r_offset = client.get("/alerts?offset=3")
        assert len(r_offset.json()) == len(r_all.json()) - 3

    def test_alerts_ordered_newest_first(self):
        """Alerts should come back in descending timestamp order."""
        client.post("/alerts", json=make_alert())
        client.post("/alerts", json=make_alert())
        data = client.get("/alerts").json()
        ids = [a["id"] for a in data]
        assert ids == sorted(ids, reverse=True)


# ── GET /alerts/summary ────────────────────────────────────────────────────
class TestAlertSummary:
    def test_summary_empty(self):
        """Summary should return zeros when no alerts exist."""
        response = client.get("/alerts/summary")
        assert response.status_code == 200
        data = response.json()
        assert data == {"total": 0, "high": 0, "medium": 0, "low": 0}

    def test_summary_counts_correctly(self):
        """Summary counts should match inserted alerts."""
        client.post("/alerts", json=make_alert("HIGH"))
        client.post("/alerts", json=make_alert("HIGH"))
        client.post("/alerts", json=make_alert("MEDIUM"))
        client.post("/alerts", json=make_alert("LOW"))
        data = client.get("/alerts/summary").json()
        assert data["total"] == 4
        assert data["high"] == 2
        assert data["medium"] == 1
        assert data["low"] == 1


# ── GET /alerts/stats ──────────────────────────────────────────────────────
class TestAlertStats:
    def test_stats_empty(self):
        """Stats should return empty list when no alerts exist."""
        response = client.get("/alerts/stats")
        assert response.status_code == 200
        assert response.json() == []

    def test_stats_groups_by_type(self):
        """Stats should count alerts grouped by attack type."""
        client.post("/alerts", json=make_alert("HIGH", "PORT_SCAN"))
        client.post("/alerts", json=make_alert("HIGH", "PORT_SCAN"))
        client.post("/alerts", json=make_alert("MEDIUM", "SYN_FLOOD"))
        data = client.get("/alerts/stats?group_by=type").json()
        types = {item["type"]: item["count"] for item in data}
        assert types["PORT_SCAN"] == 2
        assert types["SYN_FLOOD"] == 1

    def test_stats_ordered_by_count_desc(self):
        """Stats should return most frequent attack types first."""
        for _ in range(3):
            client.post("/alerts", json=make_alert("HIGH", "PORT_SCAN"))
        client.post("/alerts", json=make_alert("MEDIUM", "SYN_FLOOD"))
        data = client.get("/alerts/stats?group_by=type").json()
        counts = [item["count"] for item in data]
        assert counts == sorted(counts, reverse=True)


# ── DELETE /alerts ─────────────────────────────────────────────────────────
class TestDeleteAlerts:
    def test_delete_clears_all_alerts(self):
        """Delete should remove all alerts from the database."""
        client.post("/alerts", json=make_alert("HIGH"))
        client.post("/alerts", json=make_alert("LOW"))
        client.delete("/alerts")
        response = client.get("/alerts")
        assert response.json() == []

    def test_delete_resets_summary(self):
        """After delete, summary should return all zeros."""
        client.post("/alerts", json=make_alert("HIGH"))
        client.delete("/alerts")
        data = client.get("/alerts/summary").json()
        assert data["total"] == 0
