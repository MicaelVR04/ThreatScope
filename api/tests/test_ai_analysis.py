"""Tests for local and OpenAI-compatible cloud AI provider selection."""

import os
import sys

import pytest
from fastapi import HTTPException

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from ai_analysis import analyze_alerts, get_ai_config


def test_openai_provider_reads_openrouter_configuration(monkeypatch):
    monkeypatch.setenv("AI_PROVIDER", "openai")
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    monkeypatch.setenv("OPENAI_BASE_URL", "https://openrouter.ai/api/v1")
    monkeypatch.setenv("OPENAI_MODEL", "qwen/qwen3-4b:free")

    config = get_ai_config()

    assert config["provider"] == "openai"
    assert config["openai_base_url"] == "https://openrouter.ai/api/v1"
    assert config["openai_model"] == "qwen/qwen3-4b:free"


def test_rejects_unknown_ai_provider(monkeypatch):
    monkeypatch.setenv("AI_PROVIDER", "invalid")

    with pytest.raises(HTTPException, match="AI_PROVIDER"):
        get_ai_config()


def test_openai_provider_sends_openai_compatible_request(monkeypatch):
    monkeypatch.setenv("AI_PROVIDER", "openai")
    monkeypatch.setenv("OPENAI_API_KEY", "test-key")
    monkeypatch.setenv("OPENAI_BASE_URL", "https://openrouter.ai/api/v1")
    monkeypatch.setenv("OPENAI_MODEL", "qwen/qwen3-4b:free")

    captured = {}

    class Response:
        def raise_for_status(self):
            return None

        def json(self):
            return {"choices": [{"message": {"content": '{"summary":"ok","risk_level":"LOW"}'}}]}

    def fake_post(url, **kwargs):
        captured["url"] = url
        captured.update(kwargs)
        return Response()

    monkeypatch.setattr("ai_analysis.requests.post", fake_post)
    result = analyze_alerts([{"type": "PORT_SCAN", "severity": "HIGH"}])

    assert captured["url"] == "https://openrouter.ai/api/v1/chat/completions"
    assert captured["headers"]["Authorization"] == "Bearer test-key"
    assert captured["json"]["model"] == "qwen/qwen3-4b:free"
    assert result["provider"] == "openai"
    assert result["risk_level"] == "LOW"
