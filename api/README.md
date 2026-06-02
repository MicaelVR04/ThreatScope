# ThreatScope API

**Person 2 — API & Infrastructure**
Real-time alert ingestion, storage, and streaming for the ThreatScope Network Intrusion Detection System.

---

## What This Does

The API is the bridge between the Detection Engine and the Dashboard. It receives alerts from the engine, stores them in SQLite, and streams them instantly to all connected dashboards via WebSocket.

```
Engine ──POST /alerts──► API ──WebSocket──► Dashboard
                          │
                        SQLite
```

---

## Stack

| Layer | Technology |
|---|---|
| Framework | FastAPI |
| Database | SQLite |
| Real-time | WebSockets |
| Validation | Pydantic v2 |
| Rate Limiting | SlowAPI |
| Server | Uvicorn |
| Container | Docker |

---

## Project Structure

```
api/
├── main.py           # FastAPI app — all endpoints
├── models.py         # Alert and AlertSummary data models
├── database.py       # SQLite connection and queries
├── websocket.py      # WebSocket connection manager
├── requirements.txt  # Python dependencies
├── Dockerfile        # Container config
├── .env              # Environment variables (not committed)
└── tests/
    └── test_api.py   # Full test suite
```

---

## Setup

**1. Clone and enter the api folder**
```bash
git clone https://github.com/MicaelVR04/ThreatScope.git
cd ThreatScope/api
```

**2. Create a virtual environment**
```bash
python3.11 -m venv venv
source venv/bin/activate  # Mac/Linux
venv\Scripts\activate     # Windows
```

**3. Install dependencies**
```bash
pip install -r requirements.txt
```

**4. Create your .env file**
```bash
echo "DATABASE_URL=sqlite:///./threatscope.db" > .env
```

**5. Run the API**
```bash
uvicorn main:app --reload
```

API is now running at `http://localhost:8000`

---

## Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/alerts` | Receive a new alert from the engine |
| `GET` | `/alerts` | Fetch alert history with filters and pagination |
| `GET` | `/alerts/summary` | Get alert counts by severity |
| `GET` | `/alerts/stats` | Get alert counts by attack type |
| `DELETE` | `/alerts` | Clear all alerts (demo reset) |
| `GET` | `/health` | Health check |
| `WS` | `/ws` | WebSocket for real-time alert streaming |

Interactive docs available at: `http://localhost:8000/docs`

---

## API Reference

### POST /alerts
Receives a new alert from the detection engine. Saves it to the database and broadcasts it to all connected dashboards.

**Request body:**
```json
{
  "type": "PORT_SCAN",
  "src_ip": "192.168.1.100",
  "dst_ip": "192.168.1.1",
  "severity": "HIGH",
  "message": "Port scan detected from 192.168.1.100",
  "timestamp": "2026-05-14T00:00:00+00:00"
}
```

**Severity values:** `LOW` | `MEDIUM` | `HIGH`

**Response:**
```json
{
  "id": 1,
  "type": "PORT_SCAN",
  "src_ip": "192.168.1.100",
  "dst_ip": "192.168.1.1",
  "severity": "HIGH",
  "message": "Port scan detected from 192.168.1.100",
  "timestamp": "2026-05-14T00:00:00+00:00"
}
```

---

### GET /alerts
Returns alert history. Supports filtering by severity and pagination.

**Query parameters:**
| Parameter | Type | Default | Description |
|---|---|---|---|
| `severity` | string | null | Filter by `LOW`, `MEDIUM`, or `HIGH` |
| `limit` | int | 50 | Max alerts to return (max 200) |
| `offset` | int | 0 | Alerts to skip for pagination |

**Example:**
```
GET /alerts?severity=HIGH&limit=10&offset=0
```

---

### GET /alerts/summary
Returns total alert counts grouped by severity. Used for the dashboard header cards.

**Response:**
```json
{
  "total": 42,
  "high": 15,
  "medium": 20,
  "low": 7
}
```

---

### GET /alerts/stats
Returns alert counts grouped by attack type. Used for dashboard charts.

**Response:**
```json
[
  { "type": "PORT_SCAN", "count": 25 },
  { "type": "SYN_FLOOD", "count": 12 },
  { "type": "PING_SWEEP", "count": 5 }
]
```

---

### DELETE /alerts
Clears all alerts from the database. Useful for resetting between demos.

**Response:**
```json
{ "message": "All alerts cleared" }
```

---

### WS /ws
Dashboard connects here to receive real-time alerts. Every time the engine posts a new alert, it is immediately pushed to all connected clients as JSON.

**Connection:**
```javascript
const ws = new WebSocket("ws://localhost:8000/ws");
ws.onmessage = (event) => {
  const alert = JSON.parse(event.data);
  console.log(alert);
};
```

---

## Rate Limiting

The `POST /alerts` endpoint is limited to **60 requests per minute per IP**. This protects the API against alert flooding. Exceeding the limit returns `429 Too Many Requests`.

---

## Running Tests

```bash
pip install pytest httpx
pytest tests/test_api.py -v
```

Expected output:
```
tests/test_api.py::TestHealthCheck::test_health_returns_ok PASSED
tests/test_api.py::TestCreateAlert::test_create_valid_high_alert PASSED
tests/test_api.py::TestCreateAlert::test_reject_invalid_severity PASSED
...
```

---

## Docker

Build and run the API container:
```bash
docker build -t threatscope-api .
docker run -p 8000:8000 threatscope-api
```

Or run the full stack with docker-compose from the project root:
```bash
docker-compose up
```

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `sqlite:///./threatscope.db` | Path to the SQLite database |

---

## Design Decisions

**Why SQLite?**
SQLite is zero-config and perfect for a demo environment. If this system were deployed across an enterprise network with multiple API instances, the database would be migrated to PostgreSQL to support concurrent writes.

**Why WebSockets over polling?**
Polling would require the dashboard to ask "any new alerts?" every second. WebSockets keep the connection open and push data the instant it arrives — critical for a real-time security dashboard.

**Why rate limiting on POST /alerts?**
Ironic for a NIDS, but the API itself needs to be protected. A compromised machine on the network could flood the API with fake alerts. Rate limiting prevents that.

**Why separate files?**
Separation of concerns. `models.py` only knows about data structure. `database.py` only knows about SQLite. `websocket.py` only knows about connections. `main.py` wires them together. This means any layer can be swapped without touching the others.
