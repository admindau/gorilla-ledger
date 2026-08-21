-- Household collaboration for Gorilla Ledger.
--
-- The existing financial tables retain their owner user_id for compatibility.
-- Access is granted through ledger_members, while created_by / updated_by retain
-- the identity of the family member who performed each change.

create extension if not exists pgcrypto;

create table if not exists public.ledgers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 80),
  owner_user_id uuid not null unique references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ledger_members (
  ledger_id uuid not null references public.ledgers(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('owner', 'editor')),
  email text,
  joined_at timestamptz not null default now(),
  primary key (ledger_id, user_id)
);

create table if not exists public.ledger_invitations (
  id uuid primary key default gen_random_uuid(),
  ledger_id uuid not null references public.ledgers(id) on delete cascade,
  email text not null,
  role text not null default 'editor' check (role = 'editor'),
  token_hash bytea not null unique,
  invited_by uuid not null references public.profiles(id) on delete restrict,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  check (email = lower(trim(email)))
);

create unique index if not exists ledger_invitations_one_pending_email_idx
  on public.ledger_invitations (ledger_id, email)
  where accepted_at is null and revoked_at is null;

alter table public.profiles
  add column if not exists active_ledger_id uuid references public.ledgers(id) on delete set null;

insert into public.ledgers (name, owner_user_id)
select
  case
    when nullif(trim(profile.full_name), '') is null then 'My Ledger'
    else left(trim(profile.full_name) || '''s Ledger', 80)
  end,
  profile.id
from public.profiles as profile
on conflict (owner_user_id) do nothing;

insert into public.ledger_members (ledger_id, user_id, role, email)
select ledger.id, ledger.owner_user_id, 'owner', lower(auth_user.email)
from public.ledgers as ledger
left join auth.users as auth_user on auth_user.id = ledger.owner_user_id
on conflict (ledger_id, user_id) do update set role = 'owner';

update public.profiles as profile
set active_ledger_id = ledger.id
from public.ledgers as ledger
where ledger.owner_user_id = profile.id
  and profile.active_ledger_id is null;

create or replace function public.bootstrap_personal_ledger()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_ledger_id uuid;
  v_email text;
begin
  insert into public.ledgers (name, owner_user_id)
  values (
    case when nullif(trim(new.full_name), '') is null then 'My Ledger' else left(trim(new.full_name) || '''s Ledger', 80) end,
    new.id
  )
  on conflict (owner_user_id) do update set updated_at = now()
  returning id into v_ledger_id;

  select lower(email) into v_email from auth.users where id = new.id;
  insert into public.ledger_members (ledger_id, user_id, role, email)
  values (v_ledger_id, new.id, 'owner', v_email)
  on conflict (ledger_id, user_id) do update set role = 'owner', email = excluded.email;

  update public.profiles set active_ledger_id = v_ledger_id where id = new.id;
  return new;
end;
$$;

drop trigger if exists profiles_bootstrap_personal_ledger on public.profiles;
create trigger profiles_bootstrap_personal_ledger
after insert on public.profiles
for each row execute function public.bootstrap_personal_ledger();

create or replace function public.current_ledger_id()
returns uuid
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select coalesce(
    (
      select profile.active_ledger_id
      from public.profiles as profile
      join public.ledger_members as member
        on member.ledger_id = profile.active_ledger_id
       and member.user_id = profile.id
      where profile.id = auth.uid()
    ),
    (
      select member.ledger_id
      from public.ledger_members as member
      where member.user_id = auth.uid()
      order by (member.role = 'owner') desc, member.joined_at
      limit 1
    )
  );
$$;

create or replace function public.current_ledger_owner_id()
returns uuid
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select ledger.owner_user_id
  from public.ledgers as ledger
  where ledger.id = public.current_ledger_id();
$$;

create or replace function public.can_access_ledger(p_ledger_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1 from public.ledger_members
    where ledger_id = p_ledger_id and user_id = auth.uid()
  );
$$;

create or replace function public.can_edit_ledger(p_ledger_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1 from public.ledger_members
    where ledger_id = p_ledger_id
      and user_id = auth.uid()
      and role in ('owner', 'editor')
  );
$$;

create or replace function public.is_ledger_owner(p_ledger_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1 from public.ledgers
    where id = p_ledger_id and owner_user_id = auth.uid()
  );
$$;

