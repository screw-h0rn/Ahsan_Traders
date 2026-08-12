-- ============================================================================
-- 14 · CRITICAL FIX — a NULL role silently bypassed the permission check on
-- ten functions, including adjust_stock, sync_mobile_action, and every
-- reporting/statement function.
--
-- THE BUG
--
--   if public.current_staff_role() not in ('owner', 'manager') then
--     raise exception ...
--   end if;
--
-- current_staff_role() returns NULL for anyone who is not active staff — a
-- shop's customer_accounts login, an unlinked signup, anyone. In SQL,
-- `NULL not in (...)` evaluates to NULL, not TRUE. In plpgsql, `if NULL then`
-- takes the FALSE branch. So the guard was silently skipped for exactly the
-- callers it exists to stop, and the function ran to completion.
--
-- Caught during manual verification of the live project on 10 Aug 2026 —
-- report_party_balances('customer') returned every customer's name, phone
-- and outstanding balance regardless of who called it. adjust_stock had the
-- identical hole: any signed-in account, staff or not, could rewrite
-- inventory.
--
-- THE FIX
--
--   if v_role is null or v_role not in ('owner', 'manager') then
--
-- NULL is now caught explicitly before the list check ever runs. Every
-- function below is corrected, and a migration-time assertion at the bottom
-- makes this pattern impossible to reintroduce silently in the future.
-- ============================================================================

-- ---------- adjust_stock: could rewrite inventory as ANY signed-in user -----
create or replace function public.adjust_stock(
  p_product_id uuid,
  p_branch_id uuid,
  p_quantity_delta numeric default 0,
  p_reorder_threshold numeric default null,
  p_movement_type text default 'adjustment',
  p_notes text default null,
  p_reference_type text default null,
  p_reference_id uuid default null
)
returns table (inventory_id uuid, quantity numeric, reorder_threshold numeric)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text := public.current_staff_role();
begin
  if v_role is null or v_role not in ('owner', 'manager', 'warehouse') then
    raise exception 'Your role is not allowed to change stock.' using errcode = '42501';
  end if;

  if p_movement_type not in ('opening', 'adjustment', 'damage') then
    raise exception 'A manual adjustment must be opening, adjustment or damage.';
  end if;

  return query select * from public.apply_stock_movement(
    p_product_id, p_branch_id, p_quantity_delta, p_reorder_threshold,
    p_movement_type, p_notes, p_reference_type, p_reference_id
  );
end;
$$;

-- ---------- sync_mobile_action: field-app role checks -----------------------
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

  if p_action_type = 'BOOK_ORDER' then
    -- v_role is already known not-null here; the list check alone is safe.
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

  elsif p_action_type = 'CAPTURE_PAYMENT' then
    if v_role not in ('owner', 'manager', 'accountant') then
      insert into public.mobile_sync_queue (user_id, device_id, local_action_id, action_type, payload, status, conflict_reason)
      values (v_user, p_device_id, p_local_action_id, p_action_type, p_payload, 'failed', 'Your role cannot record payments.');
      return jsonb_build_object('local_action_id', p_local_action_id, 'status', 'failed',
                                'conflict_reason', 'Your role cannot record payments.');
    end if;

    v_amount := coalesce((p_payload ->> 'amount')::numeric, 0);

    begin
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

-- ---------- field_app_bootstrap ----------------------------------------------
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

