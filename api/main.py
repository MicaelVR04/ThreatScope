"""
main.py — FastAPI application entry point for ThreatScope
Person 2 owns this file.

Endpoints:
    POST   /alerts          — engine posts a new alert here
    GET    /alerts          — dashboard fetches alert history
    GET    /alerts/summary  — dashboard fetches summary counts
    GET    /alerts/stats    — dashboard fetches counts by attack type
    DELETE /alerts          — clears all alerts (demo reset)
    GET    /health          — health check
    WS     /ws              — dashboard connects for real-time alerts
"""

import logging
import os
import asyncio
import json
from typing import Optional
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query, HTTPException, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from uuid import UUID
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.middleware import SlowAPIMiddleware
from models import (
    Alert,
    AlertSummary,
    MonitoringRequest,
    ScanScheduleRequest,
    SensorEnrollmentExchange,
    SensorHeartbeat,
    SensorTargetRequest,
)
from database import init_db, insert_alert, get_alerts, get_summary, get_stats, clear_alerts
from websocket import manager
from auth import decode_dashboard_token, verify_engine_key, verify_token
from ai_analysis import analyze_alerts, get_ai_config
from scan_manager import (
    SensorUnavailableError,
    get_scan_status,
    record_alert_history_cleared,
    record_detected_alert,
    restore_scan_state,
    set_schedule,
    shutdown_scan_manager,
    start_scan,
)
from sensor_manager import (
    SensorNotFoundError,
    get_sensor_status,
    record_heartbeat,
    resolve_owned_sensor,
    restore_sensor_state,
    set_monitoring,
)
from sensor_enrollment import (
    create_code,
    exchange_code,
    record_sensor_seen,
    revoke_current_sensor,
    revoke_owned_sensor,
    sensors_for_owner,
    verify_sensor_or_engine,
    verify_sensor_request,
)


# ── Logging ────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler("threatscope.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)


def _owner_id(user: dict) -> str:
    """Returns the already-validated JWT subject used as every ownership root."""
    try:
        return str(UUID(str(user.get("sub", ""))))
    except ValueError as exc:
        raise HTTPException(status_code=401, detail="Invalid authorization subject") from exc


def _owned_sensor_id(owner_id: str, sensor_id, required: bool = False):
    requested = str(sensor_id) if sensor_id else None
    sensor = resolve_owned_sensor(owner_id, requested)
    if required and not sensor:
        raise HTTPException(status_code=404, detail="Sensor not found")
    return sensor["id"] if sensor else None


def _dashboard_origins():
    configured = os.getenv(
        "DASHBOARD_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173",
    )
    origins = [
        origin.strip().rstrip("/")
        for origin in configured.split(",")
        if origin.strip()
    ]
    render_dashboard_host = (
        os.getenv("DASHBOARD_HOST", "")
        .strip()
        .removeprefix("https://")
        .removeprefix("http://")
        .rstrip("/")
    )
    if render_dashboard_host:
        origins.append(f"https://{render_dashboard_host}")
    return list(dict.fromkeys(origins))


# ── Rate Limiter ───────────────────────────────────────────────────────────
limiter = Limiter(key_func=get_remote_address)


# ── Startup ────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Runs once when the API starts — initializes the database."""
    init_db()
    restore_sensor_state()
    restore_scan_state()
    try:
        yield
    finally:
        shutdown_scan_manager()


app = FastAPI(
    title="ThreatScope API",
    description="Real-time Network Intrusion Detection System",
    version="1.0.0",
    lifespan=lifespan
)

app.state.limiter = limiter
app.add_middleware(SlowAPIMiddleware)

# ── CORS ───────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=_dashboard_origins(),
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)


# ── REST Endpoints ─────────────────────────────────────────────────────────
@app.post("/alerts", response_model=Alert)
@limiter.limit("60/minute")
async def create_alert(
    request: Request,
    alert: Alert,
    principal=Depends(verify_sensor_or_engine),
):
    """
    Receives a new alert from the engine.
    Validates severity, saves to DB, and broadcasts to all dashboards.
    """
    if alert.severity not in ["LOW", "MEDIUM", "HIGH"]:
        raise HTTPException(status_code=400, detail="severity must be LOW, MEDIUM, or HIGH")

    owner_id = principal.get("owner_id")
    sensor_id = principal.get("sensor_id")
    if principal.get("auth_type") == "engine" and not sensor_id:
        sensor = resolve_owned_sensor(owner_id)
        sensor_id = sensor["id"] if sensor else None

    alert_dict = alert.model_dump()
    alert_dict["user_id"] = owner_id
    alert_dict["sensor_id"] = sensor_id

    if not alert_dict.get("timestamp"):
        alert_dict["timestamp"] = datetime.now(timezone.utc).isoformat()

    alert_id = insert_alert(alert_dict)
    alert_dict["id"] = alert_id

    record_detected_alert(owner_id, sensor_id)
    if principal.get("auth_type") == "sensor":
        record_sensor_seen(principal)
    await manager.broadcast(alert_dict, owner_id)

    return alert_dict


