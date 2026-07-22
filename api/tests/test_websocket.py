import asyncio

from websocket import ConnectionManager


class FakeWebSocket:
    def __init__(self):
        self.messages = []

    async def send_text(self, message):
        self.messages.append(message)


def test_broadcast_delivers_alert_only_to_matching_owner():
    manager = ConnectionManager()
    owner_a = FakeWebSocket()
    owner_b = FakeWebSocket()
    manager.connect(owner_a, "owner-a")
    manager.connect(owner_b, "owner-b")

    asyncio.run(manager.broadcast({"id": 1}, "owner-a"))

    assert len(owner_a.messages) == 1
    assert owner_b.messages == []


def test_connection_limit_is_enforced_per_owner():
    manager = ConnectionManager()

    for _ in range(manager.MAX_CONNECTIONS_PER_OWNER):
        assert manager.connect(FakeWebSocket(), "owner-a") is True

    assert manager.connect(FakeWebSocket(), "owner-a") is False
    assert manager.connect(FakeWebSocket(), "owner-b") is True