-- ---------- report_sales_summary (final signature: 4 args) ------------------
create or replace function public.report_sales_summary(
  p_start_date date default null,
  p_end_date date default null,
  p_customer_id uuid default null,
  p_branch_id uuid default null
)
returns table (
  invoice_id uuid, invoice_number text, invoice_date date, customer_name text,
  branch_name text, subtotal numeric, tax_amount numeric, total numeric,
  amount_paid numeric, outstanding numeric, payment_status text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_role text := public.current_staff_role();
begin
  if v_role is null or v_role not in ('owner', 'manager', 'sales', 'accountant') then
    raise exception 'Your role cannot view sales reports.' using errcode = '42501';
  end if;

  return query
  select si.id, si.invoice_number, si.invoice_date, c.name, b.name,
         si.subtotal, si.tax_amount, si.total, si.amount_paid,
         si.total - si.amount_paid, si.payment_status
  from public.sales_invoices si
  join public.customers c on c.id = si.customer_id
  join public.branches b on b.id = si.branch_id
  where si.status = 'posted'
    and (p_start_date is null or si.invoice_date >= p_start_date)
    and (p_end_date is null or si.invoice_date <= p_end_date)
    and (p_customer_id is null or si.customer_id = p_customer_id)
    and (p_branch_id is null or si.branch_id = p_branch_id)
  order by si.invoice_date desc, si.created_at desc;
end;
$$;

-- ---------- report_inventory_status (final signature: 3 args) ---------------
create or replace function public.report_inventory_status(
  p_branch_id uuid default null,
  p_category_id uuid default null,
  p_low_stock_only boolean default false
)
returns table (
  inventory_id uuid, product_id uuid, name text, sku text, unit text,
  category_name text, branch_name text, quantity numeric, reorder_threshold numeric,
  is_low boolean, purchase_price numeric, sale_price numeric,
  cost_value numeric, retail_value numeric
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_role text := public.current_staff_role();
begin
  if v_role is null or v_role not in ('owner', 'manager', 'warehouse', 'accountant') then
    raise exception 'Your role cannot view inventory reports.' using errcode = '42501';
  end if;

  return query
  select i.id, p.id, p.name, p.sku, p.unit,
         coalesce(cat.name, '—'), b.name,
         i.quantity, i.reorder_threshold,
         i.quantity <= i.reorder_threshold,
         p.purchase_price, p.sale_price,
         round(i.quantity * p.avg_cost, 2),
         round(i.quantity * p.sale_price, 2)
  from public.inventory i
  join public.products p on p.id = i.product_id
  join public.branches b on b.id = i.branch_id
  left join public.categories cat on cat.id = p.category_id
  where p.status = 'active'
    and (p_branch_id is null or i.branch_id = p_branch_id)
    and (p_category_id is null or p.category_id = p_category_id)
    and (not coalesce(p_low_stock_only, false) or i.quantity <= i.reorder_threshold)
  order by p.name;
end;
$$;

-- ---------- report_profit ----------------------------------------------------
create or replace function public.report_profit(
  p_start_date date default null,
  p_end_date date default null
)
returns table (
  product_id uuid, name text, sku text, quantity_sold numeric,
  revenue numeric, cogs numeric, gross_profit numeric, margin_pct numeric
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_role text := public.current_staff_role();
begin
  if v_role is null or v_role not in ('owner', 'manager', 'accountant') then
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

-- ---------- report_party_balances: THE ONE THAT LEAKED --------------------
create or replace function public.report_party_balances(p_party_type text)
returns table (party_id uuid, name text, phone text, balance numeric, credit_limit numeric)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_role text := public.current_staff_role();
begin
  if v_role is null or v_role not in ('owner', 'manager', 'accountant') then
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

-- ---------- dashboard_summary -------------------------------------------------
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

-- ---------- open_documents -----------------------------------------------------
create or replace function public.open_documents(p_party_type text, p_party_id uuid)
returns table (
  document_id uuid, document_number text, document_date date,
  total numeric, amount_paid numeric, outstanding numeric
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_role text := public.current_staff_role();
begin
  if v_role is null or v_role not in ('owner', 'manager', 'accountant') then
    raise exception 'Your role is not allowed to view open documents.' using errcode = '42501';
  end if;

  if p_party_type = 'customer' then
    return query
    select si.id, si.invoice_number, si.invoice_date, si.total, si.amount_paid,
           si.total - si.amount_paid
    from public.sales_invoices si
    where si.customer_id = p_party_id and si.status = 'posted' and si.amount_paid < si.total
    order by si.invoice_date, si.created_at;
  elsif p_party_type = 'supplier' then
    return query
    select gr.id, gr.grn_number, gr.received_date, gr.total_received, gr.amount_paid,
           gr.total_received - gr.amount_paid
    from public.goods_receipts gr
    where gr.supplier_id = p_party_id and gr.amount_paid < gr.total_received
    order by gr.received_date, gr.created_at;
  else
    raise exception 'Party must be a customer or a supplier.';
  end if;
end;
$$;

-- ---------- report_party_statement (staff-side) -------------------------------
create or replace function public.report_party_statement(
  p_party_type text,
  p_party_id uuid,
  p_start_date date default null,
  p_end_date date default null
)
returns table (
  entry_date date, description text, reference text,
  debit numeric, credit numeric, running_balance numeric
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_role text := public.current_staff_role();
  v_opening numeric := 0;
  v_sign int;
begin
  if v_role is null or v_role not in ('owner', 'manager', 'accountant') then
    raise exception 'Your role is not allowed to view statements.' using errcode = '42501';
  end if;
  if p_party_type not in ('customer', 'supplier') then
    raise exception 'Party must be a customer or a supplier.';
  end if;

  v_sign := case when p_party_type = 'customer' then 1 else -1 end;

  if p_party_type = 'customer' then
    select coalesce(opening_balance, 0) into v_opening from public.customers where id = p_party_id;
  else
    select coalesce(opening_balance, 0) into v_opening from public.suppliers where id = p_party_id;
  end if;

  if p_start_date is not null then
    select v_opening + coalesce(sum((le.debit - le.credit) * v_sign), 0) into v_opening
    from public.ledger_entries le
    where le.party_type = p_party_type and le.party_id = p_party_id and le.entry_date < p_start_date;
  end if;

  return query
  with entries as (
    select le.entry_date,
           case le.reference_type
             when 'sales_invoice' then 'Invoice'
             when 'goods_receipt' then 'Goods received'
             when 'payment' then case when p_party_type = 'customer' then 'Payment received' else 'Payment made' end
             else coalesce(le.reference_type, 'Adjustment')
           end as description,
           coalesce(si.invoice_number, gr.grn_number, pay.payment_number, '') as reference,
           le.debit, le.credit, le.created_at
    from public.ledger_entries le
    left join public.sales_invoices si on si.id = le.reference_id and le.reference_type = 'sales_invoice'
    left join public.goods_receipts gr on gr.id = le.reference_id and le.reference_type = 'goods_receipt'
    left join public.payments pay on pay.id = le.reference_id and le.reference_type = 'payment'
    where le.party_type = p_party_type and le.party_id = p_party_id
      and (p_start_date is null or le.entry_date >= p_start_date)
      and (p_end_date is null or le.entry_date <= p_end_date)
  )
  select e.entry_date, e.description, e.reference, e.debit, e.credit,
         round(v_opening + sum((e.debit - e.credit) * v_sign)
               over (order by e.entry_date, e.created_at rows between unbounded preceding and current row), 2)
  from entries e
  order by e.entry_date, e.created_at;
end;
$$;

-- ============================================================================
-- Guard rail: fail this migration (and any future one) if the dangerous
-- pattern `current_staff_role() not in` or `v_role not in` appears without a
-- preceding null check in the same function body. This cannot inspect every
-- possible phrasing, but it catches the exact shape that caused this bug and
-- documents the rule in a place a future migration cannot silently skip.
-- ============================================================================
do $$
declare
  v_bad text;
begin
  select string_agg(p.proname, ', ') into v_bad
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.prosecdef
    and (
      -- current_staff_role() used directly in a "not in" with no null check
      -- anywhere alongside it in the same call.
      pg_get_functiondef(p.oid) ~ 'current_staff_role\(\) not in'
      -- v_role used in a bare "not in" AND the function never checks
      -- "v_role is null" anywhere (an early-return guard makes reuse safe,
      -- e.g. sync_mobile_action: `if v_role is null then return ...`).
      or (
        pg_get_functiondef(p.oid) ~* 'if v_role not in'
        and pg_get_functiondef(p.oid) !~* 'v_role is null'
      )
    )
    and p.proname not in ('handle_new_user'); -- validates an invite role, not a caller's own role

  if v_bad is not null then
    raise exception
      'Unguarded role check (NULL bypasses "not in") in: %. '
      'Use: if v_role is null or v_role not in (...) then, '
      'or an explicit early-return "if v_role is null then ... end if;" before reuse.', v_bad;
  end if;
end
$$;
