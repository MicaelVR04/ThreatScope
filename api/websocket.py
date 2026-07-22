"""Owner-scoped WebSocket delivery for local dashboard deployments."""

import json
import logging

from fastapi import WebSocket


logger = logging.getLogger(__name__)


class ConnectionManager:
    MAX_CONNECTIONS = 100
    MAX_CONNECTIONS_PER_OWNER = 5

    def __init__(self):
        self.active_connections: dict[WebSocket, str] = {}

    def connect(self, websocket: WebSocket, owner_id: str):
        """Registers an already-authenticated connection under its JWT owner."""
        owner_connections = sum(
            connection_owner == owner_id
            for connection_owner in self.active_connections.values()
        )
        if (
            len(self.active_connections) >= self.MAX_CONNECTIONS
            or owner_connections >= self.MAX_CONNECTIONS_PER_OWNER
        ):
            return False
        self.active_connections[websocket] = owner_id
        logger.info("[WS] Client connected. Total: %s", len(self.active_connections))
        return True

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.pop(websocket, None)
            logger.info("[WS] Client disconnected. Total: %s", len(self.active_connections))

    async def broadcast(self, alert: dict, owner_id: str):
        """Sends an alert only to dashboard connections for the same owner."""
        disconnected = []
        for connection, connection_owner in list(self.active_connections.items()):
            if connection_owner != owner_id:
                continue
            try:
                await connection.send_text(json.dumps(alert))
            except Exception:
                disconnected.append(connection)
        for connection in disconnected:
            self.disconnect(connection)


manager = ConnectionManager()
