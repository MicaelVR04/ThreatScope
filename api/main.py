"""
main.py — FastAPI application entry point for ThreatScope
Person 2 owns this file.

Endpoints:
    POST /alerts          — engine posts a new alert here
    GET  /alerts          — dashboard fetches alert history
    GET  /alerts/summary  — dashboard fetches summary counts
    WS   /ws              — dashboard connects for real-time alerts
"""

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from models import Alert, AlertSummary
from database import init_db, insert_alert, get_alerts, get_summary
from websocket import manager


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

# ── CORS ───────────────────────────────────────────────────────────────────
# Allows the React dashboard to talk to the API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # React dev server
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── REST Endpoints ─────────────────────────────────────────────────────────
@app.post("/alerts", response_model=Alert)
async def create_alert(alert: Alert):
    """
    Receives a new alert from the engine.
    Saves it to the database and broadcasts it to all connected dashboards.
    """
    alert_dict = alert.model_dump()
    alert_id = insert_alert(alert_dict)
    alert_dict["id"] = alert_id

    # Broadcast to all connected dashboard clients via WebSocket
    await manager.broadcast(alert_dict)

    return alert_dict


@app.get("/alerts", response_model=list[Alert])
def read_alerts(
    severity: str = Query(default=None, description="Filter by severity: LOW, MEDIUM, HIGH"),
    limit: int = Query(default=100, description="Max number of alerts to return")
):
    """
    Returns alert history from the database.
    Optional severity filter and limit.
    """
    return get_alerts(severity=severity, limit=limit)


@app.get("/alerts/summary", response_model=AlertSummary)
def read_summary():
    """
    Returns alert counts grouped by severity.
    Used for the dashboard summary cards.
    """
    return get_summary()


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
            # Keep the connection alive — we only send, never receive
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
