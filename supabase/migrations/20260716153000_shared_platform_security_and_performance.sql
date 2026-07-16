-- Harden shared Supabase objects without breaking public FX reads or service-role workflows.
-- This database is shared by Gorilla Ledger, Savvy Rilla FX, EAMU, and Savvy Rilla websites.

-- Public reference data remains readable, but only trusted server-side callers may mutate it.
alter table public.currencies enable row level security;
alter table public.fx_sources enable row level security;
alter table public.fx_daily_rates enable row level security;

revoke all on table public.currencies from anon, authenticated;
revoke all on table public.fx_sources from anon, authenticated;
revoke all on table public.fx_daily_rates from anon, authenticated;

grant select on table public.currencies to anon, authenticated;
grant select on table public.fx_sources to anon, authenticated;
grant select on table public.fx_daily_rates to anon, authenticated;

drop policy if exists currencies_public_read on public.currencies;
create policy currencies_public_read
on public.currencies for select
to anon, authenticated
using (true);

drop policy if exists fx_sources_public_read on public.fx_sources;
create policy fx_sources_public_read
on public.fx_sources for select
to anon, authenticated
using (true);

drop policy if exists fx_daily_rates_public_read on public.fx_daily_rates;
create policy fx_daily_rates_public_read
on public.fx_daily_rates for select
to anon, authenticated
using (true);

-- Import staging data is an internal implementation detail. Service-role access bypasses RLS.
alter table public.fx_import_jobs enable row level security;
alter table public.fx_import_raw enable row level security;

revoke all on table public.fx_import_jobs from anon, authenticated;
revoke all on table public.fx_import_raw from anon, authenticated;

-- Views must respect the privileges and RLS policies of the querying user.
alter view if exists public.category_spending_current_month
  set (security_invoker = true);
alter view if exists public.category_spending_current_year
  set (security_invoker = true);
alter view if exists public.daily_income_expense
  set (security_invoker = true);
alter view if exists public.daily_income_expense_last_12_months
  set (security_invoker = true);
alter view if exists public.fx_daily_rates_default
  set (security_invoker = true);

revoke all on table public.category_spending_current_month from anon;
revoke all on table public.category_spending_current_year from anon;
revoke all on table public.daily_income_expense from anon;
revoke all on table public.daily_income_expense_last_12_months from anon;
grant select on table public.category_spending_current_month to authenticated;
grant select on table public.category_spending_current_year to authenticated;
grant select on table public.daily_income_expense to authenticated;
grant select on table public.daily_income_expense_last_12_months to authenticated;

revoke all on table public.fx_daily_rates_default from anon, authenticated;
grant select on table public.fx_daily_rates_default to anon, authenticated;

-- Trigger functions require elevated execution from their triggers, not direct client RPC access.
do $functions$
declare
  function_record record;
begin
  for function_record in
    select procedure.oid::regprocedure as identity
    from pg_catalog.pg_proc as procedure
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public'
      and procedure.proname in (
        'handle_new_user',
        'set_timestamp',
        'set_timestamp_updated_at',
        'validate_transaction_dimensions',
        'validate_recurring_dimensions'
      )
  loop
    execute format(
      'alter function %s set search_path = pg_catalog, public',
      function_record.identity
    );
    execute format(
      'revoke execute on function %s from public, anon, authenticated',
      function_record.identity
    );
  end loop;
end
$functions$;

-- is_admin is an authenticated helper, not a public RPC.
alter function public.is_admin(uuid) set search_path = pg_catalog, public;
revoke execute on function public.is_admin(uuid) from public, anon;
grant execute on function public.is_admin(uuid) to authenticated;

-- Evaluate auth helpers once per statement instead of once for every candidate row.
-- ALTER POLICY retains the original command and role list; only its expressions change.
do $policies$
declare
  policy_record record;
  using_expression text;
  check_expression text;
  alter_statement text;
begin
  for policy_record in
    select schemaname, tablename, policyname, qual, with_check
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and (
        coalesce(qual, '') ~ 'auth\.(uid|email|role)\(\)'
        or coalesce(with_check, '') ~ 'auth\.(uid|email|role)\(\)'
      )
      and coalesce(qual, '') !~* 'select\s+auth\.(uid|email|role)\(\)'
      and coalesce(with_check, '') !~* 'select\s+auth\.(uid|email|role)\(\)'
  loop
    using_expression := policy_record.qual;
    check_expression := policy_record.with_check;

    if using_expression is not null then
      using_expression := replace(using_expression, 'auth.uid()', '(select auth.uid())');
      using_expression := replace(using_expression, 'auth.email()', '(select auth.email())');
      using_expression := replace(using_expression, 'auth.role()', '(select auth.role())');
    end if;

    if check_expression is not null then
      check_expression := replace(check_expression, 'auth.uid()', '(select auth.uid())');
      check_expression := replace(check_expression, 'auth.email()', '(select auth.email())');
      check_expression := replace(check_expression, 'auth.role()', '(select auth.role())');
    end if;

    alter_statement := format(
      'alter policy %I on %I.%I',
      policy_record.policyname,
      policy_record.schemaname,
      policy_record.tablename
    );

    if using_expression is not null then
      alter_statement := alter_statement || format(' using (%s)', using_expression);
    end if;
    if check_expression is not null then
      alter_statement := alter_statement || format(' with check (%s)', check_expression);
    end if;

    execute alter_statement;
  end loop;
end
$policies$;

-- Replace overlapping legacy FX administration policies with equivalent,
-- action-specific policies. This preserves the same read/write population while
-- ensuring PostgreSQL evaluates only one permissive policy for each action.
drop policy if exists fixing_schedule_admin_write on public.fixing_schedule;
drop policy if exists fixing_schedule_admin_insert on public.fixing_schedule;
drop policy if exists fixing_schedule_admin_update on public.fixing_schedule;
drop policy if exists fixing_schedule_admin_delete on public.fixing_schedule;

