"""
models.py — Data models for ThreatScope API
Person 2 owns this file.

Responsibilities:
- Define the structure of an Alert
- Used by the database, API endpoints, and WebSocket
"""

from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class Alert(BaseModel):
    """
    Represents a single detected threat alert.
    This is the core data structure shared across the entire app.
    """
    id:        Optional[int] = None   # auto-assigned by the database
    type:      str                    # e.g. "PORT_SCAN", "SYN_FLOOD"
    src_ip:    str                    # source IP address
    dst_ip:    str                    # destination IP address
    severity:  str                    # "LOW", "MEDIUM", or "HIGH"
    message:   str                    # human-readable description
    timestamp: str                    # ISO format timestamp


class AlertSummary(BaseModel):
    """
    Summary stats for the dashboard header cards.
    """
    total:  int
    high:   int
    medium: int
    low:    int
