-- ThreatScope multi-user sensor migration.
-- Run once after alerts_schema.sql and sensor_enrollment_schema.sql.

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
          and conname = 'sensors_packet_count_check'
    ) then
        alter table public.sensors
            add constraint sensors_packet_count_check check (packet_count >= 0);
    end if;
    if not exists (
        select 1 from pg_constraint
        where conrelid = 'public.sensors'::regclass
          and conname = 'sensors_interface_length_check'
    ) then
        alter table public.sensors
            add constraint sensors_interface_length_check
            check (interface is null or char_length(interface) between 1 and 64);
    end if;
    if not exists (
        select 1 from pg_constraint
        where conrelid = 'public.sensors'::regclass
          and conname = 'sensors_last_error_length_check'
    ) then
        alter table public.sensors
            add constraint sensors_last_error_length_check
            check (last_error is null or char_length(last_error) <= 512);
    end if;
    if not exists (
        select 1 from pg_constraint
        where conrelid = 'public.sensors'::regclass
          and conname = 'sensors_id_owner_unique'
    ) then
        alter table public.sensors
            add constraint sensors_id_owner_unique unique (id, owner_id);
    end if;
end $$;

alter table public.alerts
    add column if not exists sensor_id uuid;

do $$
begin
    if not exists (
        select 1 from pg_constraint
        where conrelid = 'public.alerts'::regclass
          and conname = 'alerts_sensor_owner_fk'
    ) then
        alter table public.alerts
            add constraint alerts_sensor_owner_fk
            foreign key (sensor_id, user_id)
            references public.sensors (id, owner_id)
            on delete set null (sensor_id);
    end if;
end $$;

create index if not exists alerts_sensor_id_idx
    on public.alerts (sensor_id, timestamp desc);

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

create index if not exists sensor_scan_state_owner_idx
    on public.sensor_scan_state (owner_id);

alter table public.sensor_scan_state enable row level security;
revoke all on public.sensor_scan_state from anon, authenticated, public;
grant all on public.sensor_scan_state to service_role;

-- Sensors remain private API-only records. Browser accounts cannot read or mutate
-- credentials, heartbeat metadata, or scan controls directly through PostgREST.
alter table public.sensors enable row level security;
revoke all on public.sensors from anon, authenticated, public;
grant all on public.sensors to service_role;

-- Replace the enrollment exchange with an owner-serialized, quota-aware version.
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
