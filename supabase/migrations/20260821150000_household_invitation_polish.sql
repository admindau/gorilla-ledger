-- Production follow-up: Supabase installs pgcrypto in the extensions schema.
-- Qualify its functions and replace email-derived personal ledger names.

update public.ledgers as ledger
set name = 'My Ledger', updated_at = now()
from auth.users as auth_user
where ledger.owner_user_id = auth_user.id
  and lower(ledger.name) = lower(auth_user.email || '''s Ledger');

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
    case
      when nullif(trim(new.full_name), '') is null or position('@' in new.full_name) > 0 then 'My Ledger'
      else left(trim(new.full_name) || '''s Ledger', 80)
    end,
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
  if exists (
    select 1 from public.ledger_invitations
    where invited_by = auth.uid() and created_at > now() - interval '30 seconds'
  ) then
    raise exception 'Wait before sending another invitation';
  end if;
  if (
    select count(*) from public.ledger_invitations
    where invited_by = auth.uid() and created_at > now() - interval '1 hour'
  ) >= 20 then
    raise exception 'Invitation limit reached';
  end if;

  update public.ledger_invitations
  set revoked_at = now()
  where ledger_id = v_ledger_id and email = v_email
    and accepted_at is null and revoked_at is null;

  insert into public.ledger_invitations (
    ledger_id, email, role, token_hash, invited_by, expires_at
  ) values (
    v_ledger_id, v_email, p_role, extensions.digest(v_token, 'sha256'), auth.uid(), now() + interval '7 days'
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
  where token_hash = extensions.digest(p_token, 'sha256')
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
