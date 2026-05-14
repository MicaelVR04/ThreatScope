"""
websocket.py — WebSocket manager for ThreatScope
Person 2 owns this file.

Responsibilities:
- Track all active dashboard connections
- Broadcast new alerts to every connected dashboard in real time
"""

import json
from fastapi import WebSocket


class ConnectionManager:
    """
    Manages all active WebSocket connections.
    When a new alert comes in, it broadcasts to every connected dashboard.
    """

    def __init__(self):
        # List of all currently connected WebSocket clients
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        """
        Accepts a new WebSocket connection and adds it to the active list.
        """
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        """
        Removes a WebSocket connection when the client disconnects.
        """
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

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
                # Client disconnected unexpectedly
                disconnected.append(connection)

        # Clean up disconnected clients
        for connection in disconnected:
            self.disconnect(connection)


# Single shared instance used across the entire API
manager = ConnectionManager()
