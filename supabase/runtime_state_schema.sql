-- Private API runtime state for restart recovery.
-- Apply this once in the Supabase SQL Editor.

create table if not exists public.runtime_state (
    key text primary key,
    value jsonb not null,
    updated_at timestamptz not null default timezone('utc', now())
);

alter table public.runtime_state enable row level security;

revoke all on public.runtime_state from anon;
revoke all on public.runtime_state from authenticated;
grant select, insert, update, delete on public.runtime_state to service_role;

-- No client policy is intentional. The API service_role can bypass RLS.
