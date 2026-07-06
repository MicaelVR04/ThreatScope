"""
tests/test_ai_analysis.py — Unit tests for local Ollama diagnostics.
"""

import os
import sys

import pytest
import requests
from fastapi import HTTPException

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from ai_analysis import analyze_alerts_with_ollama, compact_alerts


def make_alert():
    return {
        "id": 1,
        "type": "SYN_FLOOD",
        "src_ip": "192.168.99.50",
        "dst_ip": "192.168.99.10",
        "severity": "HIGH",
        "message": "192.168.99.50 sent 100+ SYN packets",
        "timestamp": "2026-07-04T21:56:42.093403+00:00",
        "extra": "not sent to Ollama",
    }


class FakeResponse:
    def __init__(self, payload, status_code=200):
        self.payload = payload
        self.status_code = status_code

    def raise_for_status(self):
        if self.status_code >= 400:
            raise requests.exceptions.HTTPError("bad response")

    def json(self):
        return self.payload


def test_compact_alerts_removes_extra_fields():
    compacted = compact_alerts([make_alert()])

    assert compacted == [{
        "type": "SYN_FLOOD",
        "severity": "HIGH",
        "src_ip": "192.168.99.50",
        "dst_ip": "192.168.99.10",
        "timestamp": "2026-07-04T21:56:42.093403+00:00",
        "message": "192.168.99.50 sent 100+ SYN packets",
    }]


def test_analyze_alerts_with_mocked_ollama(monkeypatch):
    monkeypatch.setenv("OLLAMA_MODEL", "qwen2.5:7b")

    def fake_post(url, json, timeout):
        assert url.endswith("/api/generate")
        assert json["model"] == "qwen2.5:7b"
        assert json["stream"] is False
        assert json["format"] == "json"
        return FakeResponse({
            "response": (
                '{"summary":"SYN flood activity observed.",'
                '"pattern":"Active disruption from one host.",'
                '"risk_level":"HIGH",'
                '"demo_note":"Looks like demo traffic if expected.",'
                '"rule_tuning_suggestions":["Track rate per destination.","Add cooldown visibility."]}'
            )
        })

    monkeypatch.setattr(requests, "post", fake_post)

    result = analyze_alerts_with_ollama([make_alert()])

    assert result["model"] == "qwen2.5:7b"
    assert result["alert_count"] == 1
    assert result["risk_level"] == "HIGH"
    assert "SYN flood" in result["summary"]
    assert len(result["rule_tuning_suggestions"]) == 2
    assert "Rule-based detections" in result["disclaimer"]


def test_analyze_alerts_handles_ollama_unavailable(monkeypatch):
    def fake_post(url, json, timeout):
        raise requests.exceptions.ConnectionError("offline")

    monkeypatch.setattr(requests, "post", fake_post)

    with pytest.raises(HTTPException) as exc:
        analyze_alerts_with_ollama([make_alert()])

    assert exc.value.status_code == 503
    assert "Ollama is not available" in exc.value.detail


def test_analyze_alerts_empty_short_circuits(monkeypatch):
    def fake_post(url, json, timeout):
        raise AssertionError("Ollama should not be called for empty alerts")

    monkeypatch.setattr(requests, "post", fake_post)

    result = analyze_alerts_with_ollama([])

    assert result["alert_count"] == 0
    assert result["risk_level"] == "LOW"