@app.get("/alerts", response_model=list[Alert])
def read_alerts(
    severity: str = Query(default=None, description="Filter by severity: LOW, MEDIUM, HIGH"),
    limit: int = Query(default=50, le=200, description="Max number of alerts to return"),
    offset: int = Query(default=0, ge=0, description="Number of alerts to skip"),
    sensor_id: Optional[UUID] = Query(default=None),
    user=Depends(verify_token)
):
    """
    Returns alert history from the database.
    Supports severity filter and pagination.
    """
    if severity and severity not in ["LOW", "MEDIUM", "HIGH"]:
        raise HTTPException(status_code=400, detail="severity must be LOW, MEDIUM, or HIGH")

    owner_id = _owner_id(user)
    resolved_sensor_id = _owned_sensor_id(owner_id, sensor_id, required=bool(sensor_id))
    return get_alerts(
        severity=severity,
        limit=limit,
        offset=offset,
        user_id=owner_id,
        sensor_id=resolved_sensor_id,
    )


@app.get("/alerts/summary", response_model=AlertSummary)
def read_summary(sensor_id: Optional[UUID] = Query(default=None), user=Depends(verify_token)):
    """
    Returns alert counts grouped by severity.
    Used for the dashboard summary cards.
    """
    owner_id = _owner_id(user)
    resolved_sensor_id = _owned_sensor_id(owner_id, sensor_id, required=bool(sensor_id))
    return get_summary(user_id=owner_id, sensor_id=resolved_sensor_id)


@app.get("/alerts/stats")
def read_stats(
    group_by: str = Query(default=None, description='Use "type" for attack-type counts'),
    sensor_id: Optional[UUID] = Query(default=None),
    user=Depends(verify_token)
):
    """
    Returns chart data for the dashboard.
    - default: time-series counts by severity
    - group_by=type: alert counts grouped by attack type
    """
    if group_by and group_by != "type":
        raise HTTPException(status_code=400, detail='group_by must be "type"')

    owner_id = _owner_id(user)
    resolved_sensor_id = _owned_sensor_id(owner_id, sensor_id, required=bool(sensor_id))
    return get_stats(
        group_by=group_by,
        user_id=owner_id,
        sensor_id=resolved_sensor_id,
    )


@app.delete("/alerts")
def delete_alerts(_engine=Depends(verify_engine_key)):
    """
    Clears alerts owned by the configured demo account only.
    """
    owner_id = os.getenv("SENSOR_OWNER_USER_ID", "").strip()
    if not owner_id:
        raise HTTPException(status_code=503, detail="Demo alert ownership is not configured")
    clear_alerts(user_id=owner_id)
    record_alert_history_cleared(owner_id)
    return {"message": "Demo account alerts cleared"}


@app.delete("/alerts/mine")
@limiter.limit("10/minute")
def delete_my_alerts(request: Request, user=Depends(verify_token)):
    """Clears only the signed-in user's alert history."""
    user_id = _owner_id(user)
    clear_alerts(user_id=user_id)
    record_alert_history_cleared(user_id)
    return {"message": "Your alert history was cleared"}


@app.post("/ai/analyze-alerts")
@limiter.limit("6/minute")
def analyze_recent_alerts(
    request: Request,
    target: Optional[SensorTargetRequest] = None,
    user=Depends(verify_token),
):
    """
    Runs advisory diagnostics with the configured local or cloud AI provider.
    AI output is advisory; rule-based detections remain the source of truth.
    """
    config = get_ai_config()
    owner_id = _owner_id(user)
    sensor_id = _owned_sensor_id(
        owner_id,
        target.sensor_id if target else None,
        required=bool(target),
    )
    alerts = get_alerts(
        limit=config["alert_limit"],
        offset=0,
        user_id=owner_id,
        sensor_id=sensor_id,
    )
    scan_status = get_scan_status(owner_id, sensor_id)
    assessment_started_at = scan_status.get("last_started_at")
    if scan_status.get("state") == "secure":
        alerts = []
    elif assessment_started_at:
        try:
            started_at = datetime.fromisoformat(
                assessment_started_at.replace("Z", "+00:00")
            )
            alerts = [
                alert
                for alert in alerts
                if datetime.fromisoformat(
                    str(alert.get("timestamp", "")).replace("Z", "+00:00")
                ) >= started_at
            ]
        except (TypeError, ValueError):
            logger.warning(
                "Could not apply the latest assessment window to AI analysis."
            )
    return analyze_alerts(alerts)


@app.post("/sensor/heartbeat")
@limiter.limit("120/minute")
def sensor_heartbeat(
    request: Request,
    heartbeat: SensorHeartbeat,
    principal=Depends(verify_sensor_request),
):
    """Records sensor health and returns the requested monitoring state."""
    try:
        return record_heartbeat(heartbeat, principal)
    except SensorNotFoundError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc


