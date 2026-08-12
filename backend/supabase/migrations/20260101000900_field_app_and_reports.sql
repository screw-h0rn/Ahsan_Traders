-- ============================================================================
-- 09 · Field app sync and reporting.
--
-- The field app (order bookers, delivery staff) works offline and replays a
-- queue when it reconnects. sync_mobile_action() is that replay endpoint. It
-- is idempotent on (device_id, local_action_id), applies the same role rules
-- as the web portal, and — crucially — does NOT move stock. A booked order is
-- `pending`, exactly like one keyed in at the counter.
-- ============================================================================

create or replace function public.sync_mobile_action(
  p_device_id text,
  p_local_action_id text,
  p_action_type text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text := public.current_staff_role();
  v_user uuid := auth.uid();
  v_existing record;
  v_result record;
  v_status text;
  v_customer_id uuid;
  v_branch_id uuid;
  v_amount numeric;
begin
  if v_role is null then
    return jsonb_build_object('local_action_id', p_local_action_id, 'status', 'failed',
                              'conflict_reason', 'This account is not active staff.');
  end if;
  if coalesce(trim(p_device_id), '') = '' or coalesce(trim(p_local_action_id), '') = '' then
    return jsonb_build_object('local_action_id', p_local_action_id, 'status', 'failed',
                              'conflict_reason', 'Device id and action id are required.');
  end if;

  -- Replay protection: return whatever happened the first time.
  select status, server_reference_id, conflict_reason into v_existing
  from public.mobile_sync_queue
  where device_id = p_device_id and local_action_id = p_local_action_id;

  if found then
    return jsonb_build_object(
      'local_action_id', p_local_action_id,
      'status', v_existing.status,
      'server_reference_id', v_existing.server_reference_id,
      'conflict_reason', v_existing.conflict_reason,
      'replayed', true
    );
  end if;

  -- ---- BOOK_ORDER --------------------------------------------------------
  if p_action_type = 'BOOK_ORDER' then
    if v_role not in ('owner', 'manager', 'sales') then
      insert into public.mobile_sync_queue (user_id, device_id, local_action_id, action_type, payload, status, conflict_reason)
      values (v_user, p_device_id, p_local_action_id, p_action_type, p_payload, 'failed', 'Your role cannot book orders.');
      return jsonb_build_object('local_action_id', p_local_action_id, 'status', 'failed',
                                'conflict_reason', 'Your role cannot book orders.');
    end if;

    v_customer_id := (p_payload ->> 'customer_id')::uuid;
    v_branch_id := coalesce(
      (p_payload ->> 'branch_id')::uuid,
      (select id from public.branches where status = 'active' order by is_default desc, name limit 1)
    );

    begin
      select * into v_result from public.create_sales_order(
        v_customer_id, v_branch_id, coalesce(p_payload ->> 'notes', 'Booked in the field'),
        p_payload -> 'items', 'field_app'
      );
    exception when others then
      insert into public.mobile_sync_queue (user_id, device_id, local_action_id, action_type, payload, status, conflict_reason)
      values (v_user, p_device_id, p_local_action_id, p_action_type, p_payload, 'failed', sqlerrm);
      return jsonb_build_object('local_action_id', p_local_action_id, 'status', 'failed',
                                'conflict_reason', sqlerrm);
    end;

    -- A held order is not a failure — it synced, and a manager must look at it.
    v_status := case when v_result.order_status = 'held' then 'conflict_requires_review' else 'synced' end;

    insert into public.mobile_sync_queue (
      user_id, device_id, local_action_id, action_type, payload, status, server_reference_id, conflict_reason
    ) values (
      v_user, p_device_id, p_local_action_id, p_action_type, p_payload, v_status,
      v_result.sales_order_id, v_result.hold_reason
    );

    return jsonb_build_object(
      'local_action_id', p_local_action_id,
      'status', v_status,
      'server_reference_id', v_result.sales_order_id,
      'document_number', v_result.so_number,
      'conflict_reason', v_result.hold_reason
    );

  -- ---- CAPTURE_PAYMENT ---------------------------------------------------
  elsif p_action_type = 'CAPTURE_PAYMENT' then
    if v_role not in ('owner', 'manager', 'accountant') then
      insert into public.mobile_sync_queue (user_id, device_id, local_action_id, action_type, payload, status, conflict_reason)
      values (v_user, p_device_id, p_local_action_id, p_action_type, p_payload, 'failed', 'Your role cannot record payments.');
      return jsonb_build_object('local_action_id', p_local_action_id, 'status', 'failed',
                                'conflict_reason', 'Your role cannot record payments.');
    end if;

    v_amount := coalesce((p_payload ->> 'amount')::numeric, 0);

    begin
      -- Goes through record_payment, so a field collection allocates against
      -- open invoices exactly like one taken at the counter. (In the previous
      -- system it bypassed this and invoices stayed marked unpaid.)
      select * into v_result from public.record_payment(
        'customer',
        (p_payload ->> 'party_id')::uuid,
        'in',
        v_amount,
        coalesce(p_payload ->> 'method', 'cash'),
        coalesce((p_payload ->> 'payment_date')::date, current_date),
        coalesce(p_payload ->> 'notes', 'Collected in the field'),
        p_payload ->> 'reference',
        null
      );
    exception when others then
      insert into public.mobile_sync_queue (user_id, device_id, local_action_id, action_type, payload, status, conflict_reason)
      values (v_user, p_device_id, p_local_action_id, p_action_type, p_payload, 'failed', sqlerrm);
      return jsonb_build_object('local_action_id', p_local_action_id, 'status', 'failed',
                                'conflict_reason', sqlerrm);
    end;

    insert into public.mobile_sync_queue (
      user_id, device_id, local_action_id, action_type, payload, status, server_reference_id
    ) values (
      v_user, p_device_id, p_local_action_id, p_action_type, p_payload, 'synced', v_result.payment_id
    );

    return jsonb_build_object(
      'local_action_id', p_local_action_id,
      'status', 'synced',
      'server_reference_id', v_result.payment_id,
      'document_number', v_result.payment_number
    );
  end if;

  return jsonb_build_object('local_action_id', p_local_action_id, 'status', 'failed',
                            'conflict_reason', 'Unsupported action type: ' || coalesce(p_action_type, 'null'));
end;
$$;

/** Reference data the field app caches for offline use. */
create or replace function public.field_app_bootstrap(p_branch_id uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_role text := public.current_staff_role();
  v_branch uuid;
begin
  if v_role is null or v_role not in ('owner', 'manager', 'sales', 'accountant') then
    raise exception 'Your role cannot use the field app.' using errcode = '42501';
  end if;

  v_branch := coalesce(
    p_branch_id,
    (select id from public.branches where status = 'active' order by is_default desc, name limit 1)
  );

  return jsonb_build_object(
    'branch_id', v_branch,
    'company', (select to_jsonb(cs) - 'id' from public.company_settings cs where cs.id),
    'branches', (select coalesce(jsonb_agg(jsonb_build_object('id', b.id, 'name', b.name, 'type', b.type)), '[]'::jsonb)
                 from public.branches b where b.status = 'active'),
    'customers', (select coalesce(jsonb_agg(jsonb_build_object(
                    'id', c.id, 'name', c.name, 'phone', c.phone,
                    'balance', public.customer_balance(c.id),
                    'credit_limit', c.credit_limit,
                    'available_credit', public.customer_available_credit(c.id))), '[]'::jsonb)
                  from public.customers c where c.status = 'active'),
    'products', (select coalesce(jsonb_agg(jsonb_build_object(
                    'id', p.id, 'name', p.name, 'sku', p.sku, 'barcode', p.barcode,
                    'variant_label', p.variant_label, 'unit', p.unit,
                    'units_per_carton', p.units_per_carton,
                    'unit_price', p.sale_price,
                    'carton_price', coalesce(p.carton_sale_price, p.sale_price * p.units_per_carton),
                    'quantity', coalesce((select i.quantity from public.inventory i
                                          where i.product_id = p.id and i.branch_id = v_branch), 0))), '[]'::jsonb)
                 from public.products p where p.status = 'active'),
    'cached_at', now()
  );
end;
$$;

-- ============================================================================
-- Reports
-- ============================================================================

create or replace function public.report_sales_summary(
  p_start_date date default null,
  p_end_date date default null,
  p_customer_id uuid default null
)
returns table (
  invoice_id uuid,
  invoice_number text,
  invoice_date date,
  customer_name text,
  subtotal numeric,
  tax_amount numeric,
  total numeric,
  amount_paid numeric,
  payment_status text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if public.current_staff_role() not in ('owner', 'manager', 'sales', 'accountant') then
    raise exception 'Your role cannot view sales reports.' using errcode = '42501';
  end if;

  return query
  select si.id, si.invoice_number, si.invoice_date, c.name,
         si.subtotal, si.tax_amount, si.total, si.amount_paid, si.payment_status
  from public.sales_invoices si
  join public.customers c on c.id = si.customer_id
  where si.status = 'posted'
    and (p_start_date is null or si.invoice_date >= p_start_date)
    and (p_end_date is null or si.invoice_date <= p_end_date)
    and (p_customer_id is null or si.customer_id = p_customer_id)
  order by si.invoice_date desc, si.created_at desc;
end;
$$;

create or replace function public.report_inventory_status(
  p_branch_id uuid default null,
  p_low_stock_only boolean default false
)
returns table (
  product_id uuid,
  name text,
  sku text,
  unit text,
  branch_name text,
  quantity numeric,
  reorder_threshold numeric,
  is_low boolean,
  cost_value numeric,
  retail_value numeric
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if public.current_staff_role() not in ('owner', 'manager', 'warehouse', 'accountant') then
    raise exception 'Your role cannot view inventory reports.' using errcode = '42501';
  end if;

  return query
  select p.id, p.name, p.sku, p.unit, b.name,
         i.quantity, i.reorder_threshold,
         i.quantity <= i.reorder_threshold,
         round(i.quantity * p.avg_cost, 2),
         round(i.quantity * p.sale_price, 2)
  from public.inventory i
  join public.products p on p.id = i.product_id
  join public.branches b on b.id = i.branch_id
  where p.status = 'active'
    and (p_branch_id is null or i.branch_id = p_branch_id)
    and (not coalesce(p_low_stock_only, false) or i.quantity <= i.reorder_threshold)
  order by p.name;
end;
$$;

create or replace function public.report_profit(
  p_start_date date default null,
  p_end_date date default null
)
returns table (
  product_id uuid,
  name text,
  sku text,
  quantity_sold numeric,
  revenue numeric,
  cogs numeric,
  gross_profit numeric,
  margin_pct numeric
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if public.current_staff_role() not in ('owner', 'manager', 'accountant') then
    raise exception 'Your role cannot view profit reports.' using errcode = '42501';
  end if;

  return query
  select p.id, p.name, p.sku,
         round(sum(sii.quantity), 3),
         round(sum(sii.line_total), 2),
         round(sum(sii.quantity * sii.unit_cost), 2),
         round(sum(sii.line_total) - sum(sii.quantity * sii.unit_cost), 2),
         case when sum(sii.line_total) > 0
           then round((sum(sii.line_total) - sum(sii.quantity * sii.unit_cost)) / sum(sii.line_total) * 100, 2)
           else 0 end
  from public.sales_invoice_items sii
  join public.sales_invoices si on si.id = sii.sales_invoice_id
  join public.products p on p.id = sii.product_id
  where si.status = 'posted'
    and (p_start_date is null or si.invoice_date >= p_start_date)
    and (p_end_date is null or si.invoice_date <= p_end_date)
  group by p.id, p.name, p.sku
  order by 7 desc;
end;
$$;

/** Who owes us, and who we owe. */
create or replace function public.report_party_balances(p_party_type text)
returns table (party_id uuid, name text, phone text, balance numeric, credit_limit numeric)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if public.current_staff_role() not in ('owner', 'manager', 'accountant') then
    raise exception 'Your role cannot view balances.' using errcode = '42501';
  end if;

  if p_party_type = 'customer' then
    return query
    select c.id, c.name, c.phone, public.customer_balance(c.id), c.credit_limit
    from public.customers c
    where c.status = 'active' and public.customer_balance(c.id) <> 0
    order by public.customer_balance(c.id) desc;
  elsif p_party_type = 'supplier' then
    return query
    select s.id, s.name, s.phone, public.supplier_balance(s.id), null::numeric
    from public.suppliers s
    where s.status = 'active' and public.supplier_balance(s.id) <> 0
    order by public.supplier_balance(s.id) desc;
  else
    raise exception 'Party must be a customer or a supplier.';
  end if;
end;
$$;

/** Owner dashboard, in one round trip. */
create or replace function public.dashboard_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if public.current_staff_role() is null then
    raise exception 'Staff only.' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'sales_today', (select coalesce(sum(total), 0) from public.sales_invoices
                    where status = 'posted' and invoice_date = current_date),
    'invoices_today', (select count(*) from public.sales_invoices
                       where status = 'posted' and invoice_date = current_date),
    'receivables', (select coalesce(sum(public.customer_balance(c.id)), 0)
                    from public.customers c where c.status = 'active'),
    'payables', (select coalesce(sum(public.supplier_balance(s.id)), 0)
                 from public.suppliers s where s.status = 'active'),
    'orders_awaiting_approval', (select count(*) from public.sales_orders where status = 'awaiting_approval'),
    'orders_pending', (select count(*) from public.sales_orders where status = 'pending'),
    'orders_held', (select count(*) from public.sales_orders where status = 'held'),
    'low_stock_count', (select count(*) from public.inventory i
                        join public.products p on p.id = i.product_id
                        where p.status = 'active' and i.quantity <= i.reorder_threshold),
    'unlinked_customer_logins', (select count(*) from public.customer_accounts where status = 'pending')
  );
end;
$$;

revoke all on function public.sync_mobile_action(text, text, text, jsonb) from public, anon;
revoke all on function public.field_app_bootstrap(uuid) from public, anon;
revoke all on function public.report_sales_summary(date, date, uuid) from public, anon;
revoke all on function public.report_inventory_status(uuid, boolean) from public, anon;
revoke all on function public.report_profit(date, date) from public, anon;
revoke all on function public.report_party_balances(text) from public, anon;
revoke all on function public.dashboard_summary() from public, anon;

grant execute on function public.sync_mobile_action(text, text, text, jsonb) to authenticated, service_role;
grant execute on function public.field_app_bootstrap(uuid) to authenticated, service_role;
grant execute on function public.report_sales_summary(date, date, uuid) to authenticated, service_role;
grant execute on function public.report_inventory_status(uuid, boolean) to authenticated, service_role;
grant execute on function public.report_profit(date, date) to authenticated, service_role;
grant execute on function public.report_party_balances(text) to authenticated, service_role;
grant execute on function public.dashboard_summary() to authenticated, service_role;
