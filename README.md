# ThreatScope

ThreatScope is a real-time Network Intrusion Detection System built for Holberton Demo Day. It captures network traffic with a Python/Scapy engine, detects suspicious behavior with rule-based signatures, sends alerts through a FastAPI ingestion API, stores alerts in Supabase Postgres, and displays live security activity in a React dashboard.

The project is designed to show a complete security monitoring pipeline:

```text
Network traffic or demo packets
        |
        v
Python Scapy detection engine
        |
        v
FastAPI POST /alerts ingestion API
        |
        v
Supabase Postgres alerts table
        |
        v
React dashboard with Supabase Realtime
```

## Current Status

The main team branch is `dev`.

Working features:

- Live alert ingestion through FastAPI
- Supabase-backed alert storage
- Dashboard reads alerts directly from Supabase
- Dashboard receives live updates through Supabase Realtime
- Summary cards, charts, and alert history update from real alert data
- Deterministic demo traffic triggers for repeatable presentations
- Engine detection rules for:
  - `PORT_SCAN`
  - `SYN_FLOOD`
  - `PING_SWEEP`
  - `ARP_SPOOF`

The ARP spoof rule is a real rule in the engine, not only a simulated dashboard event. It watches for repeated conflicting ARP replies where multiple MAC addresses claim the same IP address.

## Tech Stack

| Layer | Technology |
| --- | --- |
| Packet capture and detection | Python, Scapy |
| Ingestion API | FastAPI, Pydantic, Uvicorn |
| Database and realtime | Supabase Postgres, Supabase Realtime |
| Dashboard | React, Vite, Supabase JS, Recharts |
| Local orchestration | Docker Compose |
| Tests | Pytest |

## Repository Structure

```text
ThreatScope/
├── api/                 # FastAPI alert ingestion API
├── dashboard/           # React/Vite dashboard
├── engine/              # Scapy capture engine and detection rules
├── supabase/            # Supabase SQL schema
├── docs/                # Architecture and migration notes
├── docker-compose.yml   # Local multi-service stack
├── .env.example         # Safe environment variable template
└── README.md
```

## Environment Setup

Create a local `.env` from the safe template:

```bash
cp .env.example .env
```

Fill in the Supabase values in `.env`:

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_ALERTS_TABLE=alerts

VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-or-publishable-key
```

Do not commit `.env`. The service-role key is backend-only and must not be exposed in frontend code.

Useful demo settings:

```bash
DEMO_MODE=true
ALERT_COOLDOWN_SECONDS=60
ARP_ENTRY_TTL_SECONDS=300
ARP_SPOOF_CONFIRMATION_THRESHOLD=2
# ALLOWED_SUBNETS=192.168.12.0/24
```

Optional local AI diagnostics:

```bash
AI_PROVIDER=ollama
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=qwen2.5:7b
OLLAMA_TIMEOUT_SECONDS=45
OLLAMA_ALERT_LIMIT=20
```

Optional scheduled scan settings:

```bash
SCAN_WINDOW_SECONDS=8
SCAN_INTERVAL_MINUTES=5
```

## Supabase Setup

1. Create a Supabase project.
2. Open the Supabase SQL Editor.
3. Run the schema in:

```text
supabase/alerts_schema.sql
```

This creates the `alerts` table, indexes, read policy, and adds the table to the Supabase Realtime publication.

The dashboard needs read access through the anon or publishable key. The API uses the service-role key to insert alerts.

## Running Locally

Start from the project root:

```bash
git switch dev
git pull origin dev
```

### Option 1: Docker Compose

```bash
docker compose up --build
```

Services:

- API: `http://localhost:8000`
- API docs: `http://localhost:8000/docs`
- Dashboard: `http://localhost:5173`

### Option 2: Run Services Manually

API:

