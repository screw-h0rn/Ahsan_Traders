-- ============================================================================
-- 08 · Customer API — everything the shop-facing mobile app calls.
--
-- A shop logs in with its phone number and gets exactly one view of the world:
-- its own. These functions are the whole contract. The app never queries a
-- table directly for anything sensitive, which means the surface a customer
-- can reach is small, explicit, and reviewable on one page.
--
-- Every function here begins by resolving current_customer_id(). If that is
-- NULL — an unlinked signup, a blocked account, an archived customer — the
-- call fails closed.
--
-- Cost data (purchase_price, avg_cost) is never returned by anything here.
-- ============================================================================

/** Fails immediately unless the caller is a linked, active shop. */
create or replace function public.require_customer()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_id uuid := public.current_customer_id();
begin
  if v_id is null then
    raise exception 'This account is not linked to a customer yet. Please contact Ahsan Traders.'
      using errcode = '42501';
  end if;
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Who am I / my account
-- ---------------------------------------------------------------------------
create or replace function public.customer_me()
returns table (
  customer_id uuid,
  name text,
  phone text,
  address text,
  balance numeric,
  credit_limit numeric,
  available_credit numeric,
  overdue_invoices integer,
  account_status text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_id uuid := public.require_customer();
begin
  return query
  select c.id, c.name, c.phone, c.address,
         public.customer_balance(c.id),
         c.credit_limit,
         public.customer_available_credit(c.id),
         (select count(*)::int from public.sales_invoices si
           where si.customer_id = c.id and si.status = 'posted' and si.payment_status <> 'paid'),
         (select ca.status from public.customer_accounts ca where ca.id = auth.uid())
  from public.customers c
  where c.id = v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Catalogue
--
-- Returns only what a shop needs to browse and order. Stock is exposed as a
-- coarse availability flag rather than a number, so competitors cannot read
-- the business's exact holdings, and prices always come from the catalogue.
-- ---------------------------------------------------------------------------
create or replace function public.customer_catalog(
  p_search text default null,
  p_category_id uuid default null,
  p_limit integer default 200,
  p_offset integer default 0
)
returns table (
  product_id uuid,
  name text,
  variant_label text,
  sku text,
  barcode text,
  category_id uuid,
  category_name text,
  unit text,
  units_per_carton integer,
  unit_price numeric,
  carton_price numeric,
  in_stock boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_search text := nullif(trim(coalesce(p_search, '')), '');
begin
  perform public.require_customer();

  return query
  select p.id, p.name, p.variant_label, p.sku, p.barcode,
         p.category_id, cat.name,
         p.unit, p.units_per_carton,
         p.sale_price,
         coalesce(p.carton_sale_price, p.sale_price * p.units_per_carton),
         public.product_on_hand(p.id) > 0
  from public.products p
  left join public.categories cat on cat.id = p.category_id
  where p.status = 'active'
    and p.is_public
    and (p_category_id is null or p.category_id = p_category_id)
    and (
      v_search is null
      or p.name ilike '%' || v_search || '%'
      or p.sku ilike '%' || v_search || '%'
      or p.barcode = v_search
    )
  order by p.name
  limit greatest(least(coalesce(p_limit, 200), 500), 1)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

create or replace function public.customer_categories()
returns table (category_id uuid, name text, product_count integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform public.require_customer();

  return query
  select c.id, c.name, count(p.id)::int
  from public.categories c
  join public.products p
    on p.category_id = c.id and p.status = 'active' and p.is_public
  where c.status = 'active'
  group by c.id, c.name
  having count(p.id) > 0
  order by c.name;
end;
$$;

-- ---------------------------------------------------------------------------
-- Placing an order
--
-- Prices are always taken from the catalogue — the app cannot set them. The
-- order lands as `awaiting_approval` (or `pending` if the business has turned
-- approval off) and never moves stock.
-- ---------------------------------------------------------------------------
create or replace function public.customer_place_order(
  p_items jsonb,
  p_notes text default null
)
returns table (sales_order_id uuid, so_number text, order_status text, total numeric, credit_warning text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_customer_id uuid := public.require_customer();
  v_branch_id uuid;
  v_id uuid := gen_random_uuid();
  v_number text;
  v_built record;
  v_require_approval boolean;
  v_status text;
  v_warning text;
begin
  select require_order_approval into v_require_approval from public.company_settings where id;

  select b.id into v_branch_id from public.branches b
  where b.status = 'active'
  order by b.is_default desc, (b.type = 'warehouse') desc, b.name
  limit 1;
  if v_branch_id is null then
    raise exception 'Ordering is not available right now. Please contact us.';
  end if;

  v_number := 'SO-APP-' || upper(substr(replace(v_id::text, '-', ''), 1, 8));

  insert into public.sales_orders (
    id, so_number, customer_id, branch_id, status, source, notes, created_by
  ) values (
    v_id, v_number, v_customer_id, v_branch_id, 'held', 'customer_app',
    nullif(trim(p_notes), ''), auth.uid()
  );

  -- price_from_catalog = true: the shop cannot dictate its own price.
  select * into v_built from public.build_sales_order_lines(v_id, v_branch_id, p_items, true);

  -- A shop is told about a credit problem but is not blocked by it here —
  -- staff decide whether to accept. Stock shortages likewise surface at
  -- acceptance, not as a confusing rejection while ordering.
  if public.customer_would_exceed_credit(v_customer_id, v_built.subtotal) then
    v_warning := 'This order takes you over your credit limit and may need approval.';
  end if;

  v_status := case when coalesce(v_require_approval, true) then 'awaiting_approval' else 'pending' end;

  update public.sales_orders
  set status = v_status, subtotal = v_built.subtotal, total = v_built.subtotal,
      hold_reason = case when v_status = 'awaiting_approval' then 'Placed in the shop app' else null end
  where id = v_id;

  -- Tell the staff who can act on it.
  insert into public.notifications (recipient_id, audience, type, title, body, reference_type, reference_id)
  select s.id, 'staff', 'order_placed',
         'New app order ' || v_number,
         (select name from public.customers where id = v_customer_id)
           || ' placed an order for ' || to_char(v_built.subtotal, 'FM999999990.00'),
         'sales_order', v_id
  from public.staff s
  where s.status = 'active' and s.role in ('owner', 'manager', 'sales');

  return query select v_id, v_number, v_status, v_built.subtotal, v_warning;
end;
$$;

-- ---------------------------------------------------------------------------
-- My orders / invoices / statement
-- ---------------------------------------------------------------------------
create or replace function public.customer_my_orders(
  p_status text default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  sales_order_id uuid,
  so_number text,
  order_date date,
  status text,
  total numeric,
  item_count integer,
  invoice_id uuid,
  invoice_number text,
  payment_status text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_id uuid := public.require_customer();
begin
  return query
  select so.id, so.so_number, so.order_date, so.status, so.total,
         (select count(*)::int from public.sales_order_items i where i.sales_order_id = so.id),
         si.id, si.invoice_number, si.payment_status
  from public.sales_orders so
  left join public.sales_invoices si on si.sales_order_id = so.id
  where so.customer_id = v_id
    and (p_status is null or so.status = p_status)
  order by so.created_at desc
  limit greatest(least(coalesce(p_limit, 50), 200), 1)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

create or replace function public.customer_order_detail(p_sales_order_id uuid)
returns table (
  so_number text,
  order_date date,
  status text,
  hold_reason text,
  notes text,
  subtotal numeric,
  total numeric,
  product_name text,
  variant_label text,
  uom text,
  qty_entered numeric,
  unit_price numeric,
  line_total numeric
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_id uuid := public.require_customer();
begin
  if not exists (
    select 1 from public.sales_orders
    where id = p_sales_order_id and customer_id = v_id
  ) then
    raise exception 'Order not found.';
  end if;

  return query
  select so.so_number, so.order_date, so.status, so.hold_reason, so.notes,
         so.subtotal, so.total,
         p.name, p.variant_label, i.uom, i.qty_entered, i.unit_price, i.line_total
  from public.sales_orders so
  join public.sales_order_items i on i.sales_order_id = so.id
  join public.products p on p.id = i.product_id
  where so.id = p_sales_order_id
  order by p.name;
end;
$$;

create or replace function public.customer_my_invoices(
  p_unpaid_only boolean default false,
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  invoice_id uuid,
  invoice_number text,
  invoice_date date,
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
declare
  v_id uuid := public.require_customer();
begin
  return query
  select si.id, si.invoice_number, si.invoice_date, si.subtotal, si.tax_amount,
         si.total, si.amount_paid, si.total - si.amount_paid, si.payment_status
  from public.sales_invoices si
  where si.customer_id = v_id
    and si.status = 'posted'
    and (not coalesce(p_unpaid_only, false) or si.payment_status <> 'paid')
  order by si.invoice_date desc, si.created_at desc
  limit greatest(least(coalesce(p_limit, 50), 200), 1)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

/** Running statement: every invoice and payment, oldest first, with a balance. */
create or replace function public.customer_my_statement(
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
  v_id uuid := public.require_customer();
  v_opening numeric;
begin
  select coalesce(c.opening_balance, 0) into v_opening
  from public.customers c where c.id = v_id;

  -- Anything before the window is folded into the brought-forward figure.
  if p_start_date is not null then
    select v_opening + coalesce(sum(le.debit - le.credit), 0) into v_opening
    from public.ledger_entries le
    where le.party_type = 'customer' and le.party_id = v_id and le.entry_date < p_start_date;
  end if;

  return query
  with entries as (
    select le.entry_date,
           case le.reference_type
             when 'sales_invoice' then 'Invoice'
             when 'payment' then 'Payment received'
             else coalesce(le.reference_type, 'Adjustment')
           end as description,
           coalesce(si.invoice_number, pay.payment_number, '') as reference,
           le.debit, le.credit, le.created_at
    from public.ledger_entries le
    left join public.sales_invoices si on si.id = le.reference_id and le.reference_type = 'sales_invoice'
    left join public.payments pay on pay.id = le.reference_id and le.reference_type = 'payment'
    where le.party_type = 'customer' and le.party_id = v_id
      and (p_start_date is null or le.entry_date >= p_start_date)
      and (p_end_date is null or le.entry_date <= p_end_date)
  )
  select e.entry_date, e.description, e.reference, e.debit, e.credit,
         round(v_opening + sum(e.debit - e.credit)
               over (order by e.entry_date, e.created_at rows between unbounded preceding and current row), 2)
  from entries e
  order by e.entry_date, e.created_at;
end;
$$;

-- ---------------------------------------------------------------------------
-- Staff side of the customer relationship: linking logins to customer records.
-- ---------------------------------------------------------------------------

/** Attach a pending app signup to a customer on file. */
create or replace function public.link_customer_account(p_account_id uuid, p_customer_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text := public.current_staff_role();
begin
  if v_role is null or v_role not in ('owner', 'manager') then
    raise exception 'Only owners and managers can link customer logins.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.customers where id = p_customer_id and status = 'active') then
    raise exception 'Active customer not found.';
  end if;
  if exists (
    select 1 from public.customer_accounts
    where customer_id = p_customer_id and status = 'active' and id <> p_account_id
  ) then
    raise exception 'That customer already has an app login.';
  end if;

  update public.customer_accounts
  set customer_id = p_customer_id, status = 'active', linked_at = now(), linked_by = auth.uid()
  where id = p_account_id;

  if not found then
    raise exception 'Login not found.';
  end if;
end;
$$;

/** Revoke a shop's app access without deleting anything. */
create or replace function public.block_customer_account(p_account_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text := public.current_staff_role();
begin
  if v_role is null or v_role not in ('owner', 'manager') then
    raise exception 'Only owners and managers can block customer logins.' using errcode = '42501';
  end if;

  update public.customer_accounts set status = 'blocked' where id = p_account_id;
  if not found then
    raise exception 'Login not found.';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants. Note these are callable by `authenticated` — the functions decide
-- for themselves whether the caller is a linked shop.
-- ---------------------------------------------------------------------------
revoke all on function public.require_customer() from public, anon;
revoke all on function public.customer_me() from public, anon;
revoke all on function public.customer_catalog(text, uuid, integer, integer) from public, anon;
revoke all on function public.customer_categories() from public, anon;
revoke all on function public.customer_place_order(jsonb, text) from public, anon;
revoke all on function public.customer_my_orders(text, integer, integer) from public, anon;
revoke all on function public.customer_order_detail(uuid) from public, anon;
revoke all on function public.customer_my_invoices(boolean, integer, integer) from public, anon;
revoke all on function public.customer_my_statement(date, date) from public, anon;
revoke all on function public.link_customer_account(uuid, uuid) from public, anon;
revoke all on function public.block_customer_account(uuid) from public, anon;

grant execute on function public.customer_me() to authenticated, service_role;
grant execute on function public.customer_catalog(text, uuid, integer, integer) to authenticated, service_role;
grant execute on function public.customer_categories() to authenticated, service_role;
grant execute on function public.customer_place_order(jsonb, text) to authenticated, service_role;
grant execute on function public.customer_my_orders(text, integer, integer) to authenticated, service_role;
grant execute on function public.customer_order_detail(uuid) to authenticated, service_role;
grant execute on function public.customer_my_invoices(boolean, integer, integer) to authenticated, service_role;
grant execute on function public.customer_my_statement(date, date) to authenticated, service_role;
grant execute on function public.link_customer_account(uuid, uuid) to authenticated, service_role;
grant execute on function public.block_customer_account(uuid) to authenticated, service_role;
