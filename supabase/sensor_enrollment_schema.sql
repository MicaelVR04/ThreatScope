-- ThreatScope private sensor enrollment tables.
-- Run once in the Supabase SQL Editor before enabling graphical enrollment.

create table if not exists public.sensor_enrollment_codes (
    id uuid primary key,
    owner_id uuid not null references auth.users(id) on delete cascade,
    code_hash text not null unique check (length(code_hash) = 64),
    expires_at timestamptz not null,
    used_at timestamptz,
    created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.sensors (
    id uuid primary key,
    owner_id uuid not null references auth.users(id) on delete cascade,
    name text not null check (char_length(name) between 1 and 64),
    platform text not null check (char_length(platform) between 1 and 32),
    version text not null check (char_length(version) between 1 and 32),
    token_hash text not null unique check (length(token_hash) = 64),
    created_at timestamptz not null default timezone('utc', now()),
    last_seen_at timestamptz,
    revoked_at timestamptz,
    desired_monitoring boolean not null default true,
    monitoring boolean not null default false,
    interface text check (interface is null or char_length(interface) between 1 and 64),
    packet_count bigint not null default 0 check (packet_count >= 0),
    last_error text check (last_error is null or char_length(last_error) <= 512),
    constraint sensors_id_owner_unique unique (id, owner_id)
);

-- Keep this schema safe to rerun against an earlier ThreatScope installation.
alter table public.sensors
    add column if not exists desired_monitoring boolean not null default true,
    add column if not exists monitoring boolean not null default false,
    add column if not exists interface text,
    add column if not exists packet_count bigint not null default 0,
    add column if not exists last_error text;

do $$
begin
    if not exists (
        select 1 from pg_constraint
        where conrelid = 'public.sensors'::regclass
          and conname = 'sensors_id_owner_unique'
    ) then
        alter table public.sensors
            add constraint sensors_id_owner_unique unique (id, owner_id);
    end if;
end $$;

create table if not exists public.sensor_scan_state (
    sensor_id uuid primary key,
    owner_id uuid not null,
    enabled boolean not null default false,
    interval_minutes smallint not null default 5 check (interval_minutes in (5, 10)),
    state text not null default 'idle'
        check (state in ('idle', 'running', 'threats_found', 'secure', 'no_data', 'sensor_offline')),
    message text not null default 'Scheduled assessments are off.'
        check (char_length(message) <= 512),
    last_started_at timestamptz,
    last_finished_at timestamptz,
    next_scan_at timestamptz,
    baseline_alert_count bigint not null default 0 check (baseline_alert_count >= 0),
    baseline_packet_count bigint not null default 0 check (baseline_packet_count >= 0),
    packets_analyzed bigint not null default 0 check (packets_analyzed >= 0),
    alerts_detected bigint not null default 0 check (alerts_detected >= 0),
    updated_at timestamptz not null default timezone('utc', now()),
    foreign key (sensor_id, owner_id)
        references public.sensors (id, owner_id) on delete cascade
);

create index if not exists sensor_enrollment_owner_idx
    on public.sensor_enrollment_codes (owner_id, created_at desc);
create unique index if not exists sensor_enrollment_one_active_per_owner
    on public.sensor_enrollment_codes (owner_id) where used_at is null;
create index if not exists sensors_owner_idx
    on public.sensors (owner_id, created_at desc);
create index if not exists sensor_scan_state_owner_idx
    on public.sensor_scan_state (owner_id);

alter table public.sensor_enrollment_codes enable row level security;
alter table public.sensors enable row level security;
alter table public.sensor_scan_state enable row level security;

revoke all on public.sensor_enrollment_codes from anon, authenticated, public;
revoke all on public.sensors from anon, authenticated, public;
revoke all on public.sensor_scan_state from anon, authenticated, public;
grant all on public.sensor_enrollment_codes to service_role;
grant all on public.sensors to service_role;
grant all on public.sensor_scan_state to service_role;

-- The service-role-only function performs the one-time exchange atomically.
drop function if exists public.consume_sensor_enrollment(text, uuid, text, text, text, text);
create or replace function public.consume_sensor_enrollment(
    p_code_hash text,
    p_sensor_id uuid,
    p_name text,
    p_platform text,
    p_version text,
    p_token_hash text,
    p_max_sensors integer
)
returns table (id uuid, owner_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
    claimed public.sensor_enrollment_codes%rowtype;
begin
    select enrollment.* into claimed
      from public.sensor_enrollment_codes as enrollment
     where enrollment.code_hash = p_code_hash
       and enrollment.used_at is null
       and enrollment.expires_at > pg_catalog.timezone('utc', pg_catalog.now())
     for update;

    if claimed.id is null then
        return;
    end if;

    -- Serialize enrollment per owner so concurrent exchanges cannot bypass quota.
    perform pg_catalog.pg_advisory_xact_lock(
        pg_catalog.hashtextextended(claimed.owner_id::text, 0)
    );
    if (
        select count(*)
        from public.sensors as sensor
        where sensor.owner_id = claimed.owner_id and sensor.revoked_at is null
    ) >= least(greatest(coalesce(p_max_sensors, 1), 1), 50) then
        return;
    end if;

    update public.sensor_enrollment_codes as enrollment
       set used_at = pg_catalog.timezone('utc', pg_catalog.now())
     where enrollment.id = claimed.id;

    insert into public.sensors (
        id, owner_id, name, platform, version, token_hash
    ) values (
        p_sensor_id, claimed.owner_id, p_name, p_platform, p_version, p_token_hash
    );

    return query select p_sensor_id, claimed.owner_id;
end;
$$;

revoke all on function public.consume_sensor_enrollment(text, uuid, text, text, text, text, integer)
    from public, anon, authenticated;
grant execute on function public.consume_sensor_enrollment(text, uuid, text, text, text, text, integer)
    to service_role;
