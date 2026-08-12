-- ============================================================================
-- 13 · Fuller report rows.
--
-- The first cut of these reports returned the bare minimum. A report is only
-- useful if you can answer the follow-up question without running another one,
-- so the sales summary now says which branch sold it, and the inventory report
-- carries the category and both unit prices alongside the valuations.
-- ============================================================================

drop function if exists public.report_sales_summary(date, date, uuid);
create function public.report_sales_summary(
  p_start_date date default null,
  p_end_date date default null,
  p_customer_id uuid default null,
  p_branch_id uuid default null
)
returns table (
  invoice_id uuid,
  invoice_number text,
  invoice_date date,
  customer_name text,
  branch_name text,
  subtotal numeric,
  tax_amount numeric,
  total numeric,
  amount_paid numeric,
  outstanding numeric,
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

drop function if exists public.report_inventory_status(uuid, boolean);
create function public.report_inventory_status(
  p_branch_id uuid default null,
  p_category_id uuid default null,
  p_low_stock_only boolean default false
)
returns table (
  inventory_id uuid,
  product_id uuid,
  name text,
  sku text,
  unit text,
  category_name text,
  branch_name text,
  quantity numeric,
  reorder_threshold numeric,
  is_low boolean,
  purchase_price numeric,
  sale_price numeric,
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

revoke execute on function public.report_sales_summary(date, date, uuid, uuid) from public, anon;
revoke execute on function public.report_inventory_status(uuid, uuid, boolean) from public, anon;
grant execute on function public.report_sales_summary(date, date, uuid, uuid) to authenticated, service_role;
grant execute on function public.report_inventory_status(uuid, uuid, boolean) to authenticated, service_role;