revoke all on function public.current_ledger_id() from public;
revoke all on function public.current_ledger_owner_id() from public;
revoke all on function public.can_access_ledger(uuid) from public;
revoke all on function public.can_edit_ledger(uuid) from public;
revoke all on function public.is_ledger_owner(uuid) from public;
grant execute on function public.current_ledger_id() to authenticated;
grant execute on function public.current_ledger_owner_id() to authenticated;
grant execute on function public.can_access_ledger(uuid) to authenticated;
grant execute on function public.can_edit_ledger(uuid) to authenticated;
grant execute on function public.is_ledger_owner(uuid) to authenticated;

alter table public.ledgers enable row level security;
alter table public.ledger_members enable row level security;
alter table public.ledger_invitations enable row level security;

drop policy if exists ledgers_member_select on public.ledgers;
drop policy if exists ledger_members_member_select on public.ledger_members;
drop policy if exists ledger_invitations_owner_select on public.ledger_invitations;
create policy ledgers_member_select on public.ledgers
  for select to authenticated using (public.can_access_ledger(id));
create policy ledger_members_member_select on public.ledger_members
  for select to authenticated using (public.can_access_ledger(ledger_id));
create policy ledger_invitations_owner_select on public.ledger_invitations
  for select to authenticated using (public.is_ledger_owner(ledger_id));

grant select on public.ledgers, public.ledger_members, public.ledger_invitations to authenticated;

-- Stamp the actor and translate existing user_id writes to the active ledger's
-- canonical owner before existing integrity triggers and RLS checks run.
create or replace function public.stamp_household_ledger_actor()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_owner_id uuid := public.current_ledger_owner_id();
begin
  -- Trusted service-role workers (for example the recurring-entry cron) have no
  -- auth.uid(). Their writes retain the canonical owner supplied by the worker.
  if auth.uid() is null then
    new.created_by := case when tg_op = 'INSERT' then coalesce(new.created_by, new.user_id) else old.created_by end;
    new.updated_by := coalesce(new.updated_by, new.created_by, new.user_id);
    return new;
  end if;

  if v_owner_id is null or not public.can_edit_ledger(public.current_ledger_id()) then
    raise exception 'Active ledger access is required';
  end if;

  if tg_op = 'INSERT' then
    new.user_id := v_owner_id;
    new.created_by := auth.uid();
  else
    new.user_id := old.user_id;
    new.created_by := old.created_by;
  end if;
  new.updated_by := auth.uid();
  return new;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'wallets', 'categories', 'transactions', 'budgets',
    'recurring_rules', 'recurring_run_logs', 'receipts'
  ]
  loop
    execute format('alter table public.%I add column if not exists created_by uuid references auth.users(id) on delete set null', table_name);
    execute format('alter table public.%I add column if not exists updated_by uuid references auth.users(id) on delete set null', table_name);
    execute format('update public.%I set created_by = user_id where created_by is null', table_name);
    execute format('update public.%I set updated_by = coalesce(updated_by, created_by, user_id) where updated_by is null', table_name);
    execute format('drop trigger if exists "00_household_actor" on public.%I', table_name);
    execute format(
      'create trigger "00_household_actor" before insert or update on public.%I for each row execute function public.stamp_household_ledger_actor()',
      table_name
    );
  end loop;
end;
$$;

-- Replace legacy per-user policies with active-ledger policies. Service-role
-- jobs continue to bypass RLS.
do $$
declare
  table_name text;
  policy_row record;
