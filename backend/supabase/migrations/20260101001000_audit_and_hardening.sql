-- ============================================================================
-- 10 · Audit triggers and the final privilege lockdown.
--
-- Runs last, once every table exists. Two jobs:
--
--   1. attach the audit trigger to everything that records business facts;
--   2. take away every privilege that is not actually needed, so the write
--      path is enforced by grants AND policies AND definer boundaries rather
--      than by any one of them alone.
--
-- integration_settings is deliberately NOT audited: it holds an access token,
-- and audit rows are immutable, so a leaked token could never be redacted.
-- ============================================================================

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'company_settings', 'staff', 'customers', 'customer_accounts',
    'branches', 'categories', 'products', 'suppliers',
    'inventory', 'stock_movements', 'stock_transfers', 'stock_transfer_items',
    'purchase_orders', 'purchase_order_items', 'goods_receipts', 'goods_receipt_items',
    'quotations', 'quotation_items',
    'sales_orders', 'sales_order_items', 'sales_invoices', 'sales_invoice_items',
    'ledger_entries', 'payments', 'payment_allocations'
  ]
  loop
    execute format(
      'create trigger %I after insert or update or delete on public.%I
         for each row execute function public.log_audit_event()',
      'audit_' || v_table, v_table
    );
  end loop;
end
$$;

-- ---------------------------------------------------------------------------
-- Nothing for anonymous visitors. Ever.
-- ---------------------------------------------------------------------------
revoke all on all tables in schema public from anon;
revoke all on all functions in schema public from anon;
revoke all on all sequences in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on functions from anon;

-- ---------------------------------------------------------------------------
-- Transactional tables are written ONLY by SECURITY DEFINER functions, which
-- run as the owner and therefore bypass these grants. `authenticated` needs
-- read access and nothing more.
-- ---------------------------------------------------------------------------
revoke insert, update, delete on
  public.audit_logs,
  public.ledger_entries,
  public.payments,
  public.payment_allocations,
  public.inventory,
  public.stock_movements,
  public.stock_transfers,
  public.stock_transfer_items,
  public.purchase_orders,
  public.purchase_order_items,
  public.goods_receipts,
  public.goods_receipt_items,
  public.quotations,
  public.quotation_items,
  public.sales_orders,
  public.sales_order_items,
  public.sales_invoices,
  public.sales_invoice_items,
  public.mobile_sync_queue,
  public.message_log,
  public.customer_accounts,
  public.notifications,
  public.device_push_tokens
from authenticated;

-- notifications: a user marks their own as read, through mark_notifications_read().
-- device_push_tokens: registered through register_push_token().
-- Neither needs a direct grant.

-- Master data keeps INSERT/UPDATE (each has a role-gated policy) but never
-- DELETE — records are archived, so history stays readable.
revoke delete on
  public.branches, public.categories, public.customers,
  public.products, public.suppliers, public.staff, public.company_settings
from authenticated;

revoke insert, delete on public.staff, public.company_settings from authenticated;

-- ---------------------------------------------------------------------------
-- Sanity: every SECURITY DEFINER function must pin its search_path, or a
-- caller could shadow a table name and have the function run their code as
-- the owner. Fail the migration rather than ship that.
-- ---------------------------------------------------------------------------
do $$
declare
  v_bad text;
begin
  select string_agg(p.proname, ', ') into v_bad
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.prosecdef
    and not exists (
      select 1 from unnest(coalesce(p.proconfig, '{}')) cfg where cfg like 'search_path=%'
    );

  if v_bad is not null then
    raise exception 'SECURITY DEFINER functions without a pinned search_path: %', v_bad;
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- Sanity: no table may be left without row-level security.
-- ---------------------------------------------------------------------------
do $$
declare
  v_bad text;
begin
  select string_agg(c.relname, ', ') into v_bad
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;

  if v_bad is not null then
    raise exception 'Tables without row-level security: %', v_bad;
  end if;
end
$$;
