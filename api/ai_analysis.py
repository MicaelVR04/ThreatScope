"""
ai_analysis.py — Ollama-backed developer diagnostics for ThreatScope.

The rule engine remains the source of truth. This module only asks a local
Ollama model to summarize recent alerts and suggest rule-tuning ideas.
"""

import json
import os
from typing import Any, Dict, List

import requests
from fastapi import HTTPException
from dotenv import load_dotenv

load_dotenv()

DISCLAIMER = "AI analysis is advisory. Rule-based detections remain the source of truth."


def get_ollama_config() -> Dict[str, Any]:
    return {
        "base_url": os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434").rstrip("/"),
        "model": os.getenv("OLLAMA_MODEL", "qwen2.5:7b").strip() or "qwen2.5:7b",
        "timeout": int(os.getenv("OLLAMA_TIMEOUT_SECONDS", "45")),
        "alert_limit": int(os.getenv("OLLAMA_ALERT_LIMIT", "20")),
    }


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


def build_prompt(alerts: List[dict]) -> str:
    return (
        "You are helping developers evaluate a rule-based network intrusion "
        "detection demo called ThreatScope. The rule engine already generated "
        "these alerts, so do not claim you detected attacks yourself.\n\n"
        "Analyze the recent alerts and respond only as JSON with these keys:\n"
        "- summary: plain-English summary of what happened\n"
        "- pattern: likely pattern or sequence across the alerts\n"
        "- risk_level: LOW, MEDIUM, or HIGH based on the alert set\n"
        "- demo_note: whether this looks like deterministic demo traffic or what it would mean in a real network\n"
        "- rule_tuning_suggestions: array of 2 to 4 practical suggestions\n\n"
        "Keep the language short, practical, and honest. Do not recommend "
        "replacing rule-based detection with AI.\n\n"
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
    config = get_ollama_config()

    if not alerts:
        return {
            "model": config["model"],
            "alert_count": 0,
            "summary": "No recent alerts are available to analyze.",
            "pattern": "No alert pattern available.",
            "risk_level": "LOW",
            "demo_note": "Trigger demo traffic or capture live traffic before running AI analysis.",
            "rule_tuning_suggestions": [],
            "disclaimer": DISCLAIMER,
        }

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
