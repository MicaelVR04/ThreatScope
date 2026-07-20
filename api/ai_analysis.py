"""
ai_analysis.py — AI-backed developer diagnostics for ThreatScope.

The rule engine remains the source of truth. This module only asks a local
or cloud model to summarize recent alerts and suggest rule-tuning ideas.
"""

import json
import logging
import os
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List

import requests
from fastapi import HTTPException
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

DISCLAIMER = "AI analysis is advisory. Rule-based detections remain the source of truth."
logger = logging.getLogger(__name__)


def get_ai_config() -> Dict[str, Any]:
    return {
        "provider": os.getenv("AI_PROVIDER", "ollama").strip().lower() or "ollama",
        "base_url": os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434").rstrip("/"),
        "model": os.getenv("OLLAMA_MODEL", "qwen2.5:7b").strip() or "qwen2.5:7b",
        "timeout": int(os.getenv("OLLAMA_TIMEOUT_SECONDS", "45")),
        "alert_limit": int(os.getenv("OLLAMA_ALERT_LIMIT", "20")),
        "openai_base_url": os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1").rstrip("/"),
        "openai_api_key": os.getenv("OPENAI_API_KEY", "").strip(),
        "openai_model": os.getenv("OPENAI_MODEL", "gpt-4o-mini").strip() or "gpt-4o-mini",
    }


def get_ollama_config() -> Dict[str, Any]:
    return get_ai_config()


def compact_alerts(alerts: List[dict]) -> List[dict]:
    return [
        {
            "type": alert.get("type"),
            "severity": alert.get("severity"),
            "src_ip": alert.get("src_ip"),
            "dst_ip": alert.get("dst_ip"),
            "timestamp": alert.get("timestamp"),
            "message": alert.get("message"),
        }
        for alert in alerts
    ]


def build_prompt(alerts: List[dict], current_time: datetime = None) -> str:
    now = current_time or datetime.now(timezone.utc)
    return (
        "You are helping developers evaluate a rule-based network intrusion "
        "detection demo called ThreatScope. The rule engine already generated "
        "these alerts, so do not claim you detected attacks yourself.\n"
        f"The current API time is {now.isoformat()}. Use it when interpreting "
        "alert timestamps. Do not call an alert timestamp future-dated unless "
        "it is later than this value.\n\n"
        "Analyze the recent alerts and respond only as JSON with these keys:\n"
        "- summary: plain-English summary of what happened\n"
        "- pattern: likely pattern or sequence across the alerts\n"
        "- risk_level: LOW, MEDIUM, or HIGH based on the alert set\n"
        "- demo_note: whether this looks like deterministic demo traffic or what it would mean in a real network\n"
        "- rule_tuning_suggestions: array of 2 to 4 practical suggestions\n\n"
        "Keep the language short, practical, and honest. Do not recommend "
        "replacing rule-based detection with AI. Do not suggest ignoring "
        "private/internal IP ranges because this MVP is focused on LAN traffic. "
        "Only mention IP reputation if public internet IPs appear.\n\n"
        f"Recent alerts:\n{json.dumps(compact_alerts(alerts), indent=2)}"
    )


def normalize_analysis(raw: Any) -> Dict[str, Any]:
    if isinstance(raw, str):
        try:
            raw = json.loads(raw)
        except json.JSONDecodeError:
            raw = {"summary": raw}

    suggestions = raw.get("rule_tuning_suggestions", []) if isinstance(raw, dict) else []
    if not isinstance(suggestions, list):
        suggestions = [str(suggestions)]

    risk_level = str(raw.get("risk_level", "MEDIUM")).upper() if isinstance(raw, dict) else "MEDIUM"
    if risk_level not in {"LOW", "MEDIUM", "HIGH"}:
        risk_level = "MEDIUM"

    return {
        "summary": str(raw.get("summary", "No summary returned.") if isinstance(raw, dict) else raw),
        "pattern": str(raw.get("pattern", "No pattern returned.") if isinstance(raw, dict) else "No pattern returned."),
        "risk_level": risk_level,
        "demo_note": str(raw.get("demo_note", "No demo note returned.") if isinstance(raw, dict) else "No demo note returned."),
        "rule_tuning_suggestions": [str(item) for item in suggestions][:4],
    }