begin
  foreach table_name in array array[
    'wallets', 'categories', 'transactions', 'budgets',
    'recurring_rules', 'recurring_run_logs', 'receipts'
  ]
  loop
    execute format('alter table public.%I enable row level security', table_name);
    for policy_row in
      select policyname from pg_policies where schemaname = 'public' and tablename = table_name
    loop
      execute format('drop policy if exists %I on public.%I', policy_row.policyname, table_name);
    end loop;
    execute format(
      'create policy household_select on public.%I for select to authenticated using (user_id = public.current_ledger_owner_id())',
      table_name
    );
    execute format(
      'create policy household_insert on public.%I for insert to authenticated with check (user_id = public.current_ledger_owner_id() and public.can_edit_ledger(public.current_ledger_id()))',
      table_name
    );
    execute format(
      'create policy household_update on public.%I for update to authenticated using (user_id = public.current_ledger_owner_id() and public.can_edit_ledger(public.current_ledger_id())) with check (user_id = public.current_ledger_owner_id() and public.can_edit_ledger(public.current_ledger_id()))',
      table_name
    );
    execute format(
      'create policy household_delete on public.%I for delete to authenticated using (user_id = public.current_ledger_owner_id() and public.can_edit_ledger(public.current_ledger_id()))',
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
  v_token text := encode(gen_random_bytes(32), 'hex');
begin
  if not public.is_ledger_owner(v_ledger_id) then
    raise exception 'Only the ledger owner can invite family members';
  end if;
  if p_role <> 'editor' then raise exception 'Unsupported family role'; end if;
  if v_email !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' then
    raise exception 'Enter a valid email address';
  end if;
  if v_email = lower(coalesce(auth.jwt() ->> 'email', '')) then
    raise exception 'You are already the owner of this ledger';
  end if;

  update public.ledger_invitations
  set revoked_at = now()
  where ledger_id = v_ledger_id and email = v_email
    and accepted_at is null and revoked_at is null;

  insert into public.ledger_invitations (
    ledger_id, email, role, token_hash, invited_by, expires_at
  ) values (
    v_ledger_id, v_email, p_role, digest(v_token, 'sha256'), auth.uid(), now() + interval '7 days'
  ) returning id into invitation_id;

  invitation_token := v_token;
  select name into ledger_name from public.ledgers where id = v_ledger_id;
  return next;
end;
$$;

create or replace function public.accept_ledger_invitation(p_token text)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_invitation public.ledger_invitations%rowtype;
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;

  select * into v_invitation
  from public.ledger_invitations
  where token_hash = digest(p_token, 'sha256')
  for update;

  if v_invitation.id is null or v_invitation.accepted_at is not null
     or v_invitation.revoked_at is not null or v_invitation.expires_at <= now() then
    raise exception 'This invitation is invalid or has expired';
  end if;
  if v_email = '' or v_email <> v_invitation.email then
    raise exception 'Sign in with the email address that received this invitation';
  end if;

  insert into public.ledger_members (ledger_id, user_id, role, email)
  values (v_invitation.ledger_id, auth.uid(), v_invitation.role, v_email)
  on conflict (ledger_id, user_id) do update
    set role = excluded.role, email = excluded.email;

  update public.ledger_invitations set accepted_at = now() where id = v_invitation.id;
  update public.profiles set active_ledger_id = v_invitation.ledger_id where id = auth.uid();
  return v_invitation.ledger_id;
end;
$$;

create or replace function public.set_active_ledger(p_ledger_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if not public.can_access_ledger(p_ledger_id) then raise exception 'Ledger not found'; end if;
  update public.profiles set active_ledger_id = p_ledger_id where id = auth.uid();
end;
$$;

create or replace function public.revoke_ledger_invitation(p_invitation_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare v_ledger_id uuid;
begin
  select ledger_id into v_ledger_id from public.ledger_invitations where id = p_invitation_id;
  if not public.is_ledger_owner(v_ledger_id) then raise exception 'Only the ledger owner can revoke invitations'; end if;
  update public.ledger_invitations set revoked_at = now()
  where id = p_invitation_id and accepted_at is null and revoked_at is null;
end;
$$;

create or replace function public.remove_ledger_member(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare v_ledger_id uuid := public.current_ledger_id();
begin
  if not public.is_ledger_owner(v_ledger_id) then raise exception 'Only the ledger owner can remove family members'; end if;
  if p_user_id = auth.uid() then raise exception 'The owner cannot remove themselves'; end if;

  delete from public.ledger_members
  where ledger_id = v_ledger_id and user_id = p_user_id and role <> 'owner';

  update public.profiles as profile
  set active_ledger_id = owned.id
  from public.ledgers as owned
  where profile.id = p_user_id
    and profile.active_ledger_id = v_ledger_id
    and owned.owner_user_id = p_user_id;
end;
$$;

create or replace function public.get_family_access_overview()
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  with current_membership as (
    select ledger.id, ledger.name, ledger.owner_user_id, member.role
    from public.ledgers as ledger
    join public.ledger_members as member on member.ledger_id = ledger.id
    where ledger.id = public.current_ledger_id() and member.user_id = auth.uid()
  )
  select jsonb_build_object(
    'ledger', jsonb_build_object(
      'id', current_membership.id,
      'name', current_membership.name,
      'role', current_membership.role
    ),
    'available_ledgers', coalesce((
      select jsonb_agg(jsonb_build_object('id', ledger.id, 'name', ledger.name, 'role', member.role) order by ledger.created_at)
      from public.ledger_members as member
      join public.ledgers as ledger on ledger.id = member.ledger_id
      where member.user_id = auth.uid()
    ), '[]'::jsonb),
    'members', coalesce((
      select jsonb_agg(jsonb_build_object(
        'user_id', member.user_id,
        'email', coalesce(member.email, auth_user.email, profile.full_name, 'Family member'),
        'role', member.role,
        'joined_at', member.joined_at,
        'is_current_user', member.user_id = auth.uid()
      ) order by (member.role = 'owner') desc, member.joined_at)
      from public.ledger_members as member
      left join auth.users as auth_user on auth_user.id = member.user_id
      left join public.profiles as profile on profile.id = member.user_id
      where member.ledger_id = current_membership.id
    ), '[]'::jsonb),
    'invitations', case when current_membership.role = 'owner' then coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', invitation.id,
        'email', invitation.email,
        'role', invitation.role,
        'expires_at', invitation.expires_at,
        'created_at', invitation.created_at
      ) order by invitation.created_at desc)
      from public.ledger_invitations as invitation
      where invitation.ledger_id = current_membership.id
        and invitation.accepted_at is null and invitation.revoked_at is null
        and invitation.expires_at > now()
    ), '[]'::jsonb) else '[]'::jsonb end
  )
  from current_membership;
