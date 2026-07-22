"""
tests/test_ai_analysis.py — Unit tests for local Ollama diagnostics.
"""

import os
import sys
from datetime import datetime, timezone

import pytest
import requests
from fastapi import HTTPException
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from ai_analysis import (
    analyze_alerts,
    analyze_alerts_with_ollama,
    build_evidence,
    build_prompt,
    compact_alerts,
)
import main


client = TestClient(main.app)


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


def test_compact_alerts_orders_alerts_oldest_to_newest():
    newest = {**make_alert(), "type": "ARP_SPOOF", "timestamp": "2026-07-04T21:56:55+00:00"}
    oldest = {**make_alert(), "type": "PORT_SCAN", "timestamp": "2026-07-04T21:56:42+00:00"}

    compacted = compact_alerts([newest, oldest])

    assert [alert["type"] for alert in compacted] == ["PORT_SCAN", "ARP_SPOOF"]


def test_build_evidence_calculates_recorded_alert_span():
    alerts = [
        {**make_alert(), "type": "ARP_SPOOF", "timestamp": "2026-07-04T21:56:55.125+00:00"},
        {**make_alert(), "type": "PORT_SCAN", "timestamp": "2026-07-04T21:56:42.000+00:00"},
        {**make_alert(), "type": "SYN_FLOOD", "timestamp": "2026-07-04T21:56:50.000+00:00"},
    ]

    evidence = build_evidence(alerts)

    assert evidence["recorded_alert_sequence"] == ["PORT_SCAN", "SYN_FLOOD", "ARP_SPOOF"]
    assert evidence["observed_alert_span_seconds"] == 13.125
    assert "not attack duration" in evidence["span_definition"]


def test_prompt_includes_current_time_for_timestamp_interpretation():
    current_time = datetime(2026, 7, 20, 12, 0, tzinfo=timezone.utc)

    prompt = build_prompt([make_alert()], current_time=current_time)

    assert "2026-07-20T12:00:00+00:00" in prompt
    assert "Do not call an alert timestamp future-dated" in prompt


def test_prompt_forbids_unsupported_compromise_claims():
    prompt = build_prompt([make_alert()])

    assert "heuristic rule matches" in prompt
    assert "Never claim a device is compromised" in prompt
    assert "peer-to-peer or torrent clients" in prompt
    assert "Do not invent packet counts, thresholds, ports" in prompt
    assert "preserve recorded_alert_sequence exactly" in prompt
    assert "Do not describe rule matches as lateral movement" in prompt
    assert "default deterministic ThreatScope demo" in prompt
    assert "Any allowlist suggestion" in prompt


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
    assert result["recorded_alert_sequence"] == ["SYN_FLOOD"]
    assert result["observed_alert_span_seconds"] is None
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
    assert result["recorded_alert_sequence"] == []
    assert result["observed_alert_span_seconds"] is None
    assert result["risk_level"] == "LOW"


def test_analyze_alerts_with_mocked_cloud_provider(monkeypatch):
    monkeypatch.setenv("AI_PROVIDER", "openai")
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    monkeypatch.setenv("OPENAI_MODEL", "gpt-test")

    def fake_post(url, headers, json, timeout):
        assert url.endswith("/chat/completions")
        assert headers["Authorization"] == "Bearer test-key"
        assert json["model"] == "gpt-test"
        assert json["messages"][0]["role"] == "system"
        return FakeResponse({
            "choices": [{
                "message": {
                    "content": (
                        '{"summary":"Recent alerts look like a demo scan.",'
                        '"pattern":"Recon followed by active disruption.",'
                        '"risk_level":"HIGH",'
                        '"demo_note":"Likely deterministic demo traffic.",'
                        '"rule_tuning_suggestions":["Tune cooldown windows.","Explain alert names in the UI."]}'
                    )
                }
            }]
        })

    monkeypatch.setattr(requests, "post", fake_post)

    result = analyze_alerts([make_alert()])

    assert result["model"] == "gpt-test"
    assert result["risk_level"] == "HIGH"
    assert "demo scan" in result["summary"]


def test_groq_qwen_uses_non_reasoning_json_mode(monkeypatch):
    monkeypatch.setenv("AI_PROVIDER", "openai")
    monkeypatch.setenv("OPENAI_BASE_URL", "https://api.groq.com/openai/v1")
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    monkeypatch.setenv("OPENAI_MODEL", "qwen/qwen3.6-27b")

    def fake_post(url, headers, json, timeout):
        assert json["messages"][0]["role"] == "user"
        assert json["reasoning_effort"] == "none"
        assert json["reasoning_format"] == "hidden"
        assert json["response_format"] == {"type": "json_object"}
        assert json["temperature"] == 0.2
        return FakeResponse({
            "choices": [{
                "message": {
                    "content": (
                        '{"summary":"Port scan activity observed.",'
                        '"pattern":"Reconnaissance from one source.",'
                        '"risk_level":"MEDIUM",'
                        '"demo_note":"Controlled demo traffic.",'
                        '"rule_tuning_suggestions":["Keep the current threshold."]}'
                    )
                }
            }]
        })

    monkeypatch.setattr(requests, "post", fake_post)

    result = analyze_alerts([make_alert()])

    assert result["model"] == "qwen/qwen3.6-27b"
    assert result["risk_level"] == "MEDIUM"


def test_secure_assessment_does_not_send_historical_alerts_to_ai(monkeypatch):
    captured = {}
    owner_id = "98a345c1-6b65-4d93-96d6-59bec63fb4cf"
    sensor_id = "00000000-0000-4000-8000-000000000002"
    main.app.dependency_overrides[main.verify_token] = lambda: {
        "sub": owner_id
    }
    monkeypatch.setattr(main, "_owned_sensor_id", lambda *args, **kwargs: sensor_id)
    monkeypatch.setattr(main, "get_alerts", lambda **kwargs: [make_alert()])
    monkeypatch.setattr(
        main,
        "get_scan_status",
        lambda owner, sensor: {
            "state": "secure",
            "last_started_at": "2026-07-20T12:00:00+00:00",
        },
    )

    def fake_analyze(alerts):
        captured["alerts"] = alerts
        return {"alert_count": len(alerts)}

    monkeypatch.setattr(main, "analyze_alerts", fake_analyze)
    try:
        response = client.post("/ai/analyze-alerts", json={"sensor_id": sensor_id})
    finally:
        main.app.dependency_overrides.pop(main.verify_token, None)

    assert response.status_code == 200
    assert captured["alerts"] == []
