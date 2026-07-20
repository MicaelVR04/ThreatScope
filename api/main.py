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
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query, HTTPException, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.middleware import SlowAPIMiddleware
from models import Alert, AlertSummary, MonitoringRequest, ScanScheduleRequest, SensorHeartbeat
from database import init_db, insert_alert, get_alerts, get_summary, get_stats, clear_alerts
from websocket import manager
from auth import decode_dashboard_token, verify_engine_key, verify_sensor_owner, verify_token
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
from sensor_manager import record_heartbeat, restore_sensor_state, set_monitoring


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
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── REST Endpoints ─────────────────────────────────────────────────────────
@app.post("/alerts", response_model=Alert)
@limiter.limit("60/minute")
async def create_alert(request: Request, alert: Alert, _engine=Depends(verify_engine_key)):
    """
    Receives a new alert from the engine.
    Validates severity, saves to DB, and broadcasts to all dashboards.
    """
    if alert.severity not in ["LOW", "MEDIUM", "HIGH"]:
        raise HTTPException(status_code=400, detail="severity must be LOW, MEDIUM, or HIGH")

    alert_dict = alert.model_dump()
    owner_id = os.getenv("SENSOR_OWNER_USER_ID", "").strip()
    if not owner_id and os.getenv("ALLOW_INSECURE_LOCAL_DEV", "false").lower() != "true":
        raise HTTPException(
            status_code=503,
            detail="SENSOR_OWNER_USER_ID is required for secure alert ingestion",
        )
    alert_dict["user_id"] = owner_id or None

    if not alert_dict.get("timestamp"):
        alert_dict["timestamp"] = datetime.now(timezone.utc).isoformat()

    alert_id = insert_alert(alert_dict)
    alert_dict["id"] = alert_id

    record_detected_alert()
    await manager.broadcast(alert_dict)

    return alert_dict


@app.get("/alerts", response_model=list[Alert])
def read_alerts(
    severity: str = Query(default=None, description="Filter by severity: LOW, MEDIUM, HIGH"),
    limit: int = Query(default=50, le=200, description="Max number of alerts to return"),
    offset: int = Query(default=0, ge=0, description="Number of alerts to skip"),
    user=Depends(verify_token)
):
    """
    Returns alert history from the database.
    Supports severity filter and pagination.
    """
    if severity and severity not in ["LOW", "MEDIUM", "HIGH"]:
        raise HTTPException(status_code=400, detail="severity must be LOW, MEDIUM, or HIGH")

    return get_alerts(
        severity=severity,
        limit=limit,
        offset=offset,
        user_id=user.get("sub"),
    )


@app.get("/alerts/summary", response_model=AlertSummary)
def read_summary(user=Depends(verify_token)):
    """
    Returns alert counts grouped by severity.
    Used for the dashboard summary cards.
    """
    return get_summary(user_id=user.get("sub"))


@app.get("/alerts/stats")
def read_stats(
    group_by: str = Query(default=None, description='Use "type" for attack-type counts'),
    user=Depends(verify_token)
):
    """
    Returns chart data for the dashboard.
    - default: time-series counts by severity
    - group_by=type: alert counts grouped by attack type
    """
    if group_by and group_by != "type":
        raise HTTPException(status_code=400, detail='group_by must be "type"')

    return get_stats(group_by=group_by, user_id=user.get("sub"))


@app.delete("/alerts")
def delete_alerts(_engine=Depends(verify_engine_key)):
    """
    Clears all alerts from the database.
    Useful for resetting between demos.
    """
    clear_alerts()
    return {"message": "All alerts cleared"}


@app.delete("/alerts/mine")
def delete_my_alerts(user=Depends(verify_token)):
    """Clears only the signed-in user's alert history."""
    user_id = user.get("sub")
    clear_alerts(user_id=user_id)
    owner_id = os.getenv("SENSOR_OWNER_USER_ID", "").strip()
    if user_id == owner_id:
        record_alert_history_cleared()
    return {"message": "Your alert history was cleared"}


@app.post("/ai/analyze-alerts")
def analyze_recent_alerts(user=Depends(verify_sensor_owner)):
    """
    Runs advisory diagnostics with the configured local or cloud AI provider.
    AI output is advisory; rule-based detections remain the source of truth.
    """
    config = get_ai_config()
    alerts = get_alerts(
        limit=config["alert_limit"],
        offset=0,
        user_id=user.get("sub"),
    )
    scan_status = get_scan_status()
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
def sensor_heartbeat(heartbeat: SensorHeartbeat, _engine=Depends(verify_engine_key)):
    """Records sensor health and returns the requested monitoring state."""
    return record_heartbeat(heartbeat)


@app.post("/sensor/monitoring")
def update_sensor_monitoring(request: MonitoringRequest, user=Depends(verify_sensor_owner)):
    """Starts or pauses packet capture on the connected sensor."""
    set_monitoring(request.enabled)
    return get_scan_status()


@app.get("/scan/status")
def scan_status(user=Depends(verify_sensor_owner)):
    """Returns current scan and scheduled scan state."""
    return get_scan_status()


@app.post("/scan/run")
def run_scan_now(user=Depends(verify_sensor_owner)):
    """
    Starts a verified assessment window on a connected monitoring sensor.
    """
    try:
        return start_scan()
    except SensorUnavailableError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


@app.post("/scan/schedule")
def update_scan_schedule(request: ScanScheduleRequest, user=Depends(verify_sensor_owner)):
    """Turns scheduled scan windows on or off at a 5 or 10 minute interval."""
    try:
        return set_schedule(request.enabled, request.interval_minutes)
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
    token = websocket.query_params.get("access_token", "")
    try:
        user = decode_dashboard_token(token)
        owner_id = os.getenv("SENSOR_OWNER_USER_ID", "").strip()
        if owner_id and user.get("sub") != owner_id:
            raise HTTPException(status_code=403, detail="Sensor owner access required")
    except HTTPException:
        await websocket.close(code=1008)
        return

    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
