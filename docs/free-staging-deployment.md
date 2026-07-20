# Free Staging Deployment

This runbook deploys ThreatScope for the Holberton presentation without paid
infrastructure. It is a staging/demo configuration, not a public commercial
release.

## What Deploys

- `threatscope-dashboard`: Render static site
- `threatscope-api`: Render free Python web service
- Supabase: authentication, Postgres alerts, realtime, and private runtime state
- Groq: cloud AI diagnostics
- macOS sensor: remains on the monitored computer because cloud servers cannot
  capture packets from a presenter's local network

## Before Render

1. Merge the verified work into `dev` and push `dev` to GitHub.
2. In Supabase SQL Editor, run:

```text
supabase/alerts_schema.sql
supabase/runtime_state_schema.sql
```

3. Keep these values ready. Do not paste them into Git:

```text
Supabase project URL
Supabase service-role key
Supabase publishable/anon key
Groq API key
One long random ENGINE_API_KEY
Supabase user UUID for the account that owns the demo sensor
```

Generate the sensor key locally when needed:

```bash
openssl rand -hex 32
```

## Create The Render Blueprint

1. Sign in to Render and choose **New > Blueprint**.
2. Connect the ThreatScope GitHub repository.
3. Select the repository's root `render.yaml`.
4. Enter each value Render requests:

| Render variable | Value |
| --- | --- |
| `OPENAI_API_KEY` | Groq API key |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service-role key |
| `ENGINE_API_KEY` | The generated sensor key |
| `SENSOR_OWNER_USER_ID` | Demo account UUID from Supabase Authentication > Users |
| `VITE_SUPABASE_URL` | The same Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase publishable/anon key |

5. Wait for both services to report a successful deployment.

The Blueprint derives the API's HTTPS address and dashboard's allowed origin
from Render's generated hostnames. No Groq or service-role secret is included in
the browser build. The API also refuses to start if configured Supabase storage
is unavailable, preventing a hidden fallback to temporary cloud files.

The sensor owner setting keeps registered users from reading or controlling
another user's sensor. Existing alerts created before this migration have no
owner and will no longer appear. To keep old demo rows, assign them once in the
Supabase SQL Editor:

```sql
update public.alerts
set user_id = 'YOUR-DEMO-USER-UUID'
where user_id is null;
```

## Configure Supabase Login

In **Supabase > Authentication > URL Configuration**:

1. Set **Site URL** to the Render dashboard URL.
2. Add the following redirect URLs:

```text
https://YOUR-DASHBOARD.onrender.com/**
http://localhost:5173/**
```

For a real public registration flow, enable email confirmation and configure a
production mail provider. The demo may keep its existing test-user behavior.

## Point The Sensor At The Cloud API

On the Mac that monitors the demo network, update the local `.env`:

```bash
API_BASE_URL=https://YOUR-API.onrender.com
API_URL=https://YOUR-API.onrender.com/alerts
ENGINE_API_KEY=the_same_value_entered_in_Render
SENSOR_HEARTBEAT_INTERVAL_SECONDS=15
```

Then restart the installed sensor:

```bash
sudo ./scripts/control_sensor_macos.sh restart
```

Only the monitoring Mac installs the sensor. Dashboard-only viewers do not.

## Verify Before The Meeting

1. Wake the free API:

```bash
curl https://YOUR-API.onrender.com/health
```

2. Open the Render dashboard URL and sign in.
3. Confirm **Cloud API: online**, **Sensor: online**, and **Feed Live**.
4. Confirm the packet count increases while browsing the network.
5. Run **Assess now** and verify it completes with packet evidence.
6. Trigger one deterministic demo event:

```bash
cd engine
python demo_traffic.py port-scan
```

7. Confirm the alert appears live.
8. Run **Analyze recent alerts** and confirm Groq returns an advisory summary.
9. Stop and restart monitoring once to verify the controls.
10. In **Alert History**, clear the demo rows and confirm the dashboard returns
    to zero without affecting another account.

## Free-Tier Limits

Render's free API sleeps after 15 minutes without inbound HTTP or WebSocket
traffic and may take about one minute to wake. While the sensor is connected,
its legitimate heartbeat requests normally keep the API active. Local files on
the free API are not durable, which is why ThreatScope stores alerts and
runtime state in Supabase.

Before every presentation, wake the API manually and complete the verification
list above. Paid always-on hosting is a later production decision, not required
for the Holberton staging demo.

## Security Boundary

This staging setup uses one shared `ENGINE_API_KEY` for the team's sensor. Do
not distribute it publicly. A commercial release must replace it with
revocable, per-sensor enrollment credentials and scope alerts by organization
or user.
