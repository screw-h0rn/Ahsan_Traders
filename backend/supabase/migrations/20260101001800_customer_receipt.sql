-- ============================================================================
-- 18 · The shopkeeper's own receipt.
--
-- `customer_order_detail` already returns an order's lines, but a shopkeeper
-- asking "what did I actually get charged?" needs the invoice: tax, amount
-- paid, what is still outstanding, and the seller's own details — the same
-- document the office sees in the portal.
--
-- One call returns the whole thing so the phone renders a receipt from a
-- single round trip. Read-only by construction: this is a `stable` function,
-- and every write path (`customer_place_order` and the staff-only invoicing
-- functions) lives elsewhere, so there is nothing here for a customer to
-- change. Ownership is re-checked against `require_customer()` rather than
-- trusted from the caller.
--
-- Lines come from the invoice when one has been posted, and fall back to the
-- order's own lines before invoicing. What the customer sees is therefore
-- always what they will be billed for, not a mix of the two.
-- ============================================================================

create or replace function public.customer_order_receipt(p_sales_order_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_customer_id uuid := public.require_customer();
  v_invoice     public.sales_invoices;
  v_result      jsonb;
begin
  -- Scoped to the caller's own customer record. A wrong or someone else's id
  -- is reported the same way, so this cannot be used to probe which orders
  -- exist.
  if not exists (
    select 1 from public.sales_orders so
    where so.id = p_sales_order_id and so.customer_id = v_customer_id
  ) then
    raise exception 'Order not found.' using errcode = '42501';
  end if;

  select si.* into v_invoice
  from public.sales_invoices si
  where si.sales_order_id = p_sales_order_id and si.status = 'posted';

  select jsonb_build_object(
    'company', (
      select jsonb_build_object(
        'name', cs.name,
        'address', cs.address,
        'phone', cs.phone,
        'currency', cs.currency,
        'tax_name', cs.tax_name
      )
      from public.company_settings cs
      limit 1
    ),
    'customer', (
      select jsonb_build_object(
        'name', c.name,
        'phone', c.phone,
        'address', c.address
      )
      from public.customers c
      where c.id = v_customer_id
    ),
    'order', (
      select jsonb_build_object(
        'sales_order_id', so.id,
        'so_number', so.so_number,
        'order_date', so.order_date,
        'status', so.status,
        'hold_reason', so.hold_reason,
        'notes', so.notes,
        'subtotal', so.subtotal,
        'total', so.total,
        'branch_name', b.name
      )
      from public.sales_orders so
      join public.branches b on b.id = so.branch_id
      where so.id = p_sales_order_id
    ),
    'invoice', case
      when v_invoice.id is null then null
      else jsonb_build_object(
        'invoice_id', v_invoice.id,
        'invoice_number', v_invoice.invoice_number,
        'invoice_date', v_invoice.invoice_date,
        'subtotal', v_invoice.subtotal,
        'tax_rate', v_invoice.tax_rate,
        'tax_amount', v_invoice.tax_amount,
        'total', v_invoice.total,
        'amount_paid', v_invoice.amount_paid,
        'outstanding', round(v_invoice.total - v_invoice.amount_paid, 2),
        'payment_status', v_invoice.payment_status,
        'notes', v_invoice.notes
      )
    end,
    'lines', coalesce((
      select jsonb_agg(line order by line->>'product_name')
      from (
        select jsonb_build_object(
                 'product_name', p.name,
                 'variant_label', p.variant_label,
                 'sku', p.sku,
                 'unit', p.unit,
                 'uom', ii.uom,
                 'qty_entered', ii.qty_entered,
                 'quantity', ii.quantity,
                 'unit_price', ii.unit_price,
                 'line_total', ii.line_total
               ) as line
        from public.sales_invoice_items ii
        join public.products p on p.id = ii.product_id
        where v_invoice.id is not null and ii.sales_invoice_id = v_invoice.id

        union all

        select jsonb_build_object(
                 'product_name', p.name,
                 'variant_label', p.variant_label,
                 'sku', p.sku,
                 'unit', p.unit,
                 'uom', oi.uom,
                 'qty_entered', oi.qty_entered,
                 'quantity', oi.quantity,
                 'unit_price', oi.unit_price,
                 'line_total', oi.line_total
               ) as line
        from public.sales_order_items oi
        join public.products p on p.id = oi.product_id
        where v_invoice.id is null and oi.sales_order_id = p_sales_order_id
      ) lines
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

comment on function public.customer_order_receipt(uuid) is
  'Read-only receipt for one of the calling customer''s own orders: company and '
  'customer details, order header, posted invoice (or null), and line items.';

-- New functions get no PUBLIC execute (see migration 11), so the API surface
-- has to be opened deliberately.
grant execute on function public.customer_order_receipt(uuid) to authenticated, service_role;
