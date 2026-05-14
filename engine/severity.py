"""
severity.py — Threat severity scoring for ThreatScope
Person 1 owns this file.

Responsibilities:
- Assign a severity level to each detected threat type
- Return LOW, MEDIUM, or HIGH based on the attack type

Severity scale:
    HIGH   — active attack, immediate threat, needs attention now
    MEDIUM — reconnaissance or probing, potential precursor to attack
    LOW    — suspicious but could be normal behavior, worth logging
"""

# ── Severity map ───────────────────────────────────────────────────────────
# Maps each alert type to a severity level.
# Add new alert types here as you add new rules in rules.py

SEVERITY_MAP = {
    "SYN_FLOOD":  "HIGH",    # active DoS attack
    "PORT_SCAN":  "MEDIUM",  # reconnaissance — attacker mapping the network
    "PING_SWEEP": "LOW",     # host discovery — early stage reconnaissance
}

# ── Severity order (for sorting and comparison) ────────────────────────────
SEVERITY_ORDER = {
    "LOW":    1,
    "MEDIUM": 2,
    "HIGH":   3,
}


# ── Main function ──────────────────────────────────────────────────────────
def score_severity(alert_type):
    """
    Returns the severity level for a given alert type.
    Defaults to LOW if the alert type is not in the map.

    Args:
        alert_type (str): The type of alert e.g. "PORT_SCAN"

    Returns:
        str: "LOW", "MEDIUM", or "HIGH"
    """
    return SEVERITY_MAP.get(alert_type, "LOW")


def is_higher_severity(severity_a, severity_b):
    """
    Compares two severity levels.
    Returns True if severity_a is higher than severity_b.

    Useful for filtering or prioritizing alerts on the dashboard.

    Args:
        severity_a (str): e.g. "HIGH"
        severity_b (str): e.g. "MEDIUM"

    Returns:
        bool
    """
    return SEVERITY_ORDER.get(severity_a, 0) > SEVERITY_ORDER.get(severity_b, 0)
