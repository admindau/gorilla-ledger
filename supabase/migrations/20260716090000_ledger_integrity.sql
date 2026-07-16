-- Canonical ledger semantics and recurring occurrence provenance.
-- Apply this migration before deploying the application commit that references these columns.

alter table public.transactions
  add column if not exists transaction_kind text not null default 'operational',
  add column if not exists transfer_id uuid,
  add column if not exists recurring_rule_id uuid references public.recurring_rules(id) on delete set null,
  add column if not exists scheduled_for timestamptz;

alter table public.transactions
  drop constraint if exists transactions_transaction_kind_check;

alter table public.transactions
  add constraint transactions_transaction_kind_check
  check (transaction_kind in ('operational', 'transfer', 'fx'));

create index if not exists transactions_transfer_id_idx
  on public.transactions (user_id, transfer_id)
  where transfer_id is not null;

-- Recover provenance for transactions already created by the recurring worker.
update public.transactions as t
set recurring_rule_id = log.rule_id,
    scheduled_for = t.occurred_at
from public.recurring_run_logs as log
where log.transaction_id = t.id
  and log.status = 'success'
  and t.recurring_rule_id is null;

create unique index if not exists transactions_recurring_occurrence_uidx
  on public.transactions (recurring_rule_id, scheduled_for)
  where recurring_rule_id is not null and scheduled_for is not null;

-- Preserve historical financial meaning even if a category is later renamed or archived.
update public.transactions as t
set transaction_kind = case
  when lower(trim(category.name)) in ('fx', 'foreign exchange', 'currency exchange', 'currency conversion') then 'fx'
  else 'transfer'
end
from public.categories as category
where t.category_id = category.id
  and lower(trim(category.name)) in (
    'fx', 'foreign exchange', 'currency exchange', 'currency conversion',
    'transfer', 'transfers', 'transfer in', 'transfer out',
    'internal transfer', 'internal transfers',
    'wallet transfer', 'wallet transfers',
    'account transfer', 'account transfers'
  )
  and t.transaction_kind = 'operational';

comment on column public.transactions.transaction_kind is
  'Financial meaning: operational affects income/expense; transfer and fx affect balances only.';
comment on column public.transactions.transfer_id is
  'Shared identifier joining both sides of a wallet transfer or FX conversion.';
comment on column public.transactions.scheduled_for is
  'Exact recurring occurrence timestamp used with recurring_rule_id for idempotency.';

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
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_source_currency text;
  v_destination_currency text;
  v_transfer_id uuid := gen_random_uuid();
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if p_source_wallet_id = p_destination_wallet_id then raise exception 'Wallets must be different'; end if;
  if p_source_amount_minor <= 0 or p_destination_amount_minor <= 0 then raise exception 'Amounts must be positive'; end if;
  if p_kind not in ('transfer', 'fx') then raise exception 'Unsupported transfer kind'; end if;

  select currency_code into v_source_currency
  from public.wallets where id = p_source_wallet_id and user_id = v_user_id;
  select currency_code into v_destination_currency
  from public.wallets where id = p_destination_wallet_id and user_id = v_user_id;

  if v_source_currency is null or v_destination_currency is null then
    raise exception 'Wallet not found';
  end if;
  if p_kind = 'transfer' and v_source_currency <> v_destination_currency then
    raise exception 'Different currencies require an FX conversion';
  end if;
  if p_kind = 'transfer' and p_source_amount_minor <> p_destination_amount_minor then
    raise exception 'Same-currency transfers must use equal amounts';
  end if;
  if p_kind = 'fx' and v_source_currency = v_destination_currency then
    raise exception 'FX conversion requires different currencies';
  end if;

  insert into public.transactions (
    user_id, wallet_id, category_id, type, amount_minor, currency_code,
    occurred_at, description, transaction_kind, transfer_id
  ) values
    (v_user_id, p_source_wallet_id, null, 'expense', p_source_amount_minor,
      v_source_currency, p_occurred_at, p_description, p_kind, v_transfer_id),
    (v_user_id, p_destination_wallet_id, null, 'income', p_destination_amount_minor,
      v_destination_currency, p_occurred_at, p_description, p_kind, v_transfer_id);

  return v_transfer_id;
end;
$$;

grant execute on function public.create_wallet_transfer(uuid, uuid, bigint, bigint, timestamptz, text, text)
  to authenticated;