def analyze_alerts_with_ollama(alerts: List[dict]) -> Dict[str, Any]:
    config = get_ai_config()

    if not alerts:
        return empty_analysis(config["model"])

    payload = {
        "model": config["model"],
        "prompt": build_prompt(alerts),
        "stream": False,
        "format": "json",
        "options": {
            "temperature": 0.2,
        },
    }

    try:
        response = requests.post(
            f"{config['base_url']}/api/generate",
            json=payload,
            timeout=config["timeout"],
        )
        response.raise_for_status()
    except requests.exceptions.RequestException as exc:
        raise HTTPException(
            status_code=503,
            detail=(
                "Ollama is not available. Start Ollama and pull the configured model "
                f"({config['model']})."
            ),
        ) from exc

    data = response.json()
    normalized = normalize_analysis(data.get("response", "{}"))
    return {
        "model": config["model"],
        "alert_count": len(alerts),
        **normalized,
        "disclaimer": DISCLAIMER,
    }


def analyze_alerts_with_openai(alerts: List[dict]) -> Dict[str, Any]:
    config = get_ai_config()

    if not alerts:
        return empty_analysis(config["openai_model"])

    if not config["openai_api_key"]:
        raise HTTPException(
            status_code=503,
            detail="Cloud AI is not configured. Set OPENAI_API_KEY or switch AI_PROVIDER back to ollama.",
        )

    payload = {
        "model": config["openai_model"],
        "messages": [
            {
                "role": "system",
                "content": "You return strict JSON for a cybersecurity dashboard. No markdown.",
            },
            {
                "role": "user",
                "content": build_prompt(alerts),
            },
        ],
        "response_format": {"type": "json_object"},
        "temperature": 0.2,
    }

    response = None
    for attempt in range(2):
        try:
            response = requests.post(
                f"{config['openai_base_url']}/chat/completions",
                headers={
                    "Authorization": f"Bearer {config['openai_api_key']}",
                    "Content-Type": "application/json",
                },
                json=payload,
                timeout=config["timeout"],
            )
            response.raise_for_status()
            break
        except requests.exceptions.RequestException as exc:
            status = getattr(getattr(exc, "response", None), "status_code", None)
            retryable = status is None or status == 429 or status >= 500
            logger.warning(
                "Cloud AI request failed (status=%s, attempt=%s).",
                status or "network",
                attempt + 1,
            )
            if attempt == 0 and retryable:
                time.sleep(0.5)
                continue
            if status in {401, 403}:
                detail = "Cloud AI rejected the configured API key."
            elif status == 404:
                detail = "The configured cloud AI model is not available."
            elif status == 429:
                detail = "Cloud AI is temporarily rate limited. Try again shortly."
            else:
                detail = "Cloud AI is temporarily unavailable. Try again shortly."
            raise HTTPException(status_code=503, detail=detail) from exc

    data = response.json()
    content = data.get("choices", [{}])[0].get("message", {}).get("content", "{}")
    normalized = normalize_analysis(content)
    return {
        "model": config["openai_model"],
        "alert_count": len(alerts),
        **normalized,
        "disclaimer": DISCLAIMER,
    }


def analyze_alerts(alerts: List[dict]) -> Dict[str, Any]:
    config = get_ai_config()
    if config["provider"] in {"openai", "cloud"}:
        return analyze_alerts_with_openai(alerts)
    return analyze_alerts_with_ollama(alerts)


def empty_analysis(model: str) -> Dict[str, Any]:
    return {
        "model": model,
        "alert_count": 0,
        "summary": "No recent alerts are available to analyze.",
        "pattern": "No alert pattern available.",
        "risk_level": "LOW",
        "demo_note": "Trigger demo traffic or capture live traffic before running AI analysis.",
        "rule_tuning_suggestions": [],
        "disclaimer": DISCLAIMER,
    }