@app.post("/sensors/enrollment")
@limiter.limit("5/minute")
def create_sensor_enrollment_code(
    request: Request,
    user=Depends(verify_token),
):
    """Creates one short-lived installation code for the signed-in sensor owner."""
    return create_code(_owner_id(user))


@app.post("/sensors/enroll")
@limiter.limit("5/minute")
def enroll_sensor(request: Request, enrollment: SensorEnrollmentExchange):
    """Exchanges a one-time code for a unique revocable sensor credential."""
    return exchange_code(
        enrollment.code,
        enrollment.name,
        enrollment.platform,
        enrollment.version,
    )


@app.get("/sensors")
def read_sensors(user=Depends(verify_token)):
    """Lists enrolled sensors without returning credential hashes or tokens."""
    return sensors_for_owner(_owner_id(user))


@app.delete("/sensors/self")
def delete_current_sensor(principal=Depends(verify_sensor_request)):
    """Lets a valid local sensor revoke its own credential during removal."""
    if not revoke_current_sensor(principal):
        raise HTTPException(status_code=404, detail="Sensor not found")
    return {"message": "Sensor access revoked"}


@app.delete("/sensors/{sensor_id}")
def delete_sensor(sensor_id: UUID, user=Depends(verify_token)):
    """Revokes one sensor owned by the signed-in account."""
    if not revoke_owned_sensor(str(sensor_id), _owner_id(user)):
        raise HTTPException(status_code=404, detail="Sensor not found")
    return {"message": "Sensor access revoked"}


@app.post("/sensor/monitoring")
@limiter.limit("30/minute")
def update_sensor_monitoring(
    request: Request,
    command: MonitoringRequest,
    user=Depends(verify_token),
):
    """Starts or pauses packet capture on the connected sensor."""
    owner_id = _owner_id(user)
    try:
        set_monitoring(owner_id, str(command.sensor_id), command.enabled)
    except SensorNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Sensor not found") from exc
    return get_scan_status(owner_id, str(command.sensor_id))


@app.get("/scan/status")
def scan_status(sensor_id: Optional[UUID] = Query(default=None), user=Depends(verify_token)):
    """Returns current scan and scheduled scan state."""
    owner_id = _owner_id(user)
    resolved = _owned_sensor_id(owner_id, sensor_id, required=bool(sensor_id))
    return get_scan_status(owner_id, resolved)


@app.post("/scan/run")
@limiter.limit("30/minute")
def run_scan_now(
    request: Request,
    target: SensorTargetRequest,
    user=Depends(verify_token),
):
    """
    Starts a verified assessment window on a connected monitoring sensor.
    """
    try:
        owner_id = _owner_id(user)
        sensor_id = _owned_sensor_id(owner_id, target.sensor_id, required=True)
        return start_scan(owner_id, sensor_id)
    except SensorUnavailableError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@app.post("/scan/schedule")
@limiter.limit("30/minute")
def update_scan_schedule(
    request: Request,
    command: ScanScheduleRequest,
    user=Depends(verify_token),
):
    """Turns scheduled scan windows on or off at a 5 or 10 minute interval."""
    try:
        owner_id = _owner_id(user)
        sensor_id = _owned_sensor_id(owner_id, command.sensor_id, required=True)
        return set_schedule(
            owner_id,
            sensor_id,
            command.enabled,
            command.interval_minutes,
        )
    except (ValueError, SensorUnavailableError) as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/health")
def health_check():
    """Simple health check — confirms the API is running."""
    return {"status": "ok", "service": "ThreatScope API"}


# ── WebSocket Endpoint ─────────────────────────────────────────────────────
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """
    Dashboard connects here to receive real-time alerts.
    Stays open until the client disconnects.
    """
    origin = websocket.headers.get("origin", "").rstrip("/")
    if origin not in _dashboard_origins():
        await websocket.close(code=1008)
        return
    await websocket.accept()
    try:
        auth_text = await asyncio.wait_for(websocket.receive_text(), timeout=5)
        if len(auth_text) > 4096:
            raise ValueError("Authentication message is too large")
        auth_message = json.loads(auth_text)
        user = decode_dashboard_token(auth_message.get("access_token", ""))
        owner_id = _owner_id(user)
    except (HTTPException, ValueError, TypeError, json.JSONDecodeError, asyncio.TimeoutError):
        await websocket.close(code=1008)
        return

    if not manager.connect(websocket, owner_id):
        await websocket.close(code=1013)
        return
    try:
        # This channel is server-push only; reject post-auth client traffic.
        await websocket.receive_text()
        await websocket.close(code=1008)
    except WebSocketDisconnect:
        pass
    finally:
        manager.disconnect(websocket)