create policy fixing_schedule_admin_insert
on public.fixing_schedule for insert
to authenticated
with check (
  (select auth.email()) = any (
    array['admin@savvygorilla.tech'::text, 'dau.garang@boss.gov.ss'::text]
  )
);

create policy fixing_schedule_admin_update
on public.fixing_schedule for update
to authenticated
using (
  (select auth.email()) = any (
    array['admin@savvygorilla.tech'::text, 'dau.garang@boss.gov.ss'::text]
  )
)
with check (
  (select auth.email()) = any (
    array['admin@savvygorilla.tech'::text, 'dau.garang@boss.gov.ss'::text]
  )
);

create policy fixing_schedule_admin_delete
on public.fixing_schedule for delete
to authenticated
using (
  (select auth.email()) = any (
    array['admin@savvygorilla.tech'::text, 'dau.garang@boss.gov.ss'::text]
  )
);

drop policy if exists manual_fixings_delete_admin on public.manual_fixings;
drop policy if exists manual_fixings_delete_admin_only on public.manual_fixings;
drop policy if exists manual_fixings_insert on public.manual_fixings;
drop policy if exists manual_fixings_insert_admin on public.manual_fixings;
drop policy if exists manual_fixings_insert_authenticated on public.manual_fixings;
drop policy if exists manual_fixings_select on public.manual_fixings;
drop policy if exists manual_fixings_select_auth on public.manual_fixings;
drop policy if exists manual_fixings_update_admin on public.manual_fixings;
drop policy if exists manual_fixings_update_admin_only on public.manual_fixings;

create policy manual_fixings_select_auth
on public.manual_fixings for select
to authenticated
using (true);

create policy manual_fixings_insert_authenticated
on public.manual_fixings for insert
to authenticated
with check (true);

create policy manual_fixings_update_admin
on public.manual_fixings for update
to authenticated
using (
  (select public.is_admin())
  or ((select auth.jwt()) ->> 'email') = 'admin@savvygorilla.tech'
)
with check (
  (select public.is_admin())
  or ((select auth.jwt()) ->> 'email') = 'admin@savvygorilla.tech'
);

create policy manual_fixings_delete_admin
on public.manual_fixings for delete
to authenticated
using (
  (select public.is_admin())
  or ((select auth.jwt()) ->> 'email') = 'admin@savvygorilla.tech'
);

-- Add a covering index for every foreign key that does not already have one.
-- This improves joins and prevents referenced-row updates/deletes from scanning child tables.
do $indexes$
declare
  foreign_key record;
  index_name text;
begin
  for foreign_key in
    select
      constraint_record.conrelid,
      namespace.nspname as schema_name,
      relation.relname as table_name,
      constraint_record.conname as constraint_name,
      string_agg(format('%I', attribute.attname), ', ' order by key_column.ordinality) as columns_sql
    from pg_catalog.pg_constraint as constraint_record
    join pg_catalog.pg_class as relation
      on relation.oid = constraint_record.conrelid
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = relation.relnamespace
    cross join lateral unnest(constraint_record.conkey)
      with ordinality as key_column(attribute_number, ordinality)
    join pg_catalog.pg_attribute as attribute
      on attribute.attrelid = constraint_record.conrelid
     and attribute.attnum = key_column.attribute_number
    where constraint_record.contype = 'f'
      and namespace.nspname = 'public'
      and not exists (
        select 1
        from pg_catalog.pg_index as index_record
        where index_record.indrelid = constraint_record.conrelid
          and index_record.indisvalid
          and (
            select array_agg(index_key.attribute_number order by index_key.ordinality)
            from unnest(index_record.indkey::smallint[])
              with ordinality as index_key(attribute_number, ordinality)
            where index_key.ordinality <= cardinality(constraint_record.conkey)
          ) = constraint_record.conkey
      )
    group by constraint_record.conrelid, namespace.nspname, relation.relname,
             constraint_record.conname
  loop
    index_name := left(foreign_key.constraint_name || '_idx', 63);
    execute format(
      'create index if not exists %I on %I.%I (%s)',
      index_name,
      foreign_key.schema_name,
      foreign_key.table_name,
      foreign_key.columns_sql
    );
  end loop;
end
$indexes$;

-- Fail closed if any critical table remains writable by a browser role.
do $assertions$
begin
  if exists (
    select 1
    from (values
      ('currencies'),
      ('fx_sources'),
      ('fx_daily_rates'),
      ('fx_import_jobs'),
      ('fx_import_raw')
    ) as protected_table(table_name)
    where has_table_privilege('anon', format('public.%I', protected_table.table_name), 'INSERT')
       or has_table_privilege('anon', format('public.%I', protected_table.table_name), 'UPDATE')
       or has_table_privilege('anon', format('public.%I', protected_table.table_name), 'DELETE')
       or has_table_privilege('authenticated', format('public.%I', protected_table.table_name), 'INSERT')
       or has_table_privilege('authenticated', format('public.%I', protected_table.table_name), 'UPDATE')
       or has_table_privilege('authenticated', format('public.%I', protected_table.table_name), 'DELETE')
  ) then
    raise exception 'Shared FX tables still expose client write privileges';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_class as relation
    join pg_catalog.pg_namespace as namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname in (
        'currencies', 'fx_sources', 'fx_daily_rates', 'fx_import_jobs', 'fx_import_raw'
      )
      and not relation.relrowsecurity
  ) then
    raise exception 'RLS is not enabled on every shared FX table';
  end if;
end
$assertions$;
