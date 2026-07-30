# ThreatScope

[Live dashboard](https://threatscope-dashboard.onrender.com/) · [Development branch](https://github.com/MicaelVR04/ThreatScope/tree/dev)

ThreatScope is a real-time Network Intrusion Detection System built for Holberton Demo Day. It continuously monitors packet activity, applies deterministic detection rules, and translates suspicious behavior into live, plain-English alerts.

It is designed as a practical MVP for home networks and small IT teams. The project demonstrates a complete monitoring pipeline, from local packet capture through authenticated cloud storage and a live dashboard.

## What it detects

ThreatScope currently detects four focused network behaviors:

| Detection | Plain-English meaning | Typical severity |
| --- | --- | --- |
| `PING_SWEEP` | One device checks many hosts to find active systems. | Low |
| `PORT_SCAN` | A device probes services or ports on a target. | Medium |
| `ARP_SPOOF` | Conflicting ARP traffic may indicate local-network impersonation. | Medium |
| `SYN_FLOOD` | Many incomplete connection attempts may indicate denial-of-service activity. | High |

This is intentionally focused coverage, not a claim to detect every network attack. The dashboard presents a plain-English explanation and risk level while retaining technical evidence for deeper investigation.

## How it works

```text
macOS or Windows sensor (Python + Scapy)
        |
        v
Deterministic detection rules
        |
        v
FastAPI validation and ownership checks
        |
        v
Supabase Auth + Postgres + Row-Level Security
        |
        v
FastAPI WebSocket updates -> React dashboard
```

The rules create alerts. Cloud AI is advisory only: it summarizes stored evidence, identifies possible patterns, and suggests rule-tuning ideas. It never replaces the rule engine.

## Current capabilities

- Continuous packet monitoring through a managed macOS or Windows sensor service.
- Graphical sensor installation with one-time enrollment codes; no Terminal is required for normal setup.
- Start, pause, and scheduled monitoring controls from the dashboard.
- Live packet-activity pulse and real-time alert delivery through FastAPI WebSockets.
- Account-scoped sensors, alerts, assessments, and history.
- Supabase authentication, Postgres storage, and row-level security for browser data access.
- Plain-English alert labels alongside technical identifiers and severity.
- Groq-hosted cloud AI diagnostics using `qwen/qwen3.6-27b`.
- A deterministic four-scenario demo path for repeatable presentations.

## Live demo

Open the [ThreatScope dashboard](https://threatscope-dashboard.onrender.com/), sign in, and use **Sensor Setup** to enroll a macOS or Windows device.

The staging environment uses Render's free tier. Its API can sleep after inactivity, so the first request may take up to a minute to respond. This is appropriate for the Demo Day environment, not a production service-level guarantee.

## Local development

```bash
git clone --branch dev https://github.com/MicaelVR04/ThreatScope.git
cd ThreatScope
cp .env.example .env
```

Start the API:

```bash
cd api
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Start the dashboard in another terminal:

```bash
cd dashboard
npm install
npm run dev
```

For the full environment-variable reference, deployment setup, and sensor installer details, see [`.env.example`](.env.example), [`docs/free-staging-deployment.md`](docs/free-staging-deployment.md), [`installer/macos/README.md`](installer/macos/README.md), and [`installer/windows/README.md`](installer/windows/README.md).

## Demo traffic

The demo script sends crafted packets through the real detection and alert-ingestion path. It does not insert prewritten dashboard records.

```bash
cd engine
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

python demo_traffic.py port-scan
python demo_traffic.py ping-sweep
python demo_traffic.py syn-flood
python demo_traffic.py arp-spoof
```

For a live detection demo, use the installed sensor. The legacy demo traffic path also requires the server-side variables documented in `.env.example`; never expose those values in the dashboard or installer.

## Technical choices

- **Scapy:** exposes packet-level behavior and supports transparent, tunable detection rules instead of black-box verdicts.
- **FastAPI:** validates sensor traffic and provides a focused API plus WebSocket update path.
- **Supabase:** combines managed authentication, Postgres, and row-level security to keep each account's browser-visible data isolated.
- **React + Vite:** provides a responsive dashboard for monitoring, assessment, history, and device management.
- **Groq:** makes advisory AI analysis available in staging without requiring a local model on every user's machine.

## Security and scope

- The sensor processes packets in memory and sends compact alerts and heartbeat status. It does not upload raw packet captures.
- Enrolled sensors use unique, revocable credentials. A one-time enrollment code binds a sensor to the signed-in account.
- Browser alert reads are restricted by Supabase Row-Level Security; the API also verifies ownership before returning account data.
- The project is a Demo Day MVP. A public commercial release would still need Apple notarization, Windows code signing, always-on infrastructure, backups, organization roles, operational monitoring, broader detection coverage, and a formal incident-response model.

## Tests

```bash
cd engine && python -m pytest tests/ -v
cd api && python -m pytest -v
cd dashboard && npm run build
```

## Team workflow

The active team branch is [`dev`](https://github.com/MicaelVR04/ThreatScope/tree/dev). `main` is reserved for the final release state.
