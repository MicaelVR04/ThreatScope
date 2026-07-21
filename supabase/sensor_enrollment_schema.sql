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
    revoked_at timestamptz
);

create index if not exists sensor_enrollment_owner_idx
    on public.sensor_enrollment_codes (owner_id, created_at desc);
create unique index if not exists sensor_enrollment_one_active_per_owner
    on public.sensor_enrollment_codes (owner_id) where used_at is null;
create index if not exists sensors_owner_idx
    on public.sensors (owner_id, created_at desc);

alter table public.sensor_enrollment_codes enable row level security;
alter table public.sensors enable row level security;

revoke all on public.sensor_enrollment_codes from anon, authenticated, public;
revoke all on public.sensors from anon, authenticated, public;
grant all on public.sensor_enrollment_codes to service_role;
grant all on public.sensors to service_role;

-- The service-role-only function performs the one-time exchange atomically.
create or replace function public.consume_sensor_enrollment(
    p_code_hash text,
    p_sensor_id uuid,
    p_name text,
    p_platform text,
    p_version text,
    p_token_hash text
)
returns table (id uuid, owner_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
    claimed public.sensor_enrollment_codes%rowtype;
begin
    update public.sensor_enrollment_codes
       set used_at = timezone('utc', now())
     where code_hash = p_code_hash
       and used_at is null
       and expires_at > timezone('utc', now())
    returning * into claimed;

    if claimed.id is null then
        return;
    end if;

    insert into public.sensors (
        id, owner_id, name, platform, version, token_hash
    ) values (
        p_sensor_id, claimed.owner_id, p_name, p_platform, p_version, p_token_hash
    );

    return query select p_sensor_id, claimed.owner_id;
end;
$$;

revoke all on function public.consume_sensor_enrollment(text, uuid, text, text, text, text)
    from public, anon, authenticated;
grant execute on function public.consume_sensor_enrollment(text, uuid, text, text, text, text)
    to service_role;
