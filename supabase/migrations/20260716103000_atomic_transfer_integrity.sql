-- Make wallet transfers and currency exchanges indivisible ledger movements.

-- These eleven pairs were reviewed against production dates, amounts,
-- descriptions, wallets, and complementary income/expense directions.
with reviewed_pairs (expense_id, income_id) as (
  values
    ('8c9fd80d-41bb-4abc-b171-9117148e2cdc'::uuid, '12c82705-91d5-4ed6-8bf4-0fe43990dd82'::uuid),
    ('54ac223c-1dd3-4aac-9183-b1d5ee474261'::uuid, '6f438e26-01a5-449a-b8d2-849516b8de2a'::uuid),
    ('86f0e8de-e26f-4263-a4fb-f0fefc870dff'::uuid, '80fa2a86-1a30-4298-a67c-3bf642d262c1'::uuid),
    ('5afd7d9d-5aa3-4713-aefa-2e330230d9ac'::uuid, 'cf025767-be66-4c0b-ab51-3b8eb5a1ab19'::uuid),
    ('40a7a457-c894-4a5a-8564-645012fd42be'::uuid, 'f1ddbafe-62a8-4aa6-891c-9ad5570605c2'::uuid),
    ('27ea9352-349b-42a3-b475-9d515b28b59f'::uuid, '2fd17079-7465-47bc-81e6-639c9a39373e'::uuid),
    ('addc0b30-2076-4bc0-8f1f-995fcfeffb25'::uuid, '9c261710-2c95-4067-bb6b-b2ce3549a811'::uuid),
    ('10f2d270-fe1c-4261-841f-d1e8c15105ce'::uuid, '2acc39fe-1ab1-489c-bb6e-9a7272b8bb08'::uuid),
    ('301b0132-df75-48b9-9080-d2ee80855f6a'::uuid, '9ff9daa2-8277-481d-a5c4-4b14f09d5e9f'::uuid),
    ('b7c7db22-dada-4414-9538-3aa501d02f19'::uuid, 'bae86fbf-1a5a-403b-a3a7-699b4c861a64'::uuid),
    ('3cd7ba4d-83d7-4001-b3c3-0f078d3b68a1'::uuid, '09fe86b5-ffa3-418d-8ecf-db6850c544d7'::uuid)
),
eligible_pairs as (
  select p.expense_id, p.income_id, gen_random_uuid() as transfer_id
  from reviewed_pairs p
  join public.transactions expense on expense.id = p.expense_id
  join public.transactions income on income.id = p.income_id
  where expense.transfer_id is null
    and income.transfer_id is null
    and expense.user_id = income.user_id
    and expense.transaction_kind = income.transaction_kind
    and expense.transaction_kind in ('transfer', 'fx')
    and expense.type = 'expense'
    and income.type = 'income'
)
update public.transactions transaction
set transfer_id = pair.transfer_id
from eligible_pairs pair
where transaction.id in (pair.expense_id, pair.income_id);

