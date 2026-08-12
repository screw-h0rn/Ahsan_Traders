-- ============================================================================
-- 12 · Quotations, and the staff-side party statement.
--
-- A quotation is a priced offer that has not committed to anything: no stock
-- check, no credit check, no ledger. Accepting it creates a real sales order
-- through create_sales_order(), so the stock and credit rules apply at that
-- moment rather than when the quote was written — which is the point, because
-- a quote may be days old by the time it is taken up.
-- ============================================================================

create or replace function public.create_quotation(
  p_customer_id uuid,
  p_branch_id uuid,
  p_valid_until date,
  p_notes text,
  p_items jsonb
)
returns table (quotation_id uuid, quote_number text, total numeric)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text := public.current_staff_role();
  v_id uuid := gen_random_uuid();
  v_number text;
  v_item jsonb;
  v_product public.products%rowtype;
  v_uom text;
  v_qty_entered numeric;
  v_quantity numeric;
  v_unit_price numeric;
  v_line_total numeric;
  v_subtotal numeric := 0;
begin
  if v_role is null or v_role not in ('owner', 'manager', 'sales') then
    raise exception 'Your role is not allowed to write quotations.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.customers where id = p_customer_id and status = 'active') then
    raise exception 'Active customer not found.';
  end if;
  if not exists (select 1 from public.branches where id = p_branch_id and status = 'active') then
    raise exception 'Active branch not found.';
  end if;
  if p_valid_until is not null and p_valid_until < current_date then
    raise exception 'The valid-until date cannot be in the past.';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Add at least one line to the quotation.';
  end if;

  v_number := 'QT-' || upper(substr(replace(v_id::text, '-', ''), 1, 8));
  insert into public.quotations (id, quote_number, customer_id, branch_id, valid_until, notes, created_by)
  values (v_id, v_number, p_customer_id, p_branch_id, p_valid_until, nullif(trim(p_notes), ''), auth.uid());

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    select * into v_product from public.products
    where id = (v_item ->> 'product_id')::uuid and status = 'active';
    if not found then
      raise exception 'Active product not found on one of the lines.';
    end if;

    v_uom := coalesce(v_item ->> 'uom', 'unit');
    if v_uom not in ('unit', 'carton') then
      raise exception 'Unit of measure must be unit or carton.';
    end if;

    v_qty_entered := coalesce((v_item ->> 'qty_entered')::numeric, (v_item ->> 'quantity')::numeric, 0);
    v_unit_price := coalesce((v_item ->> 'unit_price')::numeric,
                             public.product_unit_price(v_product, v_uom));
    if v_qty_entered <= 0 or v_unit_price < 0 then
      raise exception 'Line quantity and price must be valid.';
    end if;

    v_quantity := v_qty_entered * case when v_uom = 'carton' then v_product.units_per_carton else 1 end;
    v_line_total := round(v_qty_entered * v_unit_price, 2);

    insert into public.quotation_items (
      quotation_id, product_id, uom, qty_entered, quantity, unit_price, line_total
    ) values (v_id, v_product.id, v_uom, v_qty_entered, v_quantity, v_unit_price, v_line_total);

    v_subtotal := v_subtotal + v_line_total;
  end loop;

  update public.quotations set subtotal = v_subtotal, total = v_subtotal where id = v_id;
  return query select v_id, v_number, v_subtotal;
end;
$$;

/**
 * Turn an accepted quotation into a sales order.
 *
 * Routed through create_sales_order(), so stock and credit are checked NOW —
 * the resulting order may legitimately come back `held` if the customer's
 * position has changed since the quote was written.
 */
create or replace function public.convert_quotation(p_quotation_id uuid)
returns table (sales_order_id uuid, so_number text, order_status text, hold_reason text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text := public.current_staff_role();
  v_quote public.quotations%rowtype;
  v_items jsonb;
  v_result record;
begin
  if v_role is null or v_role not in ('owner', 'manager', 'sales') then
    raise exception 'Your role is not allowed to convert quotations.' using errcode = '42501';
  end if;

  select * into v_quote from public.quotations where id = p_quotation_id for update;
  if not found then
    raise exception 'Quotation not found.';
  end if;
  if v_quote.status <> 'open' then
    raise exception 'This quotation is already %.', v_quote.status;
  end if;
  if v_quote.valid_until is not null and v_quote.valid_until < current_date then
    update public.quotations set status = 'expired' where id = p_quotation_id;
    raise exception 'This quotation expired on %. Write a fresh one.', v_quote.valid_until;
  end if;

  select jsonb_agg(jsonb_build_object(
    'product_id', qi.product_id,
    'uom', qi.uom,
    'qty_entered', qi.qty_entered,
    'unit_price', qi.unit_price
  )) into v_items
  from public.quotation_items qi
  where qi.quotation_id = v_quote.id;

  select * into v_result from public.create_sales_order(
    v_quote.customer_id, v_quote.branch_id,
    'From quotation ' || v_quote.quote_number, v_items, 'quotation'
  );

  update public.quotations
  set status = 'accepted', sales_order_id = v_result.sales_order_id
  where id = v_quote.id;

  return query select v_result.sales_order_id, v_result.so_number, v_result.order_status, v_result.hold_reason;
end;
$$;

create or replace function public.reject_quotation(p_quotation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text := public.current_staff_role();
  v_status text;
begin
  if v_role is null or v_role not in ('owner', 'manager', 'sales') then
    raise exception 'Your role is not allowed to reject quotations.' using errcode = '42501';
  end if;

  select status into v_status from public.quotations where id = p_quotation_id for update;
  if v_status is null then
    raise exception 'Quotation not found.';
  end if;
  if v_status <> 'open' then
    raise exception 'This quotation is already %.', v_status;
  end if;

  update public.quotations set status = 'rejected' where id = p_quotation_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Staff-side statement for any customer or supplier. (Shops get their own
-- through customer_my_statement(); this is the counter/back-office version.)
-- ---------------------------------------------------------------------------
create or replace function public.report_party_statement(
  p_party_type text,
  p_party_id uuid,
  p_start_date date default null,
  p_end_date date default null
)
returns table (
  entry_date date,
  description text,
  reference text,
  debit numeric,
  credit numeric,
  running_balance numeric
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_opening numeric := 0;
  v_sign int;
begin
  if public.current_staff_role() not in ('owner', 'manager', 'accountant') then
    raise exception 'Your role is not allowed to view statements.' using errcode = '42501';
  end if;
  if p_party_type not in ('customer', 'supplier') then
    raise exception 'Party must be a customer or a supplier.';
  end if;

  -- Customers: debit increases what they owe us. Suppliers: credit increases
  -- what we owe them. One query serves both by flipping the sign.
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

revoke execute on function public.create_quotation(uuid, uuid, date, text, jsonb) from public, anon;
revoke execute on function public.convert_quotation(uuid) from public, anon;
revoke execute on function public.reject_quotation(uuid) from public, anon;
revoke execute on function public.report_party_statement(text, uuid, date, date) from public, anon;
grant execute on function public.create_quotation(uuid, uuid, date, text, jsonb) to authenticated, service_role;
grant execute on function public.convert_quotation(uuid) to authenticated, service_role;
grant execute on function public.reject_quotation(uuid) to authenticated, service_role;
grant execute on function public.report_party_statement(text, uuid, date, date) to authenticated, service_role;
