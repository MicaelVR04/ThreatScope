"""
websocket.py — WebSocket manager for ThreatScope
Person 2 owns this file.

Responsibilities:
- Track all active dashboard connections
- Broadcast new alerts to every connected dashboard in real time
"""

import json
import logging
from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    """
    Manages all active WebSocket connections.
    When a new alert comes in, it broadcasts to every connected dashboard.
    """

    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        """
        Accepts a new WebSocket connection and adds it to the active list.
        """
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"[WS] Client connected. Total: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        """
        Removes a WebSocket connection when the client disconnects.
        """
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            logger.info(f"[WS] Client disconnected. Total: {len(self.active_connections)}")

    async def broadcast(self, alert: dict):
        """
        Sends a new alert to every connected dashboard client.
        Automatically removes any clients that have disconnected.

        Args:
            alert (dict): The alert to broadcast
        """
        disconnected = []

        for connection in self.active_connections:
            try:
                await connection.send_text(json.dumps(alert))
            except Exception:
                disconnected.append(connection)

        for connection in disconnected:
            self.disconnect(connection)


# Single shared instance used across the entire API
manager = ConnectionManager()
