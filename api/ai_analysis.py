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

DISCLAIMER = (
    "AI analysis is advisory. Alerts are heuristic rule matches, not confirmed compromises. "
    "Rule-based detections remain the source of truth."
)
logger = logging.getLogger(__name__)

RULE_ENGINE_CAPABILITIES = {
    "PORT_SCAN": (
        "Tracks unique destination ports reached by initial TCP SYN packets from one "
        "source to one target inside a bounded time window."
    ),
    "PING_SWEEP": (
        "Tracks unique ICMP echo-request destinations from one source inside a bounded "
        "time window."
    ),
    "SYN_FLOOD": (
        "Tracks unique unresolved initial SYN flows per source and target inside a bounded "
        "time window, and removes matching flows when response or later-connection packets arrive."
    ),
    "ARP_SPOOF": (
        "Evaluates ARP replies and requires repeated conflicting MAC claims for the same IP "
        "before alerting."
    ),
    "SHARED": "Suppresses duplicate alerts from the same rule, source, and target during a cooldown.",
}


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


def _parse_alert_timestamp(value: Any):
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed.astimezone(timezone.utc)
    except (TypeError, ValueError):
        return None


def compact_alerts(alerts: List[dict]) -> List[dict]:
    compacted = [
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
    indexed = [
        (index, alert, _parse_alert_timestamp(alert.get("timestamp")))
        for index, alert in enumerate(compacted)
    ]
    indexed.sort(
        key=lambda item: (
            item[2] is None,
            item[2].timestamp() if item[2] else 0,
            item[0],
        )
    )
    return [alert for _, alert, _ in indexed]


def build_evidence(alerts: List[dict]) -> Dict[str, Any]:
    ordered_alerts = compact_alerts(alerts)
    valid_timestamps = [
        parsed
        for alert in ordered_alerts
        if (parsed := _parse_alert_timestamp(alert.get("timestamp"))) is not None
    ]
    observed_span = None
    if len(valid_timestamps) >= 2:
        observed_span = round(
            (valid_timestamps[-1] - valid_timestamps[0]).total_seconds(),
            3,
        )

    return {
        "ordering": "oldest_to_newest_by_recorded_timestamp",
        "recorded_alert_sequence": [alert.get("type") for alert in ordered_alerts],
        "observed_alert_span_seconds": observed_span,
        "span_definition": "Time between the first and last recorded alert timestamps, not attack duration.",
        "alerts": ordered_alerts,
    }


def build_prompt(alerts: List[dict], current_time: datetime = None) -> str:
    now = current_time or datetime.now(timezone.utc)
    evidence = build_evidence(alerts)
    return (
        "You are helping developers evaluate a rule-based network intrusion "
        "detection demo called ThreatScope. The rule engine already generated "
        "these alerts, so do not claim you detected attacks yourself.\n"
        "The input contains heuristic rule matches, not packet captures, process names, "
        "malware evidence, or confirmed incidents. Alert severity describes the matched "
        "rule, not confidence that a compromise occurred. Never claim a device is "
        "compromised, participating in a botnet, or deliberately attacking another host "
        "unless the supplied fields contain independent evidence for that conclusion. "
        "Consider legitimate high-connection applications such as peer-to-peer or torrent "
        "clients when alerts show many public peers. Use cautious terms such as possible, "
        "may, and warrants verification. Do not invent packet counts, thresholds, ports, "
        "time windows, or connection outcomes. Repeat those details only when they appear "
        "in the supplied alert fields. Do not describe rule matches as lateral movement; "
        "the evidence does not establish host compromise or movement between systems.\n"
        f"The current API time is {now.isoformat()}. Use it when interpreting "
        "alert timestamps. Do not call an alert timestamp future-dated unless "
        "it is later than this value. The server-calculated evidence metadata is "
        "authoritative: preserve recorded_alert_sequence exactly. If you mention elapsed "
        "time, use observed_alert_span_seconds exactly and describe it only as the span "
        "between recorded alerts, not as a window or the duration of an attack.\n"
        "The default deterministic ThreatScope demo uses source 192.168.99.50, target "
        "192.168.99.10, and the sequence PORT_SCAN, PING_SWEEP, SYN_FLOOD, ARP_SPOOF. "
        "When the evidence matches, say it matches the default demo profile if testing "
        "was intentional; otherwise recommend verification. Do not automatically assume "
        "that matching addresses prove traffic is a demo.\n\n"
        "Analyze the recent alerts and respond only as JSON with these keys:\n"
        "- summary: plain-English summary of what happened\n"
        "- pattern: likely pattern or sequence across the alerts\n"
        "- risk_level: LOW, MEDIUM, or HIGH based on the alert set\n"
        "- demo_note: whether this looks like deterministic demo traffic or what it would mean in a real network\n"
        "- rule_tuning_suggestions: array of 2 to 4 practical suggestions\n\n"
        "Keep the language short, practical, and honest. Do not recommend "
        "replacing rule-based detection with AI. Do not suggest ignoring "
        "private/internal IP ranges because this MVP is focused on LAN traffic. "
        "Only mention IP reputation if public internet IPs appear. Suggestions must be "
        "changes to ThreatScope detection, correlation, suppression, or presentation. "
        "Do not present firewall rate limiting, static ARP configuration, or other host/network "
        "mitigations as rule-tuning changes that ThreatScope performs. Do not recommend "
        "suppressing or allowlisting the default demo profile because the demo relies on those "
        "alerts being visible. Do not recommend capabilities already listed below; suggestions "
        "must add a concrete behavior beyond what is currently implemented. ThreatScope's "
        "severity schema is limited to LOW, MEDIUM, and HIGH; do not recommend unsupported "
        "severity labels such as CRITICAL.\n\n"
        f"Current rule capabilities:\n{json.dumps(RULE_ENGINE_CAPABILITIES, indent=2)}\n\n"
        f"Authoritative evidence:\n{json.dumps(evidence, indent=2)}"
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


def evidence_fields(alerts: List[dict]) -> Dict[str, Any]:
    evidence = build_evidence(alerts)
    return {
        "recorded_alert_sequence": evidence["recorded_alert_sequence"],
        "observed_alert_span_seconds": evidence["observed_alert_span_seconds"],
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
        **evidence_fields(alerts),
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

    is_groq_qwen = (
        "api.groq.com" in config["openai_base_url"]
        and config["openai_model"] == "qwen/qwen3.6-27b"
    )
    messages = [
        {
            "role": "user",
            "content": build_prompt(alerts),
        }
    ]
    if not is_groq_qwen:
        messages.insert(0, {
            "role": "system",
            "content": "You return strict JSON for a cybersecurity dashboard. No markdown.",
        })

    payload = {
        "model": config["openai_model"],
        "messages": messages,
        "response_format": {"type": "json_object"},
        "temperature": 0.2,
    }
    if is_groq_qwen:
        payload.update({
            "reasoning_effort": "none",
            "reasoning_format": "hidden",
        })

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
        **evidence_fields(alerts),
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
        "recorded_alert_sequence": [],
        "observed_alert_span_seconds": None,
        "summary": "No recent alerts are available to analyze.",
        "pattern": "No alert pattern available.",
        "risk_level": "LOW",
        "demo_note": "Trigger demo traffic or capture live traffic before running AI analysis.",
        "rule_tuning_suggestions": [],
        "disclaimer": DISCLAIMER,
    }