```bash
cd api
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Dashboard:

```bash
cd dashboard
npm install
npm run dev
```

Engine:

```bash
cd engine
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
sudo python capture.py
```

On macOS, live packet capture requires `sudo`. Set `NETWORK_INTERFACE` in `.env` if your active interface is not `en0`.

## Demo Traffic

The demo traffic script sends crafted packets through the real engine path:

```text
crafted packet -> engine rules -> alert sender -> FastAPI -> Supabase -> dashboard
```

Run from the `engine/` directory:

```bash
python demo_traffic.py port-scan
python demo_traffic.py ping-sweep
python demo_traffic.py syn-flood
python demo_traffic.py arp-spoof
```

For the main demo, the most useful pair is:

```bash
python demo_traffic.py port-scan
python demo_traffic.py arp-spoof
```

Then confirm:

- Supabase `alerts` table receives new rows
- Dashboard alert feed updates live
- Summary cards update
- Charts update
- Alert history shows the new events

## Local AI Diagnostics With Ollama

ThreatScope can use Ollama as a local developer-only analysis helper. The AI does not detect attacks and does not replace the rule engine. It summarizes recent stored alerts, describes likely patterns, and suggests rule-tuning ideas.

Install Ollama from:

```text
https://ollama.com/download
```

Pull the recommended model:

```bash
ollama pull qwen2.5:7b
```

Optional lighter fallback:

```bash
ollama pull llama3.2:3b
```

Start or test the model:

```bash
ollama run qwen2.5:7b
```

When the API and dashboard are running, log in to the dashboard and use the **AI Analysis** panel to analyze recent alerts. If Ollama is not running or the configured model is missing, the dashboard will show a friendly setup error.

For a clean presentation, clear older test alerts or set `OLLAMA_ALERT_LIMIT=4` so the AI only summarizes the latest four demo alerts. Historical simulated rows can make the AI describe older sources or severities that are not part of the current demo run.

To use a cloud AI provider instead of local Ollama, set:

```bash
AI_PROVIDER=openai
OPENAI_API_KEY=your-api-key
OPENAI_MODEL=gpt-4o-mini
OPENAI_BASE_URL=https://api.openai.com/v1
```

Keep the API key server-side in `.env`. Do not expose it in dashboard code.

## Scheduled Scans

The dashboard includes scan controls for running a scan now or scheduling scan windows every 5 or 10 minutes. During a scan window, ThreatScope watches for newly inserted alerts. If no new alerts appear, the dashboard reports **Network is secure**. If alerts arrive during the window, the dashboard reports that threats were detected and points users to the live feed.

The scan control is dashboard-friendly orchestration around the existing engine/API pipeline. The Python engine still owns packet analysis and alert generation.

## Security Configuration

For a shared demo or deployment, keep `ALLOW_INSECURE_LOCAL_DEV=false` and configure both server-side secrets in `.env`:

```bash
ENGINE_API_KEY=a_long_random_value
```

Dashboard API requests require a valid Supabase access token. For legacy HS256 Supabase projects, also set `SUPABASE_JWT_SECRET`; newer asymmetric-key projects are verified against the public JWKS endpoint using the existing `SUPABASE_URL`. The packet engine and `api/simulate.py` submit alerts with `X-Engine-Key`; this key must never be exposed to the browser. The demo reset endpoint uses the same internal key.

## Tests

Engine tests:

```bash
cd engine
python -m pytest tests/ -v
```

API tests:

```bash
cd api
python -m pytest tests/test_api.py -v
```

Dashboard build check:

```bash
cd dashboard
npm run build
```

## What We Have Built

For a project checkup, the short version is:

ThreatScope is now a working end-to-end intrusion detection demo. The Python engine analyzes packets using rule-based detection, the API receives and validates alerts, Supabase stores them and pushes realtime updates, and the React dashboard shows live alert data with summary cards, charts, and history.

Key progress:

- Built a packet analysis engine with Scapy
- Added detection rules for port scans, SYN floods, ping sweeps, and ARP spoofing
- Added severity scoring for alerts
- Added false-positive tuning for ARP spoof detection
- Built a FastAPI ingestion layer
- Migrated storage from local-only SQLite toward Supabase Postgres
- Migrated dashboard realtime updates to Supabase Realtime
- Added deterministic demo traffic so the presentation does not depend on random network activity
- Verified the live pipeline from demo traffic to dashboard updates

## Checkup Demo Flow

Use this for a short Holberton progress meeting:

1. Start with the problem:
   - Networks generate too much traffic to inspect manually.
   - ThreatScope watches traffic and surfaces suspicious behavior as alerts.

2. Show the architecture:
   - Engine captures or receives packets.
   - Rules detect suspicious patterns.
   - API ingests alerts.
   - Supabase stores and streams alerts.
   - Dashboard shows the live monitoring view.

3. Show the dashboard:
   - Point out the live feed, severity cards, charts, and history.

4. Trigger a port scan demo:

```bash
cd engine
python demo_traffic.py port-scan
```

5. Trigger an ARP spoof demo:

```bash
python demo_traffic.py arp-spoof
```

6. Explain what is real:
   - The detection rules are implemented in the Python engine.
   - Demo traffic is crafted to reliably trigger those rules.
   - Live packet capture also works locally, but the deterministic triggers make the meeting reliable.

7. Close with next steps:
   - Run more real LAN validation with teammates.
   - Continue reducing false positives.
   - Polish dashboard presentation.
   - Finalize Demo Day script and documentation.

## Known Caveats

- Live capture on macOS requires `sudo`.
- Demo traffic uses crafted packets to reliably show the pipeline during presentations.
- The dashboard currently reads directly from Supabase and subscribes through Supabase Realtime.
- The FastAPI app still exposes older read and WebSocket endpoints, but the current dashboard path is Supabase-first.
- Supabase service-role keys must stay server-side only.
- `DEMO_MODE=true` is recommended for presentations to reduce noisy unrelated traffic.

## Branch Workflow

Use `dev` for team work:

```bash
git switch dev
git pull origin dev
```

Keep `main` reserved for the final demo-ready release.
