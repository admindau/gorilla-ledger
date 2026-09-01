-- Distributed authentication throttling and scalable account lookup.
-- These functions are service-role only; no email or IP address is persisted
-- in the limiter table because callers submit a keyed, one-way digest.

create table if not exists public.auth_request_rate_limits (
  bucket_hash text primary key check (char_length(bucket_hash) = 64),
  request_count integer not null check (request_count > 0),
  window_started_at timestamptz not null,
  expires_at timestamptz not null
);

create index if not exists auth_request_rate_limits_expires_at_idx
  on public.auth_request_rate_limits (expires_at);

alter table public.auth_request_rate_limits enable row level security;
revoke all on table public.auth_request_rate_limits from public, anon, authenticated;

create or replace function public.consume_auth_rate_limit(
  p_bucket_hash text,
  p_window_seconds integer,
  p_max_requests integer
)
returns table (allowed boolean, remaining integer, retry_after_seconds integer)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_count integer;
  v_expires_at timestamptz;
begin
  if p_bucket_hash !~ '^[0-9a-f]{64}$'
    or p_window_seconds not between 10 and 86400
    or p_max_requests not between 1 and 1000 then
    raise exception 'Invalid rate-limit parameters';
  end if;

  insert into public.auth_request_rate_limits as limiter (
    bucket_hash, request_count, window_started_at, expires_at
  ) values (
    p_bucket_hash, 1, v_now, v_now + make_interval(secs => p_window_seconds)
  )
  on conflict (bucket_hash) do update
  set request_count = case when limiter.expires_at <= v_now then 1 else limiter.request_count + 1 end,
      window_started_at = case when limiter.expires_at <= v_now then v_now else limiter.window_started_at end,
      expires_at = case
        when limiter.expires_at <= v_now then v_now + make_interval(secs => p_window_seconds)
        else limiter.expires_at
      end
  returning limiter.request_count, limiter.expires_at
    into v_count, v_expires_at;

  -- Bounded retention; the expiry index keeps this cleanup inexpensive.
  delete from public.auth_request_rate_limits
  where expires_at < v_now - interval '1 day';

  return query select
    v_count <= p_max_requests,
    greatest(0, p_max_requests - v_count),
    case when v_count <= p_max_requests then 0
      else greatest(1, ceil(extract(epoch from (v_expires_at - v_now)))::integer)
    end;
end;
$$;

create or replace function public.auth_user_exists(p_email text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select exists (
    select 1 from auth.users
    where lower(email) = lower(trim(p_email))
  );
$$;

revoke all on function public.consume_auth_rate_limit(text, integer, integer) from public, anon, authenticated;
revoke all on function public.auth_user_exists(text) from public, anon, authenticated;
grant execute on function public.consume_auth_rate_limit(text, integer, integer) to service_role;
grant execute on function public.auth_user_exists(text) to service_role;
