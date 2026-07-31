# ThreatScope Supabase Migration

This project is moving to Supabase in phases so we keep the packet capture engine stable while replacing the current SQLite and custom realtime stack.

## Goals

1. Keep the Scapy engine unchanged for now.
2. Replace SQLite with Supabase Postgres.
3. Replace the custom dashboard WebSocket flow with Supabase Realtime.
4. Keep FastAPI as the alert ingestion layer during the first migration pass.

## Phase Order

### Phase 1 — Supabase project and schema

Create a Supabase project and run the SQL in:

`supabase/alerts_schema.sql`

Then apply `supabase/runtime_state_schema.sql`,
`supabase/sensor_enrollment_schema.sql`, and
`supabase/multi_user_sensor_schema.sql` in that order.

This creates:

- `public.alerts`
- indexes for the existing query patterns
- a read policy for dashboard access
- a Realtime publication for `alerts`

### Phase 2 — Backend writes to Supabase

Change FastAPI so:

- `POST /alerts` inserts into Supabase instead of SQLite
- `GET /alerts`, `/alerts/summary`, and `/alerts/stats` read from Supabase
- the engine still posts to FastAPI, unchanged

Use the Supabase Python client from the backend only with the service-role key.

### Phase 3 — Dashboard reads from Supabase Realtime

Change the dashboard so:

- it fetches alert history from Supabase instead of FastAPI
- it subscribes to `postgres_changes` on `public.alerts`
- the current custom WebSocket hook can be removed after validation

Use the publishable/anon key in the frontend, never the service-role key.

## Required Env Vars

Add these once the Supabase project exists:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-publishable-or-anon-key
SUPABASE_ALERTS_TABLE=alerts
SUPABASE_SCAN_STATE_TABLE=sensor_scan_state
```

## Security Notes

- Backend only: `SUPABASE_SERVICE_ROLE_KEY`
- Frontend only: `VITE_SUPABASE_ANON_KEY`
- Do not put the service-role key into any browser code.

Supabase Realtime and browser reads should be protected with Row Level Security.

## Team Split

### Engine teammate

- Keep `engine/` stable during migration.
- Verify alerts still post to FastAPI after backend changes.
- Retest `demo_traffic.py` after every backend migration step.

### API teammate

- Own the SQLite -> Supabase backend swap.
- Add Supabase client config and repository functions.
- Preserve the current API contract so the engine does not break.

### Dashboard teammate

- Own the FastAPI/WebSocket -> Supabase client migration.
- Move alert history, summary, and stats reads to Supabase.
- Replace the current WebSocket hook with Supabase Realtime subscriptions.

## Recommended Rollout

1. Create Supabase project.
2. Apply schema SQL.
3. Add the new env vars locally.
4. Migrate FastAPI reads/writes first.
5. Verify current dashboard still works through FastAPI.
6. Migrate dashboard to Supabase Realtime.
7. Remove old SQLite and custom WebSocket code only after validation.
