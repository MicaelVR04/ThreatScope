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
- Continuous packet monitoring through a managed local sensor service
- Authenticated sensor heartbeat and dashboard start/stop controls
- Verified assessment windows that require real packet activity

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
SUPABASE_RUNTIME_STATE_TABLE=runtime_state
SUPABASE_SCAN_STATE_TABLE=sensor_scan_state

VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-or-publishable-key
```

Do not commit `.env`. The service-role key is backend-only and must not be exposed in frontend code.

Useful demo settings:

```bash
API_URL=http://localhost:8000/alerts
API_BASE_URL=http://localhost:8000
ENGINE_API_KEY=generate-a-long-random-value
MONITORING_DEFAULT_ENABLED=true
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

4. Run the private runtime-state migration:

```text
supabase/runtime_state_schema.sql
```

5. Run the sensor enrollment schema, followed by the multi-user migration:

```text
supabase/sensor_enrollment_schema.sql
supabase/multi_user_sensor_schema.sql
```

The alerts policy permits each signed-in user to read only their own rows.
Anonymous visitors cannot read alerts. Sensor credentials, heartbeat metadata,
and scan state have no browser access; only the backend service role can use
those tables. Database foreign keys also enforce that an alert's sensor belongs
to the same user as the alert.

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

Python 3.11 or newer is recommended. Python 3.10 is the minimum supported
version for the API and sensor dependencies.

API:

```bash
cd api
python3.11 -m venv .venv
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

### One-Time Sensor Setup (macOS)

Only the person responsible for the monitored network installs the sensor.
Regular dashboard users do not need it. Administrator access is requested once
because macOS protects packet-capture access.

End-user setup does not require Terminal:

1. Sign in and open **Sensor installation** in the dashboard.
2. Download and unzip **ThreatScope Sensor Setup**.
3. Generate a one-time installation code and paste it into the setup app.
4. Approve the normal macOS administrator prompt.
5. Wait for **Sensor connected**, then return to the dashboard.

The school-project build is ad-hoc signed, but it is not signed with an Apple
Developer ID or notarized. On first launch, macOS may require **System Settings
→ Privacy & Security → Open Anyway**. No command is needed.
The setup app installs a self-contained sensor and registers the root-owned
`launchd` service. It starts at boot, reconnects automatically, and is
controlled from the dashboard.

To remove it, reopen **ThreatScope Sensor Setup**, choose **Remove Sensor**, and
approve the macOS prompt. The dashboard's **Remove access** action immediately
revokes a missing or unavailable Mac.

The command-line scripts remain available for project developers and recovery:

```bash
sudo ./scripts/control_sensor_macos.sh status
sudo ./scripts/control_sensor_macos.sh stop
sudo ./scripts/control_sensor_macos.sh disable
sudo ./scripts/control_sensor_macos.sh enable
sudo tail -f /var/log/threatscope-sensor.log
sudo ./scripts/uninstall_sensor_macos.sh
```

The dashboard's **Stop monitoring** control pauses packet capture while leaving
the service online. The `disable` command stops the entire service and prevents
it from starting after a reboot. The sensor can be inspected in Activity
Monitor as a Python background process; its command line points to
`engine/sensor.py`.

The service inspects packets in memory and sends compact alerts plus heartbeat
status to the API. It does not store or upload raw packet captures. If the API
temporarily becomes unavailable, the sensor keeps its last monitoring setting
and reconnects automatically.

Set `NETWORK_INTERFACE` in `.env` if the active interface is not `en0`.

### Building the Project Installer

The installer is built by the project team, not by end users. See
`installer/macos/README.md`. The generated ZIP is intentionally ignored by Git
and should be published as a GitHub Release asset. Set
`VITE_SENSOR_INSTALLER_URL` to that asset URL before deploying the dashboard.

## Free Holberton Staging Deployment

The repository includes `render.yaml` for a no-cost staging deployment:

- Render static site for the React dashboard
- Render free Python web service for FastAPI
- Existing Supabase project for authentication, alerts, realtime, and runtime state
- Existing Groq key for cloud AI analysis

The generated Render hostnames are connected automatically. Follow
`docs/free-staging-deployment.md` for the exact secret-entry, Supabase, sensor,
and demo verification steps.

This is a presentation environment, not a commercial production tier. Render
free web services sleep after inactivity and can take about a minute to wake.
Pre-warm the API before a meeting. Account-level tenant isolation and revocable
per-sensor credentials are implemented. A public commercial release still
needs notarized installers, operational monitoring, backups, organization
roles, and paid always-on infrastructure.

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

AI Analysis follows the latest assessment window, so a secure assessment does
not summarize unrelated historical alerts. Signed-in users can remove their
own stored test data from **Alert History > Clear alert history** without
deleting another user's rows.

The shared demo uses Groq cloud AI:

```bash
AI_PROVIDER=openai
OPENAI_API_KEY=your-api-key
OPENAI_MODEL=qwen/qwen3.6-27b
OPENAI_BASE_URL=https://api.groq.com/openai/v1
```

Keep the API key server-side in `.env`. Do not expose it in dashboard code.

## Continuous Monitoring And Assessments

Each account can enroll multiple sensors. The dashboard device selector scopes
alerts, statistics, assessments, monitoring controls, schedules, and AI analysis
to one owned device. Each sensor monitors packets continuously and persists its
own control and assessment state across API restarts.

An assessment records both alert and packet-count deltas. The dashboard only
reports **No Known Threats Detected** when the sensor stayed online, inspected
at least one packet, and no packet matched the four enabled detection rules. An
offline sensor or an empty capture window never produces that result, and the
result is not a guarantee against attack types ThreatScope does not detect.

## Security Configuration

For a shared demo or deployment, keep `ALLOW_INSECURE_LOCAL_DEV=false`. The
legacy demo traffic script uses these server-side values:

```bash
ENGINE_API_KEY=a_long_random_value
SENSOR_OWNER_USER_ID=the_demo_users_supabase_uuid
```

Dashboard API requests require a valid Supabase access token with the expected
issuer, audience, and UUID subject. Legacy HS256 projects also require
`SUPABASE_JWT_SECRET`; asymmetric projects use Supabase's public JWKS endpoint.

Normal installed sensors do not use `ENGINE_API_KEY` or
`SENSOR_OWNER_USER_ID`. A one-time code binds each installation to the signed-in
user, and the sensor receives a unique revocable credential. Ownership is
checked in API queries and database constraints; browser alert reads also use
RLS. `ENGINE_API_KEY` and `SENSOR_OWNER_USER_ID` remain only for deterministic
team demo traffic and must never be exposed to the browser or installer.

## Tests

Engine tests:

```bash
cd engine
python -m pytest tests/ -v
```

API tests:

```bash
cd api
python -m pytest -v
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
