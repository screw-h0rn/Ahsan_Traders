-- ============================================================================
-- 05 · Purchasing: orders to suppliers and goods receiving.
--
-- Receiving is the moment three things happen together, in one transaction:
--   1. stock goes up  (through adjust_stock, so it is logged)
--   2. the supplier is credited (we now owe them)
--   3. the product's weighted-average cost is recalculated
--
-- Step 3 is what makes margin reporting honest later on.
-- ============================================================================

create table public.purchase_orders (
  id            uuid primary key default gen_random_uuid(),
  po_number     text not null unique,
  supplier_id   uuid not null references public.suppliers (id),
  branch_id     uuid not null references public.branches (id),
  order_date    date not null default current_date,
  expected_date date,
  status        text not null default 'draft'
                check (status in ('draft', 'issued', 'partially_received', 'received', 'cancelled')),
  subtotal      numeric(14,2) not null default 0 check (subtotal >= 0),
  total         numeric(14,2) not null default 0 check (total >= 0),
  notes         text,
  created_by    uuid,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index purchase_orders_supplier_idx on public.purchase_orders (supplier_id, created_at desc);

create trigger purchase_orders_set_updated_at
  before update on public.purchase_orders
  for each row execute function public.set_updated_at();

create table public.purchase_order_items (
  id                uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references public.purchase_orders (id) on delete cascade,
  product_id        uuid not null references public.products (id),
  -- uom is what the buyer typed; quantity is ALWAYS base units.
  uom               text not null default 'unit' check (uom in ('unit', 'carton')),
  qty_entered       numeric(14,3) not null check (qty_entered > 0),
  quantity          numeric(14,3) not null check (quantity > 0),
  received_quantity numeric(14,3) not null default 0 check (received_quantity >= 0),
  unit_price        numeric(14,2) not null check (unit_price >= 0),
  line_total        numeric(14,2) not null check (line_total >= 0),
  constraint purchase_order_items_key unique (purchase_order_id, product_id, uom),
  constraint purchase_order_items_not_over_received check (received_quantity <= quantity)
);

create table public.goods_receipts (
  id                uuid primary key default gen_random_uuid(),
  grn_number        text not null unique,
  purchase_order_id uuid not null references public.purchase_orders (id),
  supplier_id       uuid not null references public.suppliers (id),
  branch_id         uuid not null references public.branches (id),
  received_date     date not null default current_date,
  total_received    numeric(14,2) not null default 0 check (total_received >= 0),
  amount_paid       numeric(14,2) not null default 0 check (amount_paid >= 0),
  payment_status    text not null default 'unpaid' check (payment_status in ('unpaid', 'partial', 'paid')),
  notes             text,
  created_by        uuid,
  created_at        timestamptz not null default now()
);

create index goods_receipts_supplier_idx on public.goods_receipts (supplier_id, received_date desc);

create table public.goods_receipt_items (
  id                     uuid primary key default gen_random_uuid(),
  goods_receipt_id       uuid not null references public.goods_receipts (id) on delete cascade,
  purchase_order_item_id uuid not null references public.purchase_order_items (id),
  product_id             uuid not null references public.products (id),
  quantity_received      numeric(14,3) not null check (quantity_received > 0),
  -- Cost per BASE unit at 4dp, so a carton rate that does not divide evenly
  -- (1000 / 12) survives partial receipts without drifting by paisa.
  unit_cost              numeric(14,4) not null check (unit_cost >= 0),
  line_total             numeric(14,2) not null check (line_total >= 0)
);

alter table public.payment_allocations
  add constraint payment_allocations_grn_fkey
  foreign key (goods_receipt_id) references public.goods_receipts (id);

-- ---------------------------------------------------------------------------
-- create_purchase_order
-- ---------------------------------------------------------------------------
create or replace function public.create_purchase_order(
  p_supplier_id uuid,
  p_branch_id uuid,
  p_expected_date date,
  p_notes text,
  p_items jsonb
)
returns table (purchase_order_id uuid, po_number text, total numeric)
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
  v_total numeric := 0;
begin
  if v_role is null or v_role not in ('owner', 'manager') then
    raise exception 'Your role is not allowed to raise purchase orders.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.suppliers where id = p_supplier_id and status = 'active') then
    raise exception 'Active supplier not found.';
  end if;
  if not exists (select 1 from public.branches where id = p_branch_id and status = 'active') then
    raise exception 'Active branch not found.';
  end if;
  if p_expected_date is not null and p_expected_date < current_date then
    raise exception 'Expected date cannot be in the past.';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Add at least one line to the purchase order.';
  end if;

  v_number := 'PO-' || upper(substr(replace(v_id::text, '-', ''), 1, 8));
  insert into public.purchase_orders (id, po_number, supplier_id, branch_id, expected_date, notes, created_by)
  values (v_id, v_number, p_supplier_id, p_branch_id, p_expected_date, nullif(trim(p_notes), ''), auth.uid());

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
    v_unit_price := coalesce((v_item ->> 'unit_price')::numeric, -1);
    if v_qty_entered <= 0 or v_unit_price < 0 then
      raise exception 'Line quantity and price must be valid.';
    end if;

    v_quantity := v_qty_entered * case when v_uom = 'carton' then v_product.units_per_carton else 1 end;
    v_line_total := round(v_qty_entered * v_unit_price, 2);

    insert into public.purchase_order_items (
      purchase_order_id, product_id, uom, qty_entered, quantity, unit_price, line_total
    ) values (v_id, v_product.id, v_uom, v_qty_entered, v_quantity, v_unit_price, v_line_total);

    v_total := v_total + v_line_total;
  end loop;

  update public.purchase_orders set subtotal = v_total, total = v_total where id = v_id;
  return query select v_id, v_number, v_total;
end;
$$;

create or replace function public.issue_purchase_order(p_purchase_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text := public.current_staff_role();
  v_status text;
begin
  if v_role is null or v_role not in ('owner', 'manager') then
    raise exception 'Your role is not allowed to issue purchase orders.' using errcode = '42501';
  end if;

  select status into v_status from public.purchase_orders where id = p_purchase_order_id for update;
  if v_status is null then
    raise exception 'Purchase order not found.';
  end if;
  if v_status <> 'draft' then
    raise exception 'Only a draft purchase order can be issued (this one is %).', v_status;
  end if;

  update public.purchase_orders set status = 'issued' where id = p_purchase_order_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- receive_purchase_order — stock in, supplier credited, average cost updated.
-- ---------------------------------------------------------------------------
create or replace function public.receive_purchase_order(
  p_purchase_order_id uuid,
  p_received_date date,
  p_notes text,
  p_items jsonb
)
returns table (goods_receipt_id uuid, grn_number text, total_received numeric)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text := public.current_staff_role();
  v_po public.purchase_orders%rowtype;
  v_receipt_id uuid := gen_random_uuid();
  v_number text;
  v_item jsonb;
  v_po_item public.purchase_order_items%rowtype;
  v_quantity numeric;
  v_remaining numeric;
  v_rate numeric;
  v_line_total numeric;
  v_on_hand numeric;
  v_avg_cost numeric;
  v_total numeric := 0;
  v_still_open boolean;
begin
  if v_role is null or v_role not in ('owner', 'manager', 'warehouse') then
    raise exception 'Your role is not allowed to receive goods.' using errcode = '42501';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Add at least one line to receive.';
  end if;

  select * into v_po from public.purchase_orders where id = p_purchase_order_id for update;
  if not found then
    raise exception 'Purchase order not found.';
  end if;
  if v_po.status not in ('issued', 'partially_received') then
    raise exception 'This purchase order is not ready to receive (it is %).', v_po.status;
  end if;

  v_number := 'GRN-' || upper(substr(replace(v_receipt_id::text, '-', ''), 1, 8));
  insert into public.goods_receipts (
    id, grn_number, purchase_order_id, supplier_id, branch_id, received_date, notes, created_by
  ) values (
    v_receipt_id, v_number, v_po.id, v_po.supplier_id, v_po.branch_id,
    coalesce(p_received_date, current_date), nullif(trim(p_notes), ''), auth.uid()
  );

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    select * into v_po_item from public.purchase_order_items
    where id = (v_item ->> 'purchase_order_item_id')::uuid
      and purchase_order_id = v_po.id
    for update;
    if not found then
      raise exception 'Purchase-order line not found.';
    end if;

    -- Quantities are received in BASE units.
    v_quantity := coalesce((v_item ->> 'quantity_received')::numeric, 0);
    if v_quantity < 0 then
      raise exception 'Received quantity cannot be negative.';
    end if;
    continue when v_quantity = 0;

    v_remaining := v_po_item.quantity - v_po_item.received_quantity;
    if v_quantity > v_remaining then
      raise exception 'Received quantity exceeds what is still outstanding on that line.';
    end if;

    -- Cost per base unit, derived from the ordered line so a carton price is
    -- spread correctly over the units inside it.
    v_rate := round(v_po_item.line_total / v_po_item.quantity, 4);
    v_line_total := round(v_quantity * v_rate, 2);

    insert into public.goods_receipt_items (
      goods_receipt_id, purchase_order_item_id, product_id, quantity_received, unit_cost, line_total
    ) values (v_receipt_id, v_po_item.id, v_po_item.product_id, v_quantity, v_rate, v_line_total);

    update public.purchase_order_items
    set received_quantity = received_quantity + v_quantity
    where id = v_po_item.id;

    -- Weighted-average cost, computed BEFORE the stock lands.
    v_on_hand := public.product_on_hand(v_po_item.product_id);
    select avg_cost into v_avg_cost from public.products where id = v_po_item.product_id;

    if v_on_hand <= 0 or coalesce(v_avg_cost, 0) <= 0 then
      v_avg_cost := v_rate;
    else
      v_avg_cost := round((v_on_hand * v_avg_cost + v_quantity * v_rate) / (v_on_hand + v_quantity), 4);
    end if;

    update public.products
    set avg_cost = v_avg_cost,
        purchase_price = round(v_rate, 2)   -- last cost paid
    where id = v_po_item.product_id;

    perform public.apply_stock_movement(
      v_po_item.product_id, v_po.branch_id, v_quantity,
      null, 'purchase', p_notes, 'goods_receipt', v_receipt_id
    );

    v_total := v_total + v_line_total;
  end loop;

  if v_total <= 0 then
    raise exception 'Receive at least one unit.';
  end if;

  update public.goods_receipts set total_received = v_total where id = v_receipt_id;

  select exists (
    select 1 from public.purchase_order_items
    where purchase_order_id = v_po.id and received_quantity < quantity
  ) into v_still_open;

  update public.purchase_orders
  set status = case when v_still_open then 'partially_received' else 'received' end
  where id = v_po.id;

  -- We now owe the supplier.
  insert into public.ledger_entries (party_type, party_id, entry_date, debit, credit, reference_type, reference_id, notes, created_by)
  values ('supplier', v_po.supplier_id, coalesce(p_received_date, current_date), 0, v_total,
          'goods_receipt', v_receipt_id, nullif(trim(p_notes), ''), auth.uid());

  return query select v_receipt_id, v_number, v_total;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.purchase_orders      enable row level security;
alter table public.purchase_order_items enable row level security;
alter table public.goods_receipts       enable row level security;
alter table public.goods_receipt_items  enable row level security;

create policy purchase_orders_read on public.purchase_orders
  for select to authenticated
  using (public.staff_has_role('owner', 'manager', 'warehouse', 'accountant'));
create policy purchase_order_items_read on public.purchase_order_items
  for select to authenticated
  using (public.staff_has_role('owner', 'manager', 'warehouse', 'accountant'));
create policy goods_receipts_read on public.goods_receipts
  for select to authenticated
  using (public.staff_has_role('owner', 'manager', 'warehouse', 'accountant'));
create policy goods_receipt_items_read on public.goods_receipt_items
  for select to authenticated
  using (public.staff_has_role('owner', 'manager', 'warehouse', 'accountant'));

grant select on public.purchase_orders, public.purchase_order_items,
                public.goods_receipts, public.goods_receipt_items to authenticated;

revoke all on function public.create_purchase_order(uuid, uuid, date, text, jsonb) from public, anon;
revoke all on function public.issue_purchase_order(uuid) from public, anon;
revoke all on function public.receive_purchase_order(uuid, date, text, jsonb) from public, anon;
grant execute on function public.create_purchase_order(uuid, uuid, date, text, jsonb) to authenticated, service_role;
grant execute on function public.issue_purchase_order(uuid) to authenticated, service_role;
grant execute on function public.receive_purchase_order(uuid, date, text, jsonb) to authenticated, service_role;
