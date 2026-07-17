"""
models.py — Data models for ThreatScope API
Person 2 owns this file.

Responsibilities:
- Define the structure of an Alert
- Used by the database, API endpoints, and WebSocket
"""

from pydantic import BaseModel, field_validator
from typing import Optional


class Alert(BaseModel):
    """
    Represents a single detected threat alert.
    This is the core data structure shared across the entire app.
    """
    id:        Optional[int] = None
    type:      str
    src_ip:    str
    dst_ip:    str
    severity:  str
    message:   str
    timestamp: str

    @field_validator("severity")
    @classmethod
    def validate_severity(cls, v):
        if v not in ["LOW", "MEDIUM", "HIGH"]:
            raise ValueError("severity must be LOW, MEDIUM, or HIGH")
        return v


class AlertSummary(BaseModel):
    """
    Summary stats for the dashboard header cards.
    """
    total:  int
    high:   int
    medium: int
    low:    int


class ScanScheduleRequest(BaseModel):
    """
    Dashboard request for enabling/disabling scheduled scan windows.
    """
    enabled: bool
    interval_minutes: int

    @field_validator("interval_minutes")
    @classmethod
    def validate_interval(cls, v):
        if v not in [5, 10]:
            raise ValueError("interval_minutes must be 5 or 10")
        return v
