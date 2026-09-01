-- Read-only household access and an append-only, privacy-safe activity ledger.

alter table public.ledger_members drop constraint if exists ledger_members_role_check;
alter table public.ledger_members add constraint ledger_members_role_check
  check (role in ('owner', 'editor', 'viewer'));

alter table public.ledger_invitations drop constraint if exists ledger_invitations_role_check;
alter table public.ledger_invitations add constraint ledger_invitations_role_check
  check (role in ('editor', 'viewer'));

create table if not exists public.ledger_activity_events (
  id bigint generated always as identity primary key,
  ledger_id uuid not null references public.ledgers(id) on delete cascade,
  actor_user_id uuid references public.profiles(id) on delete set null,
  event_type text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create index if not exists ledger_activity_events_timeline_idx
  on public.ledger_activity_events (ledger_id, occurred_at desc);

alter table public.ledger_activity_events enable row level security;
create policy ledger_activity_member_select on public.ledger_activity_events
  for select to authenticated using (public.can_access_ledger(ledger_id));
grant select on public.ledger_activity_events to authenticated;
revoke insert, update, delete on public.ledger_activity_events from public, anon, authenticated;

create or replace function public.capture_ledger_activity()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_row jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  v_ledger_id uuid;
  v_owner_id uuid;
  v_entity_id uuid;
begin
  v_ledger_id := nullif(v_row ->> 'ledger_id', '')::uuid;
  v_owner_id := nullif(v_row ->> 'user_id', '')::uuid;
  v_entity_id := nullif(v_row ->> 'id', '')::uuid;

  if v_ledger_id is null and v_owner_id is not null then
    select id into v_ledger_id from public.ledgers where owner_user_id = v_owner_id;
  end if;
  if v_ledger_id is null then return coalesce(new, old); end if;

  insert into public.ledger_activity_events (
    ledger_id, actor_user_id, event_type, entity_type, entity_id, metadata
  ) values (
    v_ledger_id,
    auth.uid(),
    lower(tg_op) || '.' || tg_table_name,
    tg_table_name,
    v_entity_id,
    jsonb_build_object('operation', lower(tg_op))
  );
  return coalesce(new, old);
end;
$$;

revoke all on function public.capture_ledger_activity() from public, anon, authenticated;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'wallets', 'categories', 'transactions', 'budgets', 'recurring_rules',
    'receipts', 'ledger_members', 'ledger_invitations'
  ] loop
    execute format('drop trigger if exists capture_ledger_activity on public.%I', table_name);
    execute format(
      'create trigger capture_ledger_activity after insert or update or delete on public.%I for each row execute function public.capture_ledger_activity()',
      table_name
    );
  end loop;
end;
$$;

create or replace function public.create_ledger_invitation(
  p_email text,
  p_role text default 'editor'
)
returns table (invitation_id uuid, invitation_token text, ledger_name text)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_ledger_id uuid := public.current_ledger_id();
  v_email text := lower(trim(p_email));
  v_token text := encode(extensions.gen_random_bytes(32), 'hex');
begin
  if not public.is_ledger_owner(v_ledger_id) then raise exception 'Only the ledger owner can invite family members'; end if;
  if p_role not in ('editor', 'viewer') then raise exception 'Unsupported family role'; end if;
  if v_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then raise exception 'Enter a valid email address'; end if;
  if v_email = lower(coalesce(auth.jwt() ->> 'email', '')) then raise exception 'You are already the owner of this ledger'; end if;
  if exists (select 1 from public.ledger_invitations where invited_by = auth.uid() and created_at > now() - interval '30 seconds') then raise exception 'Wait before sending another invitation'; end if;
  if (select count(*) from public.ledger_invitations where invited_by = auth.uid() and created_at > now() - interval '1 hour') >= 20 then raise exception 'Invitation limit reached'; end if;

  update public.ledger_invitations set revoked_at = now()
  where ledger_id = v_ledger_id and email = v_email and accepted_at is null and revoked_at is null;
  insert into public.ledger_invitations (ledger_id, email, role, token_hash, invited_by, expires_at)
  values (v_ledger_id, v_email, p_role, extensions.digest(v_token, 'sha256'), auth.uid(), now() + interval '7 days')
  returning id into invitation_id;
  invitation_token := v_token;
  select name into ledger_name from public.ledgers where id = v_ledger_id;
  return next;
end;
$$;

revoke all on function public.create_ledger_invitation(text, text) from public;
grant execute on function public.create_ledger_invitation(text, text) to authenticated;
