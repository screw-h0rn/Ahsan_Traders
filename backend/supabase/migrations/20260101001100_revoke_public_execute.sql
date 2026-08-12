-- ============================================================================
-- 11 · Close the PUBLIC execute loophole.
--
-- Postgres grants EXECUTE on every new function to the pseudo-role PUBLIC.
-- `revoke ... from anon` does NOT remove that: anon inherits it through PUBLIC,
-- so the previous migration's revoke left six trigger functions callable by an
-- unauthenticated visitor —
--
--   assert_single_identity, handle_new_user, log_audit_event,
--   prevent_audit_modification, prevent_category_cycle, set_updated_at
--
-- None is dangerous on its own (they are trigger functions and misbehave or
-- do nothing when called directly), but "no anonymous access, at all" is only
-- a useful rule if it is actually true.
--
-- Trigger functions do not need a runtime EXECUTE grant: the trigger fires as
-- part of the statement on the table, and permission is checked when the
-- trigger is created, not when it runs. So PUBLIC loses execute on everything,
-- and the callable API surface is re-granted explicitly below.
-- ============================================================================

revoke execute on all functions in schema public from public;
revoke execute on all functions in schema public from anon;

-- Future functions default to no PUBLIC execute either.
alter default privileges in schema public revoke execute on functions from public;
alter default privileges in schema public revoke execute on functions from anon;

-- ---------------------------------------------------------------------------
-- Re-grant exactly the API surface. Anything not on this list is unreachable
-- from a client, which is the point.
-- ---------------------------------------------------------------------------
do $$
declare
  v_fn text;
begin
  foreach v_fn in array array[
    -- identity helpers
    'current_staff_role()',
    'current_customer_id()',
    'is_staff()',
    'staff_has_role(text[])',
    'normalize_phone(text)',
    -- catalogue
    'product_unit_price(public.products, text)',
    'product_on_hand(uuid)',
    -- stock
    'adjust_stock(uuid, uuid, numeric, numeric, text, text, text, uuid)',
    'create_stock_transfer(uuid, uuid, text, jsonb)',
    'receive_stock_transfer(uuid)',
    'cancel_stock_transfer(uuid)',
    -- money
    'customer_balance(uuid)',
    'supplier_balance(uuid)',
    'customer_available_credit(uuid)',
    'customer_would_exceed_credit(uuid, numeric)',
    'record_payment(text, uuid, text, numeric, text, date, text, text, jsonb)',
    'open_documents(text, uuid)',
    -- purchasing
    'create_purchase_order(uuid, uuid, date, text, jsonb)',
    'issue_purchase_order(uuid)',
    'receive_purchase_order(uuid, date, text, jsonb)',
    -- sales
    'create_sales_order(uuid, uuid, text, jsonb, text)',
    'approve_sales_order(uuid)',
    'cancel_sales_order(uuid, text)',
    'create_sales_invoice(uuid, date, text)',
    -- customer app
    'customer_me()',
    'customer_catalog(text, uuid, integer, integer)',
    'customer_categories()',
    'customer_place_order(jsonb, text)',
    'customer_my_orders(text, integer, integer)',
    'customer_order_detail(uuid)',
    'customer_my_invoices(boolean, integer, integer)',
    'customer_my_statement(date, date)',
    'link_customer_account(uuid, uuid)',
    'block_customer_account(uuid)',
    -- devices and notifications
    'register_push_token(text, text)',
    'mark_notifications_read(uuid)',
    -- field app and reporting
    'sync_mobile_action(text, text, text, jsonb)',
    'field_app_bootstrap(uuid)',
    'report_sales_summary(date, date, uuid)',
    'report_inventory_status(uuid, boolean)',
    'report_profit(date, date)',
    'report_party_balances(text)',
    'dashboard_summary()'
  ]
  loop
    execute format('grant execute on function public.%s to authenticated, service_role', v_fn);
  end loop;
end
$$;

-- ---------------------------------------------------------------------------
-- Assert the rule actually holds now, rather than trusting that it does.
-- ---------------------------------------------------------------------------
do $$
declare
  v_bad text;
begin
  select string_agg(p.proname, ', ') into v_bad
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute');

  if v_bad is not null then
    raise exception 'Functions still executable by anon: %', v_bad;
  end if;
end
$$;

do $$
declare
  v_bad text;
begin
  select string_agg(table_name, ', ') into v_bad
  from information_schema.role_table_grants
  where table_schema = 'public' and grantee = 'anon';

  if v_bad is not null then
    raise exception 'Tables still reachable by anon: %', v_bad;
  end if;
end
$$;
