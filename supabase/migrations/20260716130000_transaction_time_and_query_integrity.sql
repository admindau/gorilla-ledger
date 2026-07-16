-- Preserve the difference between a known transaction time and a legacy/date-only entry.
-- Existing records are intentionally marked date-only; created_at is not a substitute for event time.

alter table public.transactions
  add column if not exists occurred_at_precision text not null default 'date',
  add column if not exists occurred_timezone text;

alter table public.transactions
  drop constraint if exists transactions_occurred_at_precision_check;

alter table public.transactions
  add constraint transactions_occurred_at_precision_check
  check (occurred_at_precision in ('date', 'datetime'));

update public.transactions
set occurred_at_precision = 'date'
where occurred_at_precision is distinct from 'date'
  and occurred_at::time = time '00:00:00';

create index if not exists transactions_user_occurred_id_idx
  on public.transactions (user_id, occurred_at desc, id desc);

comment on column public.transactions.occurred_at_precision is
  'Whether occurred_at contains a user-confirmed event time or only a calendar date.';
comment on column public.transactions.occurred_timezone is
  'IANA timezone captured when a user supplied the transaction event time.';

alter table public.profiles
  add column if not exists timezone text,
  add column if not exists security_reviewed_at timestamptz;

comment on column public.profiles.timezone is
  'IANA timezone used for ledger calendar boundaries and localized event times.';
comment on column public.profiles.security_reviewed_at is
  'Latest user-confirmed security review, shared across authenticated devices.';

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
  select
    wallet.id as wallet_id,
    (
      wallet.starting_balance_minor +
      coalesce(sum(case transaction.type when 'income' then transaction.amount_minor else -transaction.amount_minor end), 0)
    )::bigint as current_balance_minor,
    max(transaction.occurred_at) as last_activity_at
  from public.wallets as wallet
  left join public.transactions as transaction
    on transaction.wallet_id = wallet.id
   and transaction.user_id = wallet.user_id
  where wallet.user_id = auth.uid()
  group by wallet.id, wallet.starting_balance_minor
  order by wallet.created_at asc;
$$;

grant execute on function public.get_wallet_balances() to authenticated;

alter table public.transactions
  drop constraint if exists transactions_positive_amount_check;
alter table public.transactions
  add constraint transactions_positive_amount_check check (amount_minor > 0) not valid;
alter table public.transactions validate constraint transactions_positive_amount_check;

create or replace function public.validate_transaction_dimensions()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  wallet_user_id uuid;
  wallet_currency text;
  category_user_id uuid;
  category_type text;
begin
  select user_id, currency_code into wallet_user_id, wallet_currency
  from public.wallets where id = new.wallet_id;

  if wallet_user_id is null or wallet_user_id is distinct from new.user_id then
    raise exception 'Transaction wallet must belong to the transaction owner' using errcode = '23514';
  end if;
  if wallet_currency is distinct from new.currency_code then
    raise exception 'Transaction currency must match its wallet currency' using errcode = '23514';
  end if;

  if new.category_id is not null then
    select user_id, type into category_user_id, category_type
    from public.categories where id = new.category_id;
    if category_user_id is null or category_user_id is distinct from new.user_id then
      raise exception 'Transaction category must belong to the transaction owner' using errcode = '23514';
    end if;
    if category_type is distinct from new.type then
      raise exception 'Transaction type must match its category type' using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists transactions_dimension_guard on public.transactions;
create trigger transactions_dimension_guard
before insert or update of user_id, wallet_id, category_id, type, currency_code, amount_minor
on public.transactions
for each row execute function public.validate_transaction_dimensions();

create or replace function public.validate_recurring_dimensions()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  wallet_user_id uuid;
  wallet_currency text;
  category_user_id uuid;
  category_type text;
begin
  if new.amount_minor <= 0 then
    raise exception 'Recurring amount must be positive' using errcode = '23514';
  end if;

  select user_id, currency_code into wallet_user_id, wallet_currency
  from public.wallets where id = new.wallet_id;
  if wallet_user_id is null or wallet_user_id is distinct from new.user_id then
    raise exception 'Recurring wallet must belong to the rule owner' using errcode = '23514';
  end if;
  if wallet_currency is distinct from new.currency_code then
    raise exception 'Recurring currency must match its wallet currency' using errcode = '23514';
  end if;

  if new.category_id is not null then
    select user_id, type into category_user_id, category_type
    from public.categories where id = new.category_id;
    if category_user_id is null or category_user_id is distinct from new.user_id then
      raise exception 'Recurring category must belong to the rule owner' using errcode = '23514';
    end if;
    if category_type is distinct from new.type then
      raise exception 'Recurring type must match its category type' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists recurring_rules_dimension_guard on public.recurring_rules;
create trigger recurring_rules_dimension_guard
before insert or update of user_id, wallet_id, category_id, type, currency_code, amount_minor
on public.recurring_rules
for each row execute function public.validate_recurring_dimensions();

-- Correct a long-standing presentation typo without overwriting an existing category.
update public.categories as category
set name = 'Miscellaneous'
where lower(trim(category.name)) = 'miscelleneous'
  and not exists (
    select 1 from public.categories as existing
    where existing.user_id = category.user_id
      and existing.type = category.type
      and lower(trim(existing.name)) = 'miscellaneous'
  );
