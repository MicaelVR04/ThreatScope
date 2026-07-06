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
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query, HTTPException, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.middleware import SlowAPIMiddleware
from models import Alert, AlertSummary
from database import init_db, insert_alert, get_alerts, get_summary, get_stats, clear_alerts
from websocket import manager
from auth import verify_token
from ai_analysis import analyze_alerts_with_ollama, get_ollama_config


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


# ── Rate Limiter ───────────────────────────────────────────────────────────
limiter = Limiter(key_func=get_remote_address)


# ── Startup ────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Runs once when the API starts — initializes the database."""
    init_db()
    yield


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
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── REST Endpoints ─────────────────────────────────────────────────────────
@app.post("/alerts", response_model=Alert)
@limiter.limit("60/minute")
async def create_alert(request: Request, alert: Alert, user=Depends(verify_token)):
    """
    Receives a new alert from the engine.
    Validates severity, saves to DB, and broadcasts to all dashboards.
    """
    if alert.severity not in ["LOW", "MEDIUM", "HIGH"]:
        raise HTTPException(status_code=400, detail="severity must be LOW, MEDIUM, or HIGH")

    alert_dict = alert.model_dump()

    if not alert_dict.get("timestamp"):
        alert_dict["timestamp"] = datetime.now(timezone.utc).isoformat()

    alert_id = insert_alert(alert_dict)
    alert_dict["id"] = alert_id

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

    return get_alerts(severity=severity, limit=limit, offset=offset)


@app.get("/alerts/summary", response_model=AlertSummary)
def read_summary(user=Depends(verify_token)):
    """
    Returns alert counts grouped by severity.
    Used for the dashboard summary cards.
    """
    return get_summary()


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

    return get_stats(group_by=group_by)


@app.delete("/alerts")
def delete_alerts(user=Depends(verify_token)):
    """
    Clears all alerts from the database.
    Useful for resetting between demos.
    """
    clear_alerts()
    return {"message": "All alerts cleared"}


@app.post("/ai/analyze-alerts")
def analyze_recent_alerts(user=Depends(verify_token)):
    """
    Runs local Ollama diagnostics over recent alerts.
    AI output is advisory; rule-based detections remain the source of truth.
    """
    config = get_ollama_config()
    alerts = get_alerts(limit=config["alert_limit"], offset=0)
    return analyze_alerts_with_ollama(alerts)


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
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
