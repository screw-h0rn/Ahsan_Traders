-- ============================================================================
-- 00 · Foundation: shared helpers, company profile, and the audit log.
--
-- THIS IS A SINGLE-BUSINESS SYSTEM. There is no tenant_id anywhere, and there
-- never should be. Every row in this database belongs to Ahsan Traders. What
-- separates people is not which company they belong to but WHO they are:
--
--   staff              employees, with a role (owner/manager/sales/...)
--   customer_accounts  a shop's login, tied to one row in `customers`
--
-- Those two identities are established in 01_identity.sql; this file sets up
-- the pieces they depend on.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Generic updated_at trigger.
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Phone normalisation — Pakistan-first.
--
-- Customers log in with a phone number and are matched to their `customers`
-- row by it, so "0300-1234567", "+92 300 1234567" and "923001234567" must all
-- reduce to the same value. Stored normalised, compared normalised, always.
-- ---------------------------------------------------------------------------
create or replace function public.normalize_phone(p_phone text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v text;
begin
  if p_phone is null then
    return null;
  end if;

  v := regexp_replace(p_phone, '[^0-9+]', '', 'g');
  v := ltrim(v, '+');

  if v like '00%' then
    v := substr(v, 3);
  end if;

  -- A leading 0 is the local trunk prefix: 03001234567 -> 923001234567.
  if v like '0%' then
    v := '92' || substr(v, 2);
  end if;

  -- Bare local number without trunk prefix: 3001234567 -> 923001234567.
  if length(v) = 10 and v like '3%' then
    v := '92' || v;
  end if;

  return nullif(v, '');
end;
$$;

-- ---------------------------------------------------------------------------
-- company_settings — exactly one row, forever.
--
-- The single-row constraint is enforced by the primary key itself: `id` may
-- only ever be true, so a second row is impossible. This replaces the
-- `tenants` table of the multi-tenant system.
-- ---------------------------------------------------------------------------
create table public.company_settings (
  id              boolean primary key default true check (id),
  name            text not null default 'Ahsan Traders',
  legal_name      text,
  address         text,
  phone           text,
  email           text,
  currency        text not null default 'PKR',
  tax_name        text not null default 'GST',
  tax_rate        numeric(5,2) not null default 0 check (tax_rate >= 0 and tax_rate <= 100),
  invoice_prefix  text not null default 'INV',
  order_prefix    text not null default 'SO',
  logo_url        text,
  -- Orders placed by customers in the mobile app wait for staff approval when
  -- true; when false they go straight to `pending` (still not stock-affecting).
  require_order_approval boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create trigger company_settings_set_updated_at
  before update on public.company_settings
  for each row execute function public.set_updated_at();

insert into public.company_settings (id) values (true);

comment on table public.company_settings is
  'Single-row company profile. The primary key can only be true, so a second row cannot exist.';

-- ---------------------------------------------------------------------------
-- audit_logs — immutable who/what/before/after for every write.
--
-- Deliberately has NO foreign keys to staff, customers or auth.users. An audit
-- record must outlive the row it describes; wiring it up with ON DELETE
-- cascades is what made users and companies undeletable in the previous
-- system (they fought with the immutability trigger below).
-- ---------------------------------------------------------------------------
create table public.audit_logs (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid,
  actor_label text,
  table_name  text not null,
  record_id   text not null,
  action      text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  old_data    jsonb,
  new_data    jsonb,
  created_at  timestamptz not null default now()
);

create index audit_logs_table_idx on public.audit_logs (table_name, created_at desc);
create index audit_logs_record_idx on public.audit_logs (table_name, record_id);
create index audit_logs_actor_idx on public.audit_logs (actor_id, created_at desc);

comment on column public.audit_logs.actor_id is
  'auth.users id of whoever made the change. Deliberately NOT a foreign key — the trail outlives the account.';

create or replace function public.prevent_audit_modification()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Audit logs are immutable and cannot be modified or deleted.';
end;
$$;

create trigger audit_logs_immutable
  before update or delete on public.audit_logs
  for each row execute function public.prevent_audit_modification();

-- The generic audit trigger. Attached to every write table at the end of the
-- migration set, once those tables exist.
create or replace function public.log_audit_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_record_id text;
  v_old jsonb;
  v_new jsonb;
begin
  if tg_op = 'DELETE' then
    v_old := to_jsonb(old);
    v_record_id := coalesce(v_old ->> 'id', '');
  else
    v_new := to_jsonb(new);
    v_record_id := coalesce(v_new ->> 'id', '');
    if tg_op = 'UPDATE' then
      v_old := to_jsonb(old);
    end if;
  end if;

  insert into public.audit_logs (actor_id, actor_label, table_name, record_id, action, old_data, new_data)
  values (
    auth.uid(),
    coalesce(
      (select s.full_name from public.staff s where s.id = auth.uid()),
      (select c.name from public.customers c
        join public.customer_accounts ca on ca.customer_id = c.id
       where ca.id = auth.uid()),
      'system'
    ),
    tg_table_name,
    v_record_id,
    tg_op,
    v_old,
    v_new
  );

  return coalesce(new, old);
end;
$$;
