-- Privacy-conscious product usage metrics. We retain one aggregate activity row
-- per account and never store page names, financial data, IPs, or fingerprints.
create table if not exists public.user_activity (
  user_id uuid primary key references auth.users(id) on delete cascade,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  active_days integer not null default 1 check (active_days > 0),
  last_active_date date not null default current_date
);

alter table public.user_activity enable row level security;
revoke all on table public.user_activity from public, anon, authenticated;
grant select, insert, update, delete on table public.user_activity to service_role;

create index if not exists user_activity_last_seen_at_idx
  on public.user_activity (last_seen_at desc);

-- One row per user per active date keeps daily-active history accurate while
-- still avoiding routes, events, IP addresses, and other behavioral detail.
create table if not exists public.user_activity_days (
  user_id uuid not null references auth.users(id) on delete cascade,
  active_date date not null default current_date,
  last_seen_at timestamptz not null default now(),
  primary key (user_id, active_date)
);

alter table public.user_activity_days enable row level security;
revoke all on table public.user_activity_days from public, anon, authenticated;
grant select, insert, update, delete on table public.user_activity_days to service_role;

create index if not exists user_activity_days_active_date_idx
  on public.user_activity_days (active_date desc);

create or replace function public.record_user_activity(p_user_id uuid)
returns void
language sql
security definer
set search_path = pg_catalog, public
as $$
  insert into public.user_activity (user_id)
  values (p_user_id)
  on conflict (user_id) do update
  set last_seen_at = now(),
      active_days = public.user_activity.active_days +
        case when public.user_activity.last_active_date < current_date then 1 else 0 end,
      last_active_date = current_date;

  insert into public.user_activity_days (user_id)
  values (p_user_id)
  on conflict (user_id, active_date) do update
  set last_seen_at = now();
$$;

revoke execute on function public.record_user_activity(uuid) from public, anon, authenticated;
grant execute on function public.record_user_activity(uuid) to service_role;

create or replace function public.get_platform_usage_metrics()
returns jsonb
language sql
security definer
set search_path = pg_catalog, public, auth
as $$
  with days as (
    select generate_series(current_date - 13, current_date, interval '1 day')::date as day
  ), daily as (
    select
      days.day,
      (select count(*) from auth.users u where u.created_at >= days.day and u.created_at < days.day + 1)::integer as new_users,
      (select count(*) from public.user_activity_days a where a.active_date = days.day)::integer as active_users
    from days
  )
  select jsonb_build_object(
    'generated_at', now(),
    'total_users', (select count(*) from auth.users),
    'new_users_24h', (select count(*) from auth.users where created_at >= now() - interval '24 hours'),
    'new_users_7d', (select count(*) from auth.users where created_at >= now() - interval '7 days'),
    'new_users_30d', (select count(*) from auth.users where created_at >= now() - interval '30 days'),
    'live_users_5m', (select count(*) from public.user_activity where last_seen_at >= now() - interval '5 minutes'),
    'active_users_24h', (select count(*) from public.user_activity where last_seen_at >= now() - interval '24 hours'),
    'active_users_7d', (select count(*) from public.user_activity where last_seen_at >= now() - interval '7 days'),
    'active_users_30d', (select count(*) from public.user_activity where last_seen_at >= now() - interval '30 days'),
    'returning_users_30d', (
      select count(*) from public.user_activity a
      join auth.users u on u.id = a.user_id
      where a.last_seen_at >= now() - interval '30 days'
        and u.created_at < now() - interval '30 days'
    ),
    'daily', (select coalesce(jsonb_agg(jsonb_build_object('date', day, 'new_users', new_users, 'active_users', active_users) order by day), '[]'::jsonb) from daily)
  );
$$;

revoke execute on function public.get_platform_usage_metrics() from public, anon, authenticated;
grant execute on function public.get_platform_usage_metrics() to service_role;

comment on table public.user_activity is
  'Minimal per-account activity rollup for private platform adoption metrics.';

comment on table public.user_activity_days is
  'Privacy-minimal daily active-user rollup; one row per account per active date.';
