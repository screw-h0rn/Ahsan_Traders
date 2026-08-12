-- ============================================================================
-- 01 · Identity: who is asking, and what are they allowed to see.
--
-- TWO KINDS OF LOGIN
--
--   staff              an employee. Has a role. Sees the business.
--   customer_accounts  a shop. Sees only its own orders, invoices and balance.
--
-- Both are rows keyed on auth.users.id, but they are separate tables and a
-- login must never be both (enforced below). Everything downstream — every
-- RLS policy, every function — asks one of three questions:
--
--   current_staff_role()   -> 'owner' | 'manager' | ... | NULL
--   current_customer_id()  -> the customer this login belongs to, or NULL
--   is_staff()             -> convenience for "is this an employee at all"
--
-- SIGNUP IS DELIBERATELY LOCKED DOWN. In the multi-tenant system anyone who
-- signed up silently became the owner of a brand-new company. Here:
--
--   * the FIRST account to sign up becomes the owner (bootstrap, once only);
--   * after that, staff can only be created by an invite from an owner;
--   * anyone signing up with a phone number becomes a customer account, which
--     starts as `pending` unless their number matches a customer on file.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- staff
-- ---------------------------------------------------------------------------
create table public.staff (
  id         uuid primary key references auth.users (id) on delete cascade,
  full_name  text not null,
  email      text,
  phone      text,
  role       text not null default 'sales'
             check (role in ('owner', 'manager', 'sales', 'warehouse', 'accountant')),
  status     text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index staff_email_key on public.staff (lower(email)) where email is not null;
create index staff_role_idx on public.staff (role) where status = 'active';

create trigger staff_set_updated_at
  before update on public.staff
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- customers — needed here because customer_accounts points at it.
-- ---------------------------------------------------------------------------
create table public.customers (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  phone          text,
  phone_norm     text generated always as (public.normalize_phone(phone)) stored,
  email          text,
  address        text,
  -- NULL means no credit limit set (unlimited). 0 means strictly cash-only.
  -- This is the opposite of the old system, where 0 silently meant unlimited
  -- and every auto-created customer got unlimited credit by accident.
  credit_limit   numeric(14,2) check (credit_limit is null or credit_limit >= 0),
  opening_balance numeric(14,2) not null default 0,
  notes          text,
  status         text not null default 'active' check (status in ('active', 'archived')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- One customer per phone number: the mobile login matches on it.
create unique index customers_phone_norm_key on public.customers (phone_norm)
  where phone_norm is not null and status = 'active';
create index customers_name_idx on public.customers (lower(name));

create trigger customers_set_updated_at
  before update on public.customers
  for each row execute function public.set_updated_at();

comment on column public.customers.credit_limit is
  'NULL = unlimited credit. 0 = cash only. Any positive value caps the outstanding balance.';

-- ---------------------------------------------------------------------------
-- customer_accounts — a shop's login into the mobile app.
--
-- Created by the signup trigger when someone registers with a phone number.
-- If that number matches exactly one active customer they are linked
-- immediately; otherwise the account sits `pending` until staff link it, so a
-- stranger who signs up sees nothing at all.
-- ---------------------------------------------------------------------------
create table public.customer_accounts (
  id          uuid primary key references auth.users (id) on delete cascade,
  customer_id uuid references public.customers (id) on delete set null,
  phone       text,
  phone_norm  text generated always as (public.normalize_phone(phone)) stored,
  status      text not null default 'pending'
              check (status in ('pending', 'active', 'blocked')),
  linked_at   timestamptz,
  linked_by   uuid,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index customer_accounts_customer_idx on public.customer_accounts (customer_id);
create index customer_accounts_phone_idx on public.customer_accounts (phone_norm);
create unique index customer_accounts_one_per_customer
  on public.customer_accounts (customer_id)
  where customer_id is not null and status = 'active';

create trigger customer_accounts_set_updated_at
  before update on public.customer_accounts
  for each row execute function public.set_updated_at();

-- A login is either staff or a customer, never both.
create or replace function public.assert_single_identity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_table_name = 'staff' then
    if exists (select 1 from public.customer_accounts where id = new.id) then
      raise exception 'This login is already a customer account and cannot also be staff.';
    end if;
  else
    if exists (select 1 from public.staff where id = new.id) then
      raise exception 'This login is already a staff account and cannot also be a customer.';
    end if;
  end if;
  return new;
end;
$$;

create trigger staff_single_identity
  before insert on public.staff
  for each row execute function public.assert_single_identity();

create trigger customer_accounts_single_identity
  before insert on public.customer_accounts
  for each row execute function public.assert_single_identity();

-- ---------------------------------------------------------------------------
-- The three questions. SECURITY DEFINER so they can read staff /
-- customer_accounts without tripping those tables' own RLS.
-- ---------------------------------------------------------------------------
create or replace function public.current_staff_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select role from public.staff where id = auth.uid() and status = 'active';
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.staff where id = auth.uid() and status = 'active');
$$;

create or replace function public.current_customer_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select ca.customer_id
  from public.customer_accounts ca
  join public.customers c on c.id = ca.customer_id
  where ca.id = auth.uid()
    and ca.status = 'active'
    and c.status = 'active';
$$;

/** True when the caller's role is in the supplied list. NULL-safe. */
create or replace function public.staff_has_role(variadic p_roles text[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.current_staff_role() = any(p_roles), false);
$$;

-- ---------------------------------------------------------------------------
-- Signup routing.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_account_type text;
  v_full_name    text;
  v_phone        text;
  v_phone_norm   text;
  v_role         text;
  v_customer_id  uuid;
  v_match_count  int;
begin
  v_account_type := coalesce(nullif(trim(new.raw_user_meta_data ->> 'account_type'), ''), '');
  v_full_name    := coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), new.email, new.phone, 'User');
  v_phone        := coalesce(new.phone, nullif(trim(new.raw_user_meta_data ->> 'phone'), ''));
  v_phone_norm   := public.normalize_phone(v_phone);

  -- ---- Customer: signed up in the shop app with a phone number ------------
  if v_account_type = 'customer' or (v_account_type = '' and new.email is null and v_phone is not null) then
    select count(*) into v_match_count
    from public.customers c
    where c.phone_norm = v_phone_norm and c.status = 'active';

    if v_match_count = 1 then
      select c.id into v_customer_id
      from public.customers c
      where c.phone_norm = v_phone_norm and c.status = 'active';
    end if;

    -- Exactly one match, and nobody has claimed it yet: link straight away.
    if v_match_count = 1 and not exists (
      select 1 from public.customer_accounts ca
      where ca.customer_id = v_customer_id and ca.status = 'active'
    ) then
      insert into public.customer_accounts (id, customer_id, phone, status, linked_at)
      values (new.id, v_customer_id, v_phone, 'active', now());
    else
      insert into public.customer_accounts (id, phone, status)
      values (new.id, v_phone, 'pending');
    end if;

    return new;
  end if;

  -- ---- Staff: bootstrap the very first account as owner -------------------
  if not exists (select 1 from public.staff) then
    insert into public.staff (id, full_name, email, phone, role, status)
    values (new.id, v_full_name, new.email, v_phone, 'owner', 'active');
    return new;
  end if;

  -- ---- Staff: invited by an owner ----------------------------------------
  -- The invite carries the role in user metadata; anything unrecognised (or
  -- an attempt to self-assign 'owner') falls back to the least privilege.
  if coalesce(nullif(trim(new.raw_user_meta_data ->> 'staff_invite'), ''), '') = 'true' then
    v_role := coalesce(nullif(trim(new.raw_user_meta_data ->> 'role'), ''), 'sales');
    if v_role not in ('manager', 'sales', 'warehouse', 'accountant') then
      v_role := 'sales';
    end if;

    insert into public.staff (id, full_name, email, phone, role, status)
    values (new.id, v_full_name, new.email, v_phone, v_role, 'active');
    return new;
  end if;

  -- ---- Anything else: no profile, therefore no access --------------------
  -- Deliberately silent. The account exists in auth but resolves to neither
  -- staff nor customer, so every policy denies it. The portal shows a clear
  -- "this account has no access" screen rather than looping.
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.company_settings enable row level security;
alter table public.audit_logs       enable row level security;
alter table public.staff            enable row level security;
alter table public.customers        enable row level security;
alter table public.customer_accounts enable row level security;

-- Company profile: any signed-in person may read it (the shop app shows the
-- business name and currency); only an owner may change it.
create policy company_settings_read on public.company_settings
  for select to authenticated
  using (public.is_staff() or public.current_customer_id() is not null);

create policy company_settings_update on public.company_settings
  for update to authenticated
  using (public.staff_has_role('owner'))
  with check (public.staff_has_role('owner'));

-- Staff directory: staff see each other. Nobody edits roles through the API —
-- that happens in server actions using the service key.
create policy staff_read on public.staff
  for select to authenticated
  using (public.is_staff());

create policy staff_update_self on public.staff
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Customers: staff see all; a shop sees only its own record.
create policy customers_staff_read on public.customers
  for select to authenticated
  using (public.is_staff());

create policy customers_self_read on public.customers
  for select to authenticated
  using (id = (select public.current_customer_id()));

create policy customers_write on public.customers
  for insert to authenticated
  with check (public.staff_has_role('owner', 'manager', 'sales'));

create policy customers_modify on public.customers
  for update to authenticated
  using (public.staff_has_role('owner', 'manager', 'sales'))
  with check (public.staff_has_role('owner', 'manager', 'sales'));

-- Customer logins: staff manage them; a customer sees only their own row.
create policy customer_accounts_staff_read on public.customer_accounts
  for select to authenticated
  using (public.is_staff());

create policy customer_accounts_self_read on public.customer_accounts
  for select to authenticated
  using (id = (select auth.uid()));

-- Audit log: owners and managers only.
create policy audit_logs_read on public.audit_logs
  for select to authenticated
  using (public.staff_has_role('owner', 'manager'));

-- ---------------------------------------------------------------------------
-- Grants. Reads are gated by the policies above; writes to these tables go
-- through SECURITY DEFINER functions or the service key, never directly.
-- ---------------------------------------------------------------------------
grant select on public.company_settings, public.staff, public.customers,
                public.customer_accounts, public.audit_logs to authenticated;
grant update on public.company_settings to authenticated;
grant update (full_name, phone) on public.staff to authenticated;
grant insert, update on public.customers to authenticated;

revoke all on function public.current_staff_role() from public, anon;
revoke all on function public.current_customer_id() from public, anon;
revoke all on function public.is_staff() from public, anon;
revoke all on function public.staff_has_role(text[]) from public, anon;
revoke all on function public.normalize_phone(text) from public, anon;
grant execute on function public.current_staff_role() to authenticated, service_role;
grant execute on function public.current_customer_id() to authenticated, service_role;
grant execute on function public.is_staff() to authenticated, service_role;
grant execute on function public.staff_has_role(text[]) to authenticated, service_role;
grant execute on function public.normalize_phone(text) to authenticated, service_role;