$$;

revoke all on function public.create_ledger_invitation(text, text) from public;
revoke all on function public.accept_ledger_invitation(text) from public;
revoke all on function public.set_active_ledger(uuid) from public;
revoke all on function public.revoke_ledger_invitation(uuid) from public;
revoke all on function public.remove_ledger_member(uuid) from public;
revoke all on function public.get_family_access_overview() from public;
grant execute on function public.create_ledger_invitation(text, text) to authenticated;
grant execute on function public.accept_ledger_invitation(text) to authenticated;
grant execute on function public.set_active_ledger(uuid) to authenticated;
grant execute on function public.revoke_ledger_invitation(uuid) to authenticated;
grant execute on function public.remove_ledger_member(uuid) to authenticated;
grant execute on function public.get_family_access_overview() to authenticated;

-- Household-aware wallet balance query.
create or replace function public.get_wallet_balances()
returns table (
  wallet_id uuid,
  current_balance_minor bigint,
  last_activity_at timestamptz
)
language sql
stable
security invoker
set search_path = pg_catalog, public
as $$
  select wallet.id as wallet_id,
    wallet.starting_balance_minor + coalesce(sum(
      case transaction.type
        when 'income' then transaction.amount_minor
        when 'expense' then -transaction.amount_minor
        else 0
      end
    ), 0)::bigint as current_balance_minor,
    max(transaction.occurred_at) as last_activity_at
  from public.wallets as wallet
  left join public.transactions as transaction
    on transaction.wallet_id = wallet.id
   and transaction.user_id = wallet.user_id
  where wallet.user_id = public.current_ledger_owner_id()
  group by wallet.id, wallet.starting_balance_minor
  order by wallet.created_at asc;
$$;

-- Household-aware atomic wallet movement functions.
create or replace function public.create_wallet_transfer(
  p_source_wallet_id uuid,
  p_destination_wallet_id uuid,
  p_source_amount_minor bigint,
  p_destination_amount_minor bigint,
  p_occurred_at timestamptz,
  p_kind text default 'transfer',
  p_description text default null
) returns uuid
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := public.current_ledger_owner_id();
  v_source_currency text;
  v_destination_currency text;
  v_transfer_id uuid := gen_random_uuid();
