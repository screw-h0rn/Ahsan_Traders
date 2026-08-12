-- ============================================================================
-- 02 · Master data: branches, categories, products, suppliers.
--
-- Read access is broad (staff see everything; customers see the sellable
-- catalogue). Write access is role-gated in the policies themselves rather
-- than left to the application to remember.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- branches — warehouses and shops. A default one is created below so stock
-- has somewhere to live from day one.
-- ---------------------------------------------------------------------------
create table public.branches (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  type       text not null default 'warehouse' check (type in ('warehouse', 'branch')),
  address    text,
  phone      text,
  is_default boolean not null default false,
  status     text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index branches_name_key on public.branches (lower(name));
-- At most one default branch. Customer orders and mobile bookings land here
-- when no branch is specified.
create unique index branches_single_default on public.branches (is_default) where is_default;

create trigger branches_set_updated_at
  before update on public.branches
  for each row execute function public.set_updated_at();

insert into public.branches (name, type, is_default) values ('Main Warehouse', 'warehouse', true);

-- ---------------------------------------------------------------------------
-- categories — optional one-level-or-deeper grouping.
-- ---------------------------------------------------------------------------
create table public.categories (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  parent_id  uuid references public.categories (id),
  status     text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint categories_parent_not_self check (parent_id is null or parent_id <> id)
);

create unique index categories_name_key on public.categories (lower(name), coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid));

create trigger categories_set_updated_at
  before update on public.categories
  for each row execute function public.set_updated_at();

-- A category cannot end up as its own ancestor.
create or replace function public.prevent_category_cycle()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_parent uuid := new.parent_id;
  v_depth int := 0;
begin
  while v_parent is not null loop
    if v_parent = new.id then
      raise exception 'A category cannot be its own ancestor.';
    end if;
    v_depth := v_depth + 1;
    if v_depth > 20 then
      raise exception 'Category nesting is too deep.';
    end if;
    select parent_id into v_parent from public.categories where id = v_parent;
  end loop;
  return new;
end;
$$;

create trigger categories_no_cycle
  before insert or update of parent_id on public.categories
  for each row execute function public.prevent_category_cycle();

