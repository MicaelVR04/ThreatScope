"""
models.py — Data models for ThreatScope API
Person 2 owns this file.

Responsibilities:
- Define the structure of an Alert
- Used by the database, API endpoints, and WebSocket
"""

from pydantic import BaseModel, Field, field_validator
from typing import Optional
from uuid import UUID


class Alert(BaseModel):
    """
    Represents a single detected threat alert.
    This is the core data structure shared across the entire app.
    """
    id:        Optional[int] = None
    type:      str = Field(min_length=2, max_length=64, pattern=r"^[A-Z][A-Z0-9_]+$")
    src_ip:    str = Field(min_length=1, max_length=64)
    dst_ip:    str = Field(min_length=1, max_length=64)
    severity:  str
    message:   str = Field(min_length=1, max_length=512)
    timestamp: str = Field(min_length=1, max_length=64)
    user_id:   Optional[str] = None
    sensor_id: Optional[str] = None

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
    sensor_id: UUID

    @field_validator("interval_minutes")
    @classmethod
    def validate_interval(cls, v):
        if v not in [5, 10]:
            raise ValueError("interval_minutes must be 5 or 10")
        return v


class SensorHeartbeat(BaseModel):
    sensor_id: UUID
    interface: str = Field(min_length=1, max_length=64)
    monitoring: bool
    packet_count: int = Field(ge=0)
    last_error: Optional[str] = Field(default=None, max_length=512)
    version: str = Field(default="1.0.0", min_length=1, max_length=32)


class MonitoringRequest(BaseModel):
    enabled: bool
    sensor_id: UUID


class SensorTargetRequest(BaseModel):
    sensor_id: UUID


class SensorEnrollmentExchange(BaseModel):
    code: str = Field(min_length=32, max_length=64, pattern=r"^[A-Za-z0-9_-]+$")
    name: str = Field(min_length=1, max_length=64)
    platform: str = Field(default="macOS", min_length=1, max_length=32)
    version: str = Field(default="1.0.0", min_length=1, max_length=32)

    @field_validator("name", "platform", "version")
    @classmethod
    def normalize_text(cls, value):
        normalized = " ".join(value.strip().split())
        if not normalized:
            raise ValueError("value is required")
        return normalized