create or replace function public.assert_wallet_transfer_pair(p_transfer_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_count integer;
  v_users integer;
  v_income integer;
  v_expense integer;
  v_kind_min text;
  v_kind_max text;
  v_currencies integer;
  v_amount_min bigint;
  v_amount_max bigint;
begin
  if tg_op = 'UPDATE' then
    if old.transfer_id is not null and (
      new.transfer_id is distinct from old.transfer_id or
      new.transaction_kind is distinct from old.transaction_kind or
      new.user_id is distinct from old.user_id or
      new.wallet_id is distinct from old.wallet_id or
      new.category_id is distinct from old.category_id or
      new.type is distinct from old.type or
      new.currency_code is distinct from old.currency_code
    ) then
      raise exception 'Paired wallet identity fields are immutable; use the paired movement workflow'
        using errcode = '23514';
    end if;
  end if;

  if p_transfer_id is null then return; end if;

  select count(*), count(distinct user_id),
         count(*) filter (where type = 'income'),
         count(*) filter (where type = 'expense'),
         min(transaction_kind), max(transaction_kind),
         count(distinct currency_code), min(amount_minor), max(amount_minor)
  into v_count, v_users, v_income, v_expense, v_kind_min, v_kind_max,
       v_currencies, v_amount_min, v_amount_max
  from public.transactions
  where transfer_id = p_transfer_id;

  -- A complete pair may be removed atomically.
  if v_count = 0 then return; end if;

  if v_count <> 2 or v_users <> 1 or v_income <> 1 or v_expense <> 1
     or v_kind_min is distinct from v_kind_max
     or v_kind_min not in ('transfer', 'fx') then
    raise exception 'Wallet movement % must contain one income and one expense leg', p_transfer_id
      using errcode = '23514';
  end if;

  if v_kind_min = 'transfer' and (v_currencies <> 1 or v_amount_min <> v_amount_max) then
    raise exception 'Same-currency transfer % must balance exactly', p_transfer_id
      using errcode = '23514';
  end if;

  if v_kind_min = 'fx' and v_currencies <> 2 then
    raise exception 'Currency exchange % must contain two currencies', p_transfer_id
      using errcode = '23514';
  end if;
end;
$$;

create or replace function public.enforce_wallet_transfer_pair()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.assert_wallet_transfer_pair(old.transfer_id);
  elsif tg_op = 'INSERT' then
    perform public.assert_wallet_transfer_pair(new.transfer_id);
  else
    perform public.assert_wallet_transfer_pair(old.transfer_id);
    if new.transfer_id is distinct from old.transfer_id then
      perform public.assert_wallet_transfer_pair(new.transfer_id);
    end if;
  end if;
  return null;
end;
$$;

drop trigger if exists transactions_transfer_pair_integrity on public.transactions;
create constraint trigger transactions_transfer_pair_integrity
after insert or update or delete on public.transactions
deferrable initially deferred
for each row execute function public.enforce_wallet_transfer_pair();

create or replace function public.guard_internal_ledger_category()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_category_name text;
begin
  if new.transaction_kind in ('transfer', 'fx') and new.transfer_id is null then
    raise exception 'Transfers and currency exchanges require a paired transfer id'
      using errcode = '23514';
  end if;

  if new.transaction_kind = 'operational' and new.transfer_id is not null then
    raise exception 'Operational transactions cannot have a transfer id'
      using errcode = '23514';
  end if;

  if new.category_id is not null then
    select lower(trim(name)) into v_category_name
    from public.categories where id = new.category_id;
  end if;

  if coalesce(new.transaction_kind, 'operational') = 'operational' and
     v_category_name in (
       'fx', 'foreign exchange', 'currency exchange', 'currency conversion',
       'transfer', 'transfers', 'transfer in', 'transfer out',
       'internal transfer', 'wallet transfer', 'account transfer'
     ) then
    raise exception 'Use the paired Transfer / FX workflow for internal balance movements'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists transactions_internal_category_guard on public.transactions;
create trigger transactions_internal_category_guard
before insert or update of user_id, wallet_id, category_id, type, currency_code, transaction_kind, transfer_id
on public.transactions
for each row execute function public.guard_internal_ledger_category();

create or replace function public.guard_recurring_internal_category()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_category_name text;
begin
  if new.category_id is null then return new; end if;

  select lower(trim(name)) into v_category_name
  from public.categories where id = new.category_id;

  if v_category_name in (
    'fx', 'foreign exchange', 'currency exchange', 'currency conversion',
    'transfer', 'transfers', 'transfer in', 'transfer out',
    'internal transfer', 'wallet transfer', 'account transfer'
  ) then
    raise exception 'Recurring rules cannot create one-sided internal balance movements'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists recurring_rules_internal_category_guard on public.recurring_rules;
create trigger recurring_rules_internal_category_guard
before insert or update of category_id on public.recurring_rules
for each row execute function public.guard_recurring_internal_category();

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
  v_user_id uuid := auth.uid();
  v_transfer_id uuid;
  v_kind text;
  v_pair_count integer := 0;
  v_row record;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if p_amount_minor <= 0 then raise exception 'Amount must be positive'; end if;
  if p_occurred_at is null then raise exception 'Date is required'; end if;

  select transfer_id, transaction_kind
  into v_transfer_id, v_kind
  from public.transactions
  where id = p_transaction_id and user_id = v_user_id
  for update;

  if v_transfer_id is null or v_kind not in ('transfer', 'fx') then
    raise exception 'Transaction is not part of a paired wallet movement';
  end if;

  for v_row in
    select id, user_id, transaction_kind, type
    from public.transactions
    where transfer_id = v_transfer_id
    for update
  loop
    v_pair_count := v_pair_count + 1;
    if v_row.user_id <> v_user_id or v_row.transaction_kind <> v_kind then
      raise exception 'Wallet movement pair is inconsistent';
    end if;
  end loop;

  if v_pair_count <> 2 then raise exception 'Wallet movement pair is incomplete'; end if;

  update public.transactions
  set amount_minor = case
        when v_kind = 'transfer' or id = p_transaction_id then p_amount_minor
        else amount_minor
      end,
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
  v_user_id uuid := auth.uid();
  v_pair_count integer := 0;
  v_row record;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;

  for v_row in
    select id, user_id from public.transactions
    where transfer_id = p_transfer_id
    for update
  loop
    v_pair_count := v_pair_count + 1;
    if v_row.user_id <> v_user_id then raise exception 'Wallet movement not found'; end if;
  end loop;

  if v_pair_count <> 2 then raise exception 'Wallet movement pair is incomplete'; end if;

  delete from public.transactions
  where transfer_id = p_transfer_id and user_id = v_user_id;

  return v_pair_count;
end;
$$;

alter function public.create_wallet_transfer(uuid, uuid, bigint, bigint, timestamptz, text, text)
  set search_path = pg_catalog, public;

revoke all on function public.assert_wallet_transfer_pair(uuid) from public;
revoke all on function public.update_wallet_transfer(uuid, bigint, timestamptz, text) from public;
revoke all on function public.delete_wallet_transfer(uuid) from public;
revoke all on function public.create_wallet_transfer(uuid, uuid, bigint, bigint, timestamptz, text, text) from public;

grant execute on function public.update_wallet_transfer(uuid, bigint, timestamptz, text) to authenticated;
grant execute on function public.delete_wallet_transfer(uuid) to authenticated;
grant execute on function public.create_wallet_transfer(uuid, uuid, bigint, bigint, timestamptz, text, text) to authenticated;

comment on function public.update_wallet_transfer(uuid, bigint, timestamptz, text) is
  'Updates a paired wallet movement atomically. Same-currency transfers keep equal legs; FX updates the selected leg.';
comment on function public.delete_wallet_transfer(uuid) is
  'Deletes both legs of an authenticated user wallet movement atomically.';
