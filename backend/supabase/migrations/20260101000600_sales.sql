-- ============================================================================
-- 06 · Sales: quotations, orders, invoices.
--
-- THE ORDER LIFECYCLE
--
--   awaiting_approval  a shop ordered in the app; staff must accept it
--   pending            valid and ready to invoice — NO stock has moved
--   held               blocked by a stock or credit check; needs an override
--   confirmed          invoiced: stock is out and the customer has been debited
--   cancelled          terminal
--
-- An order is CONFIRMED only once something has actually happened to it. Until
-- then it is PENDING. This is the single most important thing to understand
-- about the sales module.
--
-- STOCK MOVES IN EXACTLY ONE PLACE: create_sales_invoice(). Creating an order
-- does not move stock. Accepting one does not move stock. Only invoicing does.
-- ============================================================================

create table public.quotations (
  id             uuid primary key default gen_random_uuid(),
  quote_number   text not null unique,
  customer_id    uuid not null references public.customers (id),
  branch_id      uuid not null references public.branches (id),
  quote_date     date not null default current_date,
  valid_until    date,
  status         text not null default 'open' check (status in ('open', 'accepted', 'rejected', 'expired')),
  subtotal       numeric(14,2) not null default 0 check (subtotal >= 0),
  total          numeric(14,2) not null default 0 check (total >= 0),
  sales_order_id uuid,
  notes          text,
  created_by     uuid,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create trigger quotations_set_updated_at
  before update on public.quotations
  for each row execute function public.set_updated_at();

create table public.quotation_items (
  id           uuid primary key default gen_random_uuid(),
  quotation_id uuid not null references public.quotations (id) on delete cascade,
  product_id   uuid not null references public.products (id),
  uom          text not null default 'unit' check (uom in ('unit', 'carton')),
  qty_entered  numeric(14,3) not null check (qty_entered > 0),
  quantity     numeric(14,3) not null check (quantity > 0),
  unit_price   numeric(14,2) not null check (unit_price >= 0),
  line_total   numeric(14,2) not null check (line_total >= 0),
  constraint quotation_items_key unique (quotation_id, product_id, uom)
);

create table public.sales_orders (
  id           uuid primary key default gen_random_uuid(),
  so_number    text not null unique,
  customer_id  uuid not null references public.customers (id),
  branch_id    uuid not null references public.branches (id),
  order_date   date not null default current_date,
  status       text not null default 'pending'
               check (status in ('awaiting_approval', 'pending', 'held', 'confirmed', 'cancelled')),
  -- Where it came from, so staff can tell a shop's own order from one keyed in
  -- at the counter or booked by a rep in the field.
  source       text not null default 'staff' check (source in ('staff', 'customer_app', 'field_app', 'quotation')),
  subtotal     numeric(14,2) not null default 0 check (subtotal >= 0),
  total        numeric(14,2) not null default 0 check (total >= 0),
  hold_reason  text,
  notes        text,
  created_by   uuid,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index sales_orders_customer_idx on public.sales_orders (customer_id, created_at desc);
create index sales_orders_status_idx on public.sales_orders (status, created_at desc);

create trigger sales_orders_set_updated_at
  before update on public.sales_orders
  for each row execute function public.set_updated_at();

comment on column public.sales_orders.status is
  'awaiting_approval=shop ordered, needs acceptance; pending=ready to invoice (no stock moved); held=blocked by stock/credit; confirmed=invoiced & stock deducted; cancelled=terminal.';

create table public.sales_order_items (
  id             uuid primary key default gen_random_uuid(),
  sales_order_id uuid not null references public.sales_orders (id) on delete cascade,
  product_id     uuid not null references public.products (id),
  uom            text not null default 'unit' check (uom in ('unit', 'carton')),
  qty_entered    numeric(14,3) not null check (qty_entered > 0),
  quantity       numeric(14,3) not null check (quantity > 0),
  unit_price     numeric(14,2) not null check (unit_price >= 0),
  line_total     numeric(14,2) not null check (line_total >= 0),
  constraint sales_order_items_key unique (sales_order_id, product_id, uom)
);

create table public.sales_invoices (
  id             uuid primary key default gen_random_uuid(),
  invoice_number text not null unique,
  sales_order_id uuid not null unique references public.sales_orders (id),
  customer_id    uuid not null references public.customers (id),
  branch_id      uuid not null references public.branches (id),
  invoice_date   date not null default current_date,
  subtotal       numeric(14,2) not null check (subtotal >= 0),
  tax_rate       numeric(5,2) not null default 0,
  tax_amount     numeric(14,2) not null default 0,
  total          numeric(14,2) not null check (total >= 0),
  amount_paid    numeric(14,2) not null default 0 check (amount_paid >= 0),
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid', 'partial', 'paid')),
  status         text not null default 'posted' check (status in ('posted', 'void')),
  notes          text,
  created_by     uuid,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index sales_invoices_customer_idx on public.sales_invoices (customer_id, invoice_date desc);
create index sales_invoices_unpaid_idx on public.sales_invoices (customer_id)
  where payment_status <> 'paid' and status = 'posted';

create trigger sales_invoices_set_updated_at
  before update on public.sales_invoices
  for each row execute function public.set_updated_at();

create table public.sales_invoice_items (
  id                  uuid primary key default gen_random_uuid(),
  sales_invoice_id    uuid not null references public.sales_invoices (id) on delete cascade,
  sales_order_item_id uuid references public.sales_order_items (id),
  product_id          uuid not null references public.products (id),
  uom                 text not null default 'unit' check (uom in ('unit', 'carton')),
  qty_entered         numeric(14,3) not null check (qty_entered > 0),
  quantity            numeric(14,3) not null check (quantity > 0),
  unit_price          numeric(14,2) not null check (unit_price >= 0),
  line_total          numeric(14,2) not null check (line_total >= 0),
  -- Cost of goods frozen at the moment of invoicing, so historic margin never
  -- changes when today's prices change.
  unit_cost           numeric(14,4) not null default 0 check (unit_cost >= 0)
);

alter table public.payment_allocations
  add constraint payment_allocations_invoice_fkey
  foreign key (invoice_id) references public.sales_invoices (id);

alter table public.quotations
  add constraint quotations_sales_order_fkey
  foreign key (sales_order_id) references public.sales_orders (id);

-- ---------------------------------------------------------------------------
-- Internal: build the order lines. Shared by staff orders, customer orders and
-- quotation conversion so pricing and unit maths can never diverge.
-- ---------------------------------------------------------------------------
create or replace function public.build_sales_order_lines(
  p_sales_order_id uuid,
  p_branch_id uuid,
  p_items jsonb,
  p_price_from_catalog boolean
)
returns table (subtotal numeric, hold_reason text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item jsonb;
  v_product public.products%rowtype;
  v_uom text;
  v_qty_entered numeric;
  v_quantity numeric;
  v_unit_price numeric;
  v_line_total numeric;
  v_subtotal numeric := 0;
  v_hold text;
  v_stock numeric;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Add at least one product.';
  end if;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    select * into v_product from public.products
    where id = (v_item ->> 'product_id')::uuid and status = 'active';
    if not found then
      raise exception 'One of the products is no longer available.';
    end if;

    v_uom := coalesce(v_item ->> 'uom', 'unit');
    if v_uom not in ('unit', 'carton') then
      raise exception 'Unit of measure must be unit or carton.';
    end if;

    v_qty_entered := coalesce((v_item ->> 'qty_entered')::numeric, (v_item ->> 'quantity')::numeric, 0);
    if v_qty_entered <= 0 then
      raise exception 'Quantity must be greater than zero.';
    end if;

    -- Customers never set their own price: it always comes from the catalogue.
    if p_price_from_catalog then
      v_unit_price := public.product_unit_price(v_product, v_uom);
    else
      v_unit_price := coalesce((v_item ->> 'unit_price')::numeric, public.product_unit_price(v_product, v_uom));
      if v_unit_price < 0 then
        raise exception 'Unit price cannot be negative.';
      end if;
    end if;

    v_quantity := v_qty_entered * case when v_uom = 'carton' then v_product.units_per_carton else 1 end;
    v_line_total := round(v_qty_entered * v_unit_price, 2);

    select quantity into v_stock from public.inventory
    where product_id = v_product.id and branch_id = p_branch_id;

    if coalesce(v_stock, 0) < v_quantity then
      v_hold := concat_ws('; ', v_hold, 'Not enough stock for ' || v_product.name);
    end if;

    insert into public.sales_order_items (
      sales_order_id, product_id, uom, qty_entered, quantity, unit_price, line_total
    ) values (
      p_sales_order_id, v_product.id, v_uom, v_qty_entered, v_quantity, v_unit_price, v_line_total
    )
    on conflict on constraint sales_order_items_key do update
      set qty_entered = public.sales_order_items.qty_entered + excluded.qty_entered,
          quantity    = public.sales_order_items.quantity + excluded.quantity,
          line_total  = public.sales_order_items.line_total + excluded.line_total;

    v_subtotal := v_subtotal + v_line_total;
  end loop;

  return query select v_subtotal, v_hold;
end;
$$;

-- ---------------------------------------------------------------------------
-- create_sales_order — staff-facing.
-- ---------------------------------------------------------------------------
create or replace function public.create_sales_order(
  p_customer_id uuid,
  p_branch_id uuid,
  p_notes text,
  p_items jsonb,
  p_source text default 'staff'
)
returns table (sales_order_id uuid, so_number text, order_status text, hold_reason text, subtotal numeric, total numeric)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text := public.current_staff_role();
  v_customer public.customers%rowtype;
  v_id uuid := gen_random_uuid();
  v_number text;
  v_built record;
  v_status text;
  v_hold text;
begin
  if v_role is null or v_role not in ('owner', 'manager', 'sales') then
    raise exception 'Your role is not allowed to create sales orders.' using errcode = '42501';
  end if;
  if p_source not in ('staff', 'field_app', 'quotation') then
    raise exception 'Invalid order source.';
  end if;

  select * into v_customer from public.customers
  where id = p_customer_id and status = 'active' for update;
  if not found then
    raise exception 'Active customer not found.';
  end if;
  if not exists (select 1 from public.branches where id = p_branch_id and status = 'active') then
    raise exception 'Active branch not found.';
  end if;

  v_number := 'SO-' || upper(substr(replace(v_id::text, '-', ''), 1, 8));
  insert into public.sales_orders (id, so_number, customer_id, branch_id, status, source, notes, created_by)
  values (v_id, v_number, p_customer_id, p_branch_id, 'held', p_source, nullif(trim(p_notes), ''), auth.uid());

  select * into v_built from public.build_sales_order_lines(v_id, p_branch_id, p_items, false);
  v_hold := v_built.hold_reason;

  if public.customer_would_exceed_credit(p_customer_id, v_built.subtotal) then
    v_hold := concat_ws('; ', v_hold, 'Credit limit exceeded');
  end if;

  -- Passing the checks means READY TO INVOICE, not that anything has happened.
  v_status := case when v_hold is null then 'pending' else 'held' end;

  update public.sales_orders
  set status = v_status, subtotal = v_built.subtotal, total = v_built.subtotal, hold_reason = v_hold
  where id = v_id;

  return query select v_id, v_number, v_status, v_hold, v_built.subtotal, v_built.subtotal;
end;
$$;

-- ---------------------------------------------------------------------------
-- Approve / cancel
-- ---------------------------------------------------------------------------
create or replace function public.approve_sales_order(p_sales_order_id uuid)
returns table (order_status text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text := public.current_staff_role();
  v_order public.sales_orders%rowtype;
  v_item record;
  v_stock numeric;
begin
  if v_role is null or v_role not in ('owner', 'manager') then
    raise exception 'Only owners and managers can approve orders.' using errcode = '42501';
  end if;

  select * into v_order from public.sales_orders where id = p_sales_order_id for update;
  if not found then
    raise exception 'Order not found.';
  end if;
  if v_order.status not in ('awaiting_approval', 'held') then
    raise exception 'Only orders awaiting approval or on hold can be approved (this one is %).', v_order.status;
  end if;

  -- Stock is re-checked because approving an order that cannot be fulfilled
  -- only defers the failure to invoicing. A CREDIT hold, by contrast, IS
  -- overridable — extending credit is a commercial decision.
  for v_item in
    select soi.product_id, soi.quantity, p.name
    from public.sales_order_items soi
    join public.products p on p.id = soi.product_id
    where soi.sales_order_id = p_sales_order_id
  loop
    select quantity into v_stock from public.inventory
    where product_id = v_item.product_id and branch_id = v_order.branch_id;
    if coalesce(v_stock, 0) < v_item.quantity then
      raise exception 'Not enough stock for %: % on hand, % required.',
        v_item.name, coalesce(v_stock, 0), v_item.quantity;
    end if;
  end loop;

  update public.sales_orders set status = 'pending', hold_reason = null where id = p_sales_order_id;
  return query select 'pending'::text;
end;
$$;

create or replace function public.cancel_sales_order(p_sales_order_id uuid, p_reason text default null)
returns table (order_status text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text := public.current_staff_role();
  v_customer_id uuid := public.current_customer_id();
  v_order public.sales_orders%rowtype;
begin
  select * into v_order from public.sales_orders where id = p_sales_order_id for update;
  if not found then
    raise exception 'Order not found.';
  end if;

  -- Staff may cancel anything not yet invoiced. A shop may withdraw only its
  -- OWN order, and only while it is still waiting to be accepted.
  if v_role in ('owner', 'manager') then
    null;
  elsif v_customer_id is not null
        and v_order.customer_id = v_customer_id
        and v_order.status = 'awaiting_approval' then
    null;
  else
    raise exception 'You are not allowed to cancel this order.' using errcode = '42501';
  end if;

  if v_order.status = 'confirmed' then
    raise exception 'This order is already invoiced and cannot be cancelled — raise a sales return instead.';
  end if;
  if v_order.status = 'cancelled' then
    raise exception 'This order is already cancelled.';
  end if;

  update public.sales_orders
  set status = 'cancelled', hold_reason = coalesce(nullif(trim(p_reason), ''), 'Cancelled')
  where id = p_sales_order_id;

  return query select 'cancelled'::text;
end;
$$;

-- ---------------------------------------------------------------------------
-- create_sales_invoice — the ONLY place stock leaves the building.
-- ---------------------------------------------------------------------------
create or replace function public.create_sales_invoice(
  p_sales_order_id uuid,
  p_invoice_date date default null,
  p_notes text default null
)
returns table (sales_invoice_id uuid, invoice_number text, subtotal numeric, tax_rate numeric, tax_amount numeric, total numeric)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text := public.current_staff_role();
  v_order public.sales_orders%rowtype;
  v_line public.sales_order_items%rowtype;
  v_invoice_id uuid := gen_random_uuid();
  v_number text;
  v_prefix text;
  v_tax_rate numeric := 0;
  v_subtotal numeric := 0;
  v_tax numeric := 0;
  v_total numeric := 0;
  v_unit_cost numeric;
begin
  if v_role is null or v_role not in ('owner', 'manager', 'sales') then
    raise exception 'Your role is not allowed to raise invoices.' using errcode = '42501';
  end if;

  select * into v_order from public.sales_orders
  where id = p_sales_order_id and status = 'pending' for update;
  if not found then
    raise exception 'Sales order not found, or it is not ready to invoice.';
  end if;
  if exists (select 1 from public.sales_invoices where sales_order_id = v_order.id) then
    raise exception 'This order has already been invoiced.';
  end if;

  -- Aliased: this function's RETURNS TABLE declares a `tax_rate` column, which
  -- would otherwise be ambiguous against company_settings.tax_rate.
  select cs.tax_rate, cs.invoice_prefix
    into v_tax_rate, v_prefix
  from public.company_settings cs
  where cs.id;

  select coalesce(round(sum(line_total), 2), 0) into v_subtotal
  from public.sales_order_items where sales_order_id = v_order.id;

  v_tax := round(v_subtotal * coalesce(v_tax_rate, 0) / 100, 2);
  v_total := v_subtotal + v_tax;
  v_number := coalesce(v_prefix, 'INV') || '-' || upper(substr(replace(v_invoice_id::text, '-', ''), 1, 8));

  insert into public.sales_invoices (
    id, invoice_number, sales_order_id, customer_id, branch_id, invoice_date,
    subtotal, tax_rate, tax_amount, total, notes, created_by
  ) values (
    v_invoice_id, v_number, v_order.id, v_order.customer_id, v_order.branch_id,
    coalesce(p_invoice_date, current_date), v_subtotal, coalesce(v_tax_rate, 0), v_tax, v_total,
    nullif(trim(p_notes), ''), auth.uid()
  );

  for v_line in
    select * from public.sales_order_items where sales_order_id = v_order.id order by id
  loop
    select avg_cost into v_unit_cost from public.products where id = v_line.product_id;

    insert into public.sales_invoice_items (
      sales_invoice_id, sales_order_item_id, product_id, uom,
      qty_entered, quantity, unit_price, line_total, unit_cost
    ) values (
      v_invoice_id, v_line.id, v_line.product_id, v_line.uom,
      v_line.qty_entered, v_line.quantity, v_line.unit_price, v_line.line_total, coalesce(v_unit_cost, 0)
    );

    perform public.apply_stock_movement(
      v_line.product_id, v_order.branch_id, -v_line.quantity,
      null, 'sale', p_notes, 'sales_invoice', v_invoice_id
    );
  end loop;

  -- The customer now owes us.
  insert into public.ledger_entries (party_type, party_id, entry_date, debit, credit, reference_type, reference_id, notes, created_by)
  values ('customer', v_order.customer_id, coalesce(p_invoice_date, current_date), v_total, 0,
          'sales_invoice', v_invoice_id, nullif(trim(p_notes), ''), auth.uid());

  -- Stock is out and the customer is debited: the order is now confirmed.
  update public.sales_orders set status = 'confirmed' where id = v_order.id;

  return query select v_invoice_id, v_number, v_subtotal, coalesce(v_tax_rate, 0), v_tax, v_total;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS — staff by role; a shop sees only its own orders and invoices.
-- ---------------------------------------------------------------------------
alter table public.quotations          enable row level security;
alter table public.quotation_items     enable row level security;
alter table public.sales_orders        enable row level security;
alter table public.sales_order_items   enable row level security;
alter table public.sales_invoices      enable row level security;
alter table public.sales_invoice_items enable row level security;

create policy quotations_read on public.quotations
  for select to authenticated using (public.staff_has_role('owner', 'manager', 'sales', 'accountant'));
create policy quotation_items_read on public.quotation_items
  for select to authenticated using (public.staff_has_role('owner', 'manager', 'sales', 'accountant'));

create policy sales_orders_staff_read on public.sales_orders
  for select to authenticated using (public.is_staff());
create policy sales_orders_customer_read on public.sales_orders
  for select to authenticated
  using (customer_id = (select public.current_customer_id()));

create policy sales_order_items_staff_read on public.sales_order_items
  for select to authenticated using (public.is_staff());
create policy sales_order_items_customer_read on public.sales_order_items
  for select to authenticated
  using (exists (
    select 1 from public.sales_orders so
    where so.id = sales_order_items.sales_order_id
      and so.customer_id = (select public.current_customer_id())
  ));

create policy sales_invoices_staff_read on public.sales_invoices
  for select to authenticated using (public.is_staff());
create policy sales_invoices_customer_read on public.sales_invoices
  for select to authenticated
  using (customer_id = (select public.current_customer_id()));

create policy sales_invoice_items_staff_read on public.sales_invoice_items
  for select to authenticated using (public.is_staff());
create policy sales_invoice_items_customer_read on public.sales_invoice_items
  for select to authenticated
  using (exists (
    select 1 from public.sales_invoices si
    where si.id = sales_invoice_items.sales_invoice_id
      and si.customer_id = (select public.current_customer_id())
  ));

grant select on public.quotations, public.quotation_items, public.sales_orders,
                public.sales_order_items, public.sales_invoices, public.sales_invoice_items
  to authenticated;

revoke all on function public.build_sales_order_lines(uuid, uuid, jsonb, boolean) from public, anon, authenticated;
revoke all on function public.create_sales_order(uuid, uuid, text, jsonb, text) from public, anon;
revoke all on function public.approve_sales_order(uuid) from public, anon;
revoke all on function public.cancel_sales_order(uuid, text) from public, anon;
revoke all on function public.create_sales_invoice(uuid, date, text) from public, anon;
grant execute on function public.create_sales_order(uuid, uuid, text, jsonb, text) to authenticated, service_role;
grant execute on function public.approve_sales_order(uuid) to authenticated, service_role;
grant execute on function public.cancel_sales_order(uuid, text) to authenticated, service_role;
grant execute on function public.create_sales_invoice(uuid, date, text) to authenticated, service_role;
