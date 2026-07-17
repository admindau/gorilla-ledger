-- Keep planning data aligned with the ledger even when writes bypass the UI.

create or replace function public.validate_budget_dimensions()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  wallet_user_id uuid;
  category_user_id uuid;
  category_type text;
  category_name text;
begin
  if new.amount_minor <= 0 then
    raise exception 'Budget amount must be positive' using errcode = '23514';
  end if;
  if new.month < 1 or new.month > 12 then
    raise exception 'Budget month must be between 1 and 12' using errcode = '23514';
  end if;

  select user_id, type, lower(trim(name))
  into category_user_id, category_type, category_name
  from public.categories
  where id = new.category_id;

  if category_user_id is null or category_user_id is distinct from new.user_id then
    raise exception 'Budget category must belong to the budget owner' using errcode = '23514';
  end if;
  if category_type is distinct from 'expense' then
    raise exception 'Budgets require an expense category' using errcode = '23514';
  end if;
  if category_name in (
    'fx', 'foreign exchange', 'currency exchange', 'currency conversion',
    'transfer', 'transfers', 'transfer in', 'transfer out',
    'internal transfer', 'internal transfers',
    'wallet transfer', 'wallet transfers',
    'account transfer', 'account transfers'
  ) then
    raise exception 'Budgets cannot use internal balance movement categories'
      using errcode = '23514';
  end if;

  if new.wallet_id is not null then
    select user_id into wallet_user_id
    from public.wallets
    where id = new.wallet_id;

    if wallet_user_id is null or wallet_user_id is distinct from new.user_id then
      raise exception 'Budget wallet must belong to the budget owner' using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists budgets_dimension_guard on public.budgets;
create trigger budgets_dimension_guard
before insert or update of user_id, wallet_id, category_id, month, amount_minor
on public.budgets
for each row execute function public.validate_budget_dimensions();

create or replace function public.guard_category_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if old.type is distinct from new.type and (
    exists (select 1 from public.transactions where category_id = old.id) or
    exists (select 1 from public.budgets where category_id = old.id) or
    exists (select 1 from public.recurring_rules where category_id = old.id)
  ) then
    raise exception 'A category with ledger references cannot change type'
      using errcode = '23514';
  end if;

  if old.is_active and not new.is_active and exists (
    select 1
    from public.recurring_rules
    where category_id = old.id and is_active
  ) then
    raise exception 'Pause active recurring rules before disabling their category'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists categories_lifecycle_guard on public.categories;
create trigger categories_lifecycle_guard
before update of type, is_active
on public.categories
for each row execute function public.guard_category_lifecycle();

revoke all on function public.validate_budget_dimensions() from public, anon, authenticated;
revoke all on function public.guard_category_lifecycle() from public, anon, authenticated;

