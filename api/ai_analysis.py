"""Provider-neutral advisory analysis of recent ThreatScope alerts."""

import json
import os
from typing import Any, Dict, List

import requests
from dotenv import load_dotenv
from fastapi import HTTPException

load_dotenv()

DISCLAIMER = "AI analysis is advisory. Rule-based detections remain the source of truth."
VALID_PROVIDERS = {"ollama", "openai"}


def get_ai_config() -> Dict[str, Any]:
    provider = os.getenv("AI_PROVIDER", "ollama").strip().lower()
    if provider not in VALID_PROVIDERS:
        raise HTTPException(status_code=500, detail="AI_PROVIDER must be 'ollama' or 'openai'")

    return {
        "provider": provider,
        "alert_limit": int(os.getenv("AI_ALERT_LIMIT", "20")),
        "timeout": int(os.getenv("AI_TIMEOUT_SECONDS", os.getenv("OLLAMA_TIMEOUT_SECONDS", "45"))),
        "ollama_base_url": os.getenv("OLLAMA_BASE_URL", "http://127.0.0.1:11434").rstrip("/"),
        "ollama_model": os.getenv("OLLAMA_MODEL", "qwen3:8b").strip() or "qwen3:8b",
        "openai_base_url": os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1").rstrip("/"),
        "openai_api_key": os.getenv("OPENAI_API_KEY", "").strip(),
        "openai_model": os.getenv("OPENAI_MODEL", "qwen/qwen3-4b:free").strip() or "qwen/qwen3-4b:free",
    }


def compact_alerts(alerts: List[dict]) -> List[dict]:
    fields = ("type", "severity", "src_ip", "dst_ip", "timestamp", "message")
    return [{field: alert.get(field) for field in fields} for alert in alerts]


def build_prompt(alerts: List[dict]) -> str:
    return (
        "You are helping developers evaluate alerts produced by a rule-based network intrusion detection demo. "
        "Do not claim you detected attacks yourself. Return only valid JSON with: summary, pattern, risk_level "
        "(LOW, MEDIUM, or HIGH), demo_note, and rule_tuning_suggestions (an array of 2 to 4 concise items).\n\n"
        f"Recent alerts:\n{json.dumps(compact_alerts(alerts), indent=2)}"
    )


def normalize_analysis(raw: Any) -> Dict[str, Any]:
    if isinstance(raw, str):
        try:
            raw = json.loads(raw)
        except json.JSONDecodeError:
            raw = {"summary": raw}
    raw = raw if isinstance(raw, dict) else {}
    suggestions = raw.get("rule_tuning_suggestions", [])
    if not isinstance(suggestions, list):
        suggestions = [suggestions]
    risk_level = str(raw.get("risk_level", "MEDIUM")).upper()
    return {
        "summary": str(raw.get("summary", "No summary returned.")),
        "pattern": str(raw.get("pattern", "No pattern returned.")),
        "risk_level": risk_level if risk_level in {"LOW", "MEDIUM", "HIGH"} else "MEDIUM",
        "demo_note": str(raw.get("demo_note", "No demo note returned.")),
        "rule_tuning_suggestions": [str(item) for item in suggestions][:4],
    }


def _analyze_with_ollama(config: Dict[str, Any], prompt: str) -> Any:
    payload = {"model": config["ollama_model"], "prompt": prompt, "stream": False, "format": "json", "options": {"temperature": 0.2}}
    response = requests.post(f"{config['ollama_base_url']}/api/generate", json=payload, timeout=config["timeout"])
    response.raise_for_status()
    return response.json().get("response", "{}")


def _analyze_with_openai(config: Dict[str, Any], prompt: str) -> Any:
    if not config["openai_api_key"]:
        raise HTTPException(status_code=500, detail="OPENAI_API_KEY is required when AI_PROVIDER=openai")
    payload = {"model": config["openai_model"], "messages": [{"role": "user", "content": prompt}], "temperature": 0.2, "response_format": {"type": "json_object"}}
    headers = {"Authorization": f"Bearer {config['openai_api_key']}", "Content-Type": "application/json"}
    response = requests.post(f"{config['openai_base_url']}/chat/completions", json=payload, headers=headers, timeout=config["timeout"])
    response.raise_for_status()
    return response.json()["choices"][0]["message"]["content"]


def analyze_alerts(alerts: List[dict]) -> Dict[str, Any]:
    config = get_ai_config()
    model = config[f"{config['provider']}_model"]
    if not alerts:
        return {"provider": config["provider"], "model": model, "alert_count": 0, "summary": "No recent alerts are available to analyze.", "pattern": "No alert pattern available.", "risk_level": "LOW", "demo_note": "Trigger demo traffic or capture live traffic before running AI analysis.", "rule_tuning_suggestions": [], "disclaimer": DISCLAIMER}
    try:
        raw = _analyze_with_ollama(config, build_prompt(alerts)) if config["provider"] == "ollama" else _analyze_with_openai(config, build_prompt(alerts))
    except requests.exceptions.RequestException as exc:
        raise HTTPException(status_code=503, detail=f"{config['provider']} AI provider is unavailable.") from exc
    return {"provider": config["provider"], "model": model, "alert_count": len(alerts), **normalize_analysis(raw), "disclaimer": DISCLAIMER}
