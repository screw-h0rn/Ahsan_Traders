-- ============================================================================
-- 03 · Inventory: on-hand stock, the movement ledger, and transfers.
--
-- THE INVARIANT: for every product and branch,
--
--     inventory.quantity  ==  sum(stock_movements.quantity_delta)
--
-- It holds because adjust_stock() is the ONLY thing that may touch either
-- table, it does both writes in one transaction under a row lock, and nothing
-- else is granted permission to write. In the previous system a second code
-- path wrote to inventory directly, skipped the movement log, and the two
-- silently diverged. That is designed out here rather than fixed later.
-- ============================================================================

create table public.inventory (
  id                uuid primary key default gen_random_uuid(),
  product_id        uuid not null references public.products (id),
  branch_id         uuid not null references public.branches (id),
  quantity          numeric(14,3) not null default 0 check (quantity >= 0),
  reorder_threshold numeric(14,3) not null default 0 check (reorder_threshold >= 0),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint inventory_product_branch_key unique (product_id, branch_id)
);

create index inventory_product_idx on public.inventory (product_id);
create index inventory_low_stock_idx on public.inventory (branch_id)
  where quantity <= reorder_threshold;

create trigger inventory_set_updated_at
  before update on public.inventory
  for each row execute function public.set_updated_at();

create table public.stock_movements (
  id             uuid primary key default gen_random_uuid(),
  product_id     uuid not null references public.products (id),
  branch_id      uuid not null references public.branches (id),
  quantity_delta numeric(14,3) not null check (quantity_delta <> 0),
  balance_after  numeric(14,3) not null check (balance_after >= 0),
  movement_type  text not null check (movement_type in
                   ('opening', 'adjustment', 'purchase', 'sale', 'sales_return',
                    'purchase_return', 'transfer_in', 'transfer_out', 'damage')),
  reference_type text,
  reference_id   uuid,
  notes          text,
  created_by     uuid,
  created_at     timestamptz not null default now()
);

create index stock_movements_product_idx
  on public.stock_movements (product_id, branch_id, created_at desc);
create index stock_movements_reference_idx
  on public.stock_movements (reference_type, reference_id);

comment on table public.stock_movements is
  'Append-only history of every stock change. On-hand must always equal the sum of these.';

-- ---------------------------------------------------------------------------
-- apply_stock_movement — INTERNAL. The one and only thing that writes stock.
--
-- Deliberately has no role check of its own, and is NOT callable by
-- `authenticated`. It exists so that business transactions can move stock as a
-- consequence of what they are (invoicing a sale, receiving a delivery,
-- transferring between branches) without every caller needing the same
-- permissions as someone doing a manual stock correction.
--
-- "May this person hand-adjust stock?" and "may this sale reduce stock?" are
-- different questions. adjust_stock() below answers the first; the sales and
-- purchasing functions answer the second for themselves, each with the role
-- check appropriate to that operation.
-- ---------------------------------------------------------------------------
create or replace function public.apply_stock_movement(
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
  v_inventory public.inventory%rowtype;
  v_new_quantity numeric;
begin
  if p_quantity_delta = 0 and p_reorder_threshold is null then
    raise exception 'Provide a stock change or a reorder threshold.';
  end if;
  if p_reorder_threshold is not null and p_reorder_threshold < 0 then
    raise exception 'Reorder threshold cannot be negative.';
  end if;
  if not exists (select 1 from public.products where id = p_product_id and status = 'active') then
    raise exception 'Active product not found.';
  end if;
  if not exists (select 1 from public.branches where id = p_branch_id and status = 'active') then
    raise exception 'Active branch not found.';
  end if;

  insert into public.inventory (product_id, branch_id)
  values (p_product_id, p_branch_id)
  on conflict (product_id, branch_id) do nothing;

  select * into v_inventory
  from public.inventory
  where product_id = p_product_id and branch_id = p_branch_id
  for update;

  v_new_quantity := v_inventory.quantity + p_quantity_delta;
  if v_new_quantity < 0 then
    raise exception 'Not enough stock: % on hand, % requested.',
      v_inventory.quantity, abs(p_quantity_delta);
  end if;

  update public.inventory
  set quantity = v_new_quantity,
      reorder_threshold = coalesce(p_reorder_threshold, v_inventory.reorder_threshold)
  where id = v_inventory.id
  returning * into v_inventory;

  if p_quantity_delta <> 0 then
    insert into public.stock_movements (
      product_id, branch_id, quantity_delta, balance_after,
      movement_type, reference_type, reference_id, notes, created_by
    ) values (
      p_product_id, p_branch_id, p_quantity_delta, v_new_quantity,
      p_movement_type, p_reference_type, p_reference_id, nullif(trim(p_notes), ''), auth.uid()
    );
  end if;

  return query select v_inventory.id, v_inventory.quantity, v_inventory.reorder_threshold;
end;
$$;

-- ---------------------------------------------------------------------------
-- adjust_stock — the PUBLIC entry point for a manual stock correction:
-- opening balances, stock counts, damages, write-offs.
-- ---------------------------------------------------------------------------
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
begin
  if public.current_staff_role() not in ('owner', 'manager', 'warehouse') then
    raise exception 'Your role is not allowed to change stock.' using errcode = '42501';
  end if;

  -- A manual correction may only be recorded as one of these. Sales and
  -- purchase movements are written by their own transactions, not by hand.
  if p_movement_type not in ('opening', 'adjustment', 'damage') then
    raise exception 'A manual adjustment must be opening, adjustment or damage.';
  end if;

  return query select * from public.apply_stock_movement(
    p_product_id, p_branch_id, p_quantity_delta, p_reorder_threshold,
    p_movement_type, p_notes, p_reference_type, p_reference_id
  );
end;
$$;

/** On-hand across all branches, in base units. */
create or replace function public.product_on_hand(p_product_id uuid)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(quantity), 0) from public.inventory where product_id = p_product_id;
$$;