-- ---------------------------------------------------------------------------
-- suppliers
-- ---------------------------------------------------------------------------
create table public.suppliers (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  phone           text,
  email           text,
  address         text,
  opening_balance numeric(14,2) not null default 0,
  notes           text,
  status          text not null default 'active' check (status in ('active', 'archived')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create unique index suppliers_name_key on public.suppliers (lower(name)) where status = 'active';

create trigger suppliers_set_updated_at
  before update on public.suppliers
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- products
--
-- Stock is always counted in the product's BASE unit (the smallest sellable
-- unit, e.g. one bottle). A carton is a packing definition on top of that:
-- units_per_carton tells the system how many base units a carton holds, so a
-- line entered as "2 cartons" becomes 24 base units for stock purposes while
-- still being priced and printed as cartons.
--
-- Variants (e.g. "Rs 10" vs "Rs 20" packs) are full product rows pointing at a
-- parent, so they carry their own SKU, stock and price.
-- ---------------------------------------------------------------------------
create table public.products (
  id                 uuid primary key default gen_random_uuid(),
  category_id        uuid references public.categories (id),
  parent_product_id  uuid references public.products (id),
  variant_label      text,
  name               text not null,
  sku                text not null,
  barcode            text,
  unit               text not null default 'piece',
  units_per_carton   integer not null default 1 check (units_per_carton >= 1),
  purchase_price     numeric(14,2) not null default 0 check (purchase_price >= 0),
  sale_price         numeric(14,2) not null default 0 check (sale_price >= 0),
  carton_sale_price  numeric(14,2) check (carton_sale_price is null or carton_sale_price >= 0),
  -- Weighted-average cost per base unit, maintained by goods receiving.
  avg_cost           numeric(14,4) not null default 0 check (avg_cost >= 0),
  -- Sellable to customers in the shop app. Lets staff keep products that are
  -- ordered by phone only out of the public catalogue.
  is_public          boolean not null default true,
  status             text not null default 'active' check (status in ('active', 'archived')),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint products_parent_not_self check (parent_product_id is null or parent_product_id <> id)
);

create unique index products_sku_key on public.products (lower(sku));
create unique index products_barcode_key on public.products (lower(barcode)) where barcode is not null;
create index products_category_idx on public.products (category_id) where status = 'active';
create index products_parent_idx on public.products (parent_product_id) where parent_product_id is not null;
create index products_name_idx on public.products (lower(name));

create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

comment on column public.products.avg_cost is
  'Weighted-average cost per BASE unit. Maintained transactionally by receive_purchase_order.';
comment on column public.products.is_public is
  'When false the product is hidden from the customer app but still sellable by staff.';

/** Selling price for one unit of the chosen measure. */
create or replace function public.product_unit_price(p_product public.products, p_uom text)
returns numeric
language sql
immutable
set search_path = ''
as $$
  select case
    when p_uom = 'carton'
      then coalesce(p_product.carton_sale_price, p_product.sale_price * p_product.units_per_carton)
    else p_product.sale_price
  end;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.branches   enable row level security;
alter table public.categories enable row level security;
alter table public.suppliers  enable row level security;
alter table public.products   enable row level security;

-- Branches: staff only.
create policy branches_read on public.branches
  for select to authenticated using (public.is_staff());
create policy branches_insert on public.branches
  for insert to authenticated with check (public.staff_has_role('owner', 'manager'));
create policy branches_update on public.branches
  for update to authenticated
  using (public.staff_has_role('owner', 'manager'))
  with check (public.staff_has_role('owner', 'manager'));

-- Categories: staff only. Customers receive the catalogue through
-- customer_catalog() (see 07_customer_api.sql), which returns just the
-- browsing fields — never cost.
create policy categories_staff_read on public.categories
  for select to authenticated using (public.is_staff());
create policy categories_insert on public.categories
  for insert to authenticated with check (public.staff_has_role('owner', 'manager'));
create policy categories_update on public.categories
  for update to authenticated
  using (public.staff_has_role('owner', 'manager'))
  with check (public.staff_has_role('owner', 'manager'));

-- Suppliers: staff only, and not the sales team — they have no reason to see
-- what the business pays for its stock.
create policy suppliers_read on public.suppliers
  for select to authenticated
  using (public.staff_has_role('owner', 'manager', 'warehouse', 'accountant'));
create policy suppliers_insert on public.suppliers
  for insert to authenticated with check (public.staff_has_role('owner', 'manager'));
create policy suppliers_update on public.suppliers
  for update to authenticated
  using (public.staff_has_role('owner', 'manager'))
  with check (public.staff_has_role('owner', 'manager'));

-- Products: STAFF ONLY.
--
-- Customers deliberately get no direct access to this table. Column-level
-- grants cannot help here — they apply to the `authenticated` role as a whole,
-- so hiding purchase_price and avg_cost from a shop would hide them from staff
-- too. Instead the shop app calls customer_catalog(), which returns only the
-- browsing fields. Cost data therefore never leaves the building.
create policy products_staff_read on public.products
  for select to authenticated using (public.is_staff());
create policy products_insert on public.products
  for insert to authenticated with check (public.staff_has_role('owner', 'manager'));
create policy products_update on public.products
  for update to authenticated
  using (public.staff_has_role('owner', 'manager'))
  with check (public.staff_has_role('owner', 'manager'));

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
grant select on public.branches, public.categories, public.suppliers to authenticated;
grant insert, update on public.branches, public.categories, public.suppliers to authenticated;

grant select, insert, update on public.products to authenticated;

revoke all on function public.product_unit_price(public.products, text) from public, anon;
grant execute on function public.product_unit_price(public.products, text) to authenticated, service_role;