begin
  if auth.uid() is null or v_user_id is null or not public.can_edit_ledger(public.current_ledger_id()) then raise exception 'Authentication required'; end if;
  if p_source_wallet_id = p_destination_wallet_id then raise exception 'Wallets must be different'; end if;
  if p_source_amount_minor <= 0 or p_destination_amount_minor <= 0 then raise exception 'Amounts must be positive'; end if;
  if p_kind not in ('transfer', 'fx') then raise exception 'Unsupported transfer kind'; end if;

  select currency_code into v_source_currency from public.wallets where id = p_source_wallet_id and user_id = v_user_id;
  select currency_code into v_destination_currency from public.wallets where id = p_destination_wallet_id and user_id = v_user_id;
  if v_source_currency is null or v_destination_currency is null then raise exception 'Wallet not found'; end if;
  if p_kind = 'transfer' and v_source_currency <> v_destination_currency then raise exception 'Different currencies require an FX conversion'; end if;
  if p_kind = 'transfer' and p_source_amount_minor <> p_destination_amount_minor then raise exception 'Same-currency transfers must use equal amounts'; end if;
  if p_kind = 'fx' and v_source_currency = v_destination_currency then raise exception 'FX conversion requires different currencies'; end if;

  insert into public.transactions (
    user_id, wallet_id, category_id, type, amount_minor, currency_code,
    occurred_at, description, transaction_kind, transfer_id
  ) values
    (v_user_id, p_source_wallet_id, null, 'expense', p_source_amount_minor, v_source_currency, p_occurred_at, p_description, p_kind, v_transfer_id),
    (v_user_id, p_destination_wallet_id, null, 'income', p_destination_amount_minor, v_destination_currency, p_occurred_at, p_description, p_kind, v_transfer_id);
  return v_transfer_id;
end;
$$;

create or replace function public.update_wallet_transfer(
  p_transaction_id uuid,
  p_amount_minor bigint,
  p_occurred_at timestamptz,
  p_description text default null
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := public.current_ledger_owner_id();
  v_transfer_id uuid;
  v_kind text;
  v_pair_count integer := 0;
  v_row record;
begin
  if auth.uid() is null or v_user_id is null or not public.can_edit_ledger(public.current_ledger_id()) then raise exception 'Authentication required'; end if;
  if p_amount_minor <= 0 then raise exception 'Amount must be positive'; end if;
  if p_occurred_at is null then raise exception 'Date is required'; end if;
  select transfer_id, transaction_kind into v_transfer_id, v_kind
  from public.transactions where id = p_transaction_id and user_id = v_user_id for update;
  if v_transfer_id is null or v_kind not in ('transfer', 'fx') then raise exception 'Transaction is not part of a paired wallet movement'; end if;
  for v_row in select id, user_id, transaction_kind from public.transactions where transfer_id = v_transfer_id for update
  loop
    v_pair_count := v_pair_count + 1;
    if v_row.user_id <> v_user_id or v_row.transaction_kind <> v_kind then raise exception 'Wallet movement pair is inconsistent'; end if;
  end loop;
  if v_pair_count <> 2 then raise exception 'Wallet movement pair is incomplete'; end if;
  update public.transactions set
    amount_minor = case when v_kind = 'transfer' or id = p_transaction_id then p_amount_minor else amount_minor end,
    occurred_at = p_occurred_at,
    description = nullif(trim(p_description), '')
  where transfer_id = v_transfer_id and user_id = v_user_id;
  perform public.assert_wallet_transfer_pair(v_transfer_id);
  return v_transfer_id;
end;
$$;

create or replace function public.delete_wallet_transfer(p_transfer_id uuid)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := public.current_ledger_owner_id();
  v_pair_count integer := 0;
  v_row record;
begin
  if auth.uid() is null or v_user_id is null or not public.can_edit_ledger(public.current_ledger_id()) then raise exception 'Authentication required'; end if;
  for v_row in select id, user_id from public.transactions where transfer_id = p_transfer_id for update
  loop
    v_pair_count := v_pair_count + 1;
    if v_row.user_id <> v_user_id then raise exception 'Wallet movement not found'; end if;
  end loop;
  if v_pair_count <> 2 then raise exception 'Wallet movement pair is incomplete'; end if;
  delete from public.transactions where transfer_id = p_transfer_id and user_id = v_user_id;
  return v_pair_count;
end;
$$;

revoke all on function public.create_wallet_transfer(uuid, uuid, bigint, bigint, timestamptz, text, text) from public;
revoke all on function public.update_wallet_transfer(uuid, bigint, timestamptz, text) from public;
revoke all on function public.delete_wallet_transfer(uuid) from public;
grant execute on function public.create_wallet_transfer(uuid, uuid, bigint, bigint, timestamptz, text, text) to authenticated;
grant execute on function public.update_wallet_transfer(uuid, bigint, timestamptz, text) to authenticated;
grant execute on function public.delete_wallet_transfer(uuid) to authenticated;