-- ---------------------------------------------------------------------------
-- Stock transfers between branches.
-- ---------------------------------------------------------------------------
create table public.stock_transfers (
  id             uuid primary key default gen_random_uuid(),
  transfer_number text not null unique,
  from_branch_id uuid not null references public.branches (id),
  to_branch_id   uuid not null references public.branches (id),
  status         text not null default 'in_transit'
                 check (status in ('in_transit', 'received', 'cancelled')),
  notes          text,
  created_by     uuid,
  created_at     timestamptz not null default now(),
  received_at    timestamptz,
  constraint stock_transfers_distinct_branches check (from_branch_id <> to_branch_id)
);

create table public.stock_transfer_items (
  id                uuid primary key default gen_random_uuid(),
  stock_transfer_id uuid not null references public.stock_transfers (id) on delete cascade,
  product_id        uuid not null references public.products (id),
  quantity          numeric(14,3) not null check (quantity > 0),
  constraint stock_transfer_items_key unique (stock_transfer_id, product_id)
);

/** Move stock out of the source branch immediately; it lands on receipt. */
create or replace function public.create_stock_transfer(
  p_from_branch_id uuid,
  p_to_branch_id uuid,
  p_notes text,
  p_items jsonb
)
returns table (stock_transfer_id uuid, transfer_number text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text := public.current_staff_role();
  v_id uuid := gen_random_uuid();
  v_number text;
  v_item jsonb;
  v_quantity numeric;
begin
  if v_role is null or v_role not in ('owner', 'manager', 'warehouse') then
    raise exception 'Your role is not allowed to transfer stock.' using errcode = '42501';
  end if;
  if p_from_branch_id = p_to_branch_id then
    raise exception 'Source and destination must be different branches.';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Add at least one product to transfer.';
  end if;

  v_number := 'TR-' || upper(substr(replace(v_id::text, '-', ''), 1, 8));
  insert into public.stock_transfers (id, transfer_number, from_branch_id, to_branch_id, notes, created_by)
  values (v_id, v_number, p_from_branch_id, p_to_branch_id, nullif(trim(p_notes), ''), auth.uid());

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_quantity := coalesce((v_item ->> 'quantity')::numeric, 0);
    if v_quantity <= 0 then
      raise exception 'Transfer quantity must be greater than zero.';
    end if;

    insert into public.stock_transfer_items (stock_transfer_id, product_id, quantity)
    values (v_id, (v_item ->> 'product_id')::uuid, v_quantity);

    perform public.apply_stock_movement(
      (v_item ->> 'product_id')::uuid, p_from_branch_id, -v_quantity,
      null, 'transfer_out', p_notes, 'stock_transfer', v_id
    );
  end loop;

  return query select v_id, v_number;
end;
$$;

create or replace function public.receive_stock_transfer(p_stock_transfer_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text := public.current_staff_role();
  v_transfer public.stock_transfers%rowtype;
  v_item record;
begin
  if v_role is null or v_role not in ('owner', 'manager', 'warehouse') then
    raise exception 'Your role is not allowed to receive transfers.' using errcode = '42501';
  end if;

  select * into v_transfer from public.stock_transfers where id = p_stock_transfer_id for update;
  if not found then
    raise exception 'Transfer not found.';
  end if;
  if v_transfer.status <> 'in_transit' then
    raise exception 'This transfer is already %.', v_transfer.status;
  end if;

  for v_item in
    select product_id, quantity from public.stock_transfer_items
    where stock_transfer_id = p_stock_transfer_id
  loop
    perform public.apply_stock_movement(
      v_item.product_id, v_transfer.to_branch_id, v_item.quantity,
      null, 'transfer_in', v_transfer.notes, 'stock_transfer', v_transfer.id
    );
  end loop;

  update public.stock_transfers
  set status = 'received', received_at = now()
  where id = p_stock_transfer_id;
end;
$$;

/** Abandon a transfer and put the stock back where it came from. */
create or replace function public.cancel_stock_transfer(p_stock_transfer_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text := public.current_staff_role();
  v_transfer public.stock_transfers%rowtype;
  v_item record;
begin
  if v_role is null or v_role not in ('owner', 'manager', 'warehouse') then
    raise exception 'Your role is not allowed to cancel transfers.' using errcode = '42501';
  end if;

  select * into v_transfer from public.stock_transfers where id = p_stock_transfer_id for update;
  if not found then
    raise exception 'Transfer not found.';
  end if;
  if v_transfer.status <> 'in_transit' then
    raise exception 'This transfer is already %.', v_transfer.status;
  end if;

  for v_item in
    select product_id, quantity from public.stock_transfer_items
    where stock_transfer_id = p_stock_transfer_id
  loop
    perform public.apply_stock_movement(
      v_item.product_id, v_transfer.from_branch_id, v_item.quantity,
      null, 'transfer_in', 'Transfer cancelled', 'stock_transfer', v_transfer.id
    );
  end loop;

  update public.stock_transfers set status = 'cancelled' where id = p_stock_transfer_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS — read-only to staff; every write goes through the functions above.
-- ---------------------------------------------------------------------------
alter table public.inventory            enable row level security;
alter table public.stock_movements      enable row level security;
alter table public.stock_transfers      enable row level security;
alter table public.stock_transfer_items enable row level security;

create policy inventory_read on public.inventory
  for select to authenticated using (public.is_staff());
create policy stock_movements_read on public.stock_movements
  for select to authenticated using (public.is_staff());
create policy stock_transfers_read on public.stock_transfers
  for select to authenticated using (public.is_staff());
create policy stock_transfer_items_read on public.stock_transfer_items
  for select to authenticated using (public.is_staff());

grant select on public.inventory, public.stock_movements,
                public.stock_transfers, public.stock_transfer_items to authenticated;

-- The internal mover is never callable by a client — only by the SECURITY
-- DEFINER transactions that legitimately move stock.
revoke all on function public.apply_stock_movement(uuid, uuid, numeric, numeric, text, text, text, uuid)
  from public, anon, authenticated;

revoke all on function public.adjust_stock(uuid, uuid, numeric, numeric, text, text, text, uuid) from public, anon;
revoke all on function public.create_stock_transfer(uuid, uuid, text, jsonb) from public, anon;
revoke all on function public.receive_stock_transfer(uuid) from public, anon;
revoke all on function public.cancel_stock_transfer(uuid) from public, anon;
revoke all on function public.product_on_hand(uuid) from public, anon;
grant execute on function public.adjust_stock(uuid, uuid, numeric, numeric, text, text, text, uuid) to authenticated, service_role;
grant execute on function public.create_stock_transfer(uuid, uuid, text, jsonb) to authenticated, service_role;
grant execute on function public.receive_stock_transfer(uuid) to authenticated, service_role;
grant execute on function public.cancel_stock_transfer(uuid) to authenticated, service_role;
grant execute on function public.product_on_hand(uuid) to authenticated, service_role;
