-- ============================================================================
-- 04 · Finance: the ledger, party balances, payments and credit.
--
-- The ledger is append-only and it is the truth. No table stores a balance —
-- every balance in the system is computed from opening_balance plus the sum of
-- entries, every time it is asked for. There is therefore no such thing as a
-- balance that has "gone wrong": if a number looks odd, the entries explain it.
--
-- Sign convention, from the business's point of view:
--   customer  debit  = they owe us more (an invoice)
--             credit = they owe us less (a payment received)
--   supplier  credit = we owe them more (goods received)
--             debit  = we owe them less (a payment made)
-- ============================================================================

create table public.ledger_entries (
  id             uuid primary key default gen_random_uuid(),
  party_type     text not null check (party_type in ('customer', 'supplier')),
  party_id       uuid not null,
  entry_date     date not null default current_date,
  debit          numeric(14,2) not null default 0 check (debit >= 0),
  credit         numeric(14,2) not null default 0 check (credit >= 0),
  reference_type text,
  reference_id   uuid,
  notes          text,
  created_by     uuid,
  created_at     timestamptz not null default now(),
  constraint ledger_entries_one_sided check ((debit > 0) <> (credit > 0))
);

create index ledger_entries_party_idx
  on public.ledger_entries (party_type, party_id, entry_date, created_at);
create index ledger_entries_reference_idx
  on public.ledger_entries (reference_type, reference_id);

comment on table public.ledger_entries is
  'Append-only. Balances are derived from this, never stored.';

-- ---------------------------------------------------------------------------
-- Balances
-- ---------------------------------------------------------------------------

/** What a customer currently owes. Positive = they owe us. */
create or replace function public.customer_balance(p_customer_id uuid)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select round(
    coalesce((select opening_balance from public.customers where id = p_customer_id), 0)
    + coalesce((
        select sum(debit - credit) from public.ledger_entries
        where party_type = 'customer' and party_id = p_customer_id
      ), 0), 2);
$$;

/** What we currently owe a supplier. Positive = we owe them. */
create or replace function public.supplier_balance(p_supplier_id uuid)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select round(
    coalesce((select opening_balance from public.suppliers where id = p_supplier_id), 0)
    + coalesce((
        select sum(credit - debit) from public.ledger_entries
        where party_type = 'supplier' and party_id = p_supplier_id
      ), 0), 2);
$$;

/**
 * How much more this customer may take on credit right now.
 * NULL means unlimited (no limit set). Never negative.
 */
create or replace function public.customer_available_credit(p_customer_id uuid)
returns numeric
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_limit numeric;
begin
  select credit_limit into v_limit from public.customers where id = p_customer_id;
  if v_limit is null then
    return null;
  end if;
  return greatest(v_limit - public.customer_balance(p_customer_id), 0);
end;
$$;

/**
 * Would adding p_amount to this customer's balance breach their limit?
 *
 * NULL limit  -> never breaches (unlimited).
 * 0 limit     -> any outstanding balance breaches (cash only).
 */
create or replace function public.customer_would_exceed_credit(p_customer_id uuid, p_amount numeric)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_limit numeric;
begin
  select credit_limit into v_limit from public.customers where id = p_customer_id;
  if v_limit is null then
    return false;
  end if;
  return (public.customer_balance(p_customer_id) + coalesce(p_amount, 0)) > v_limit;
end;
$$;

-- ---------------------------------------------------------------------------
-- payments
-- ---------------------------------------------------------------------------
create table public.payments (
  id             uuid primary key default gen_random_uuid(),
  payment_number text not null unique,
  party_type     text not null check (party_type in ('customer', 'supplier')),
  party_id       uuid not null,
  direction      text not null check (direction in ('in', 'out')),
  amount         numeric(14,2) not null check (amount > 0),
  method         text not null check (method in ('cash', 'bank_transfer', 'cheque', 'card', 'other')),
  reference      text,
  payment_date   date not null default current_date,
  notes          text,
  created_by     uuid,
  created_at     timestamptz not null default now()
);

create index payments_party_idx on public.payments (party_type, party_id, payment_date desc);

-- Links a payment to the documents it settles, so each invoice knows how much
-- of it has been paid.
create table public.payment_allocations (
  id               uuid primary key default gen_random_uuid(),
  payment_id       uuid not null references public.payments (id) on delete cascade,
  invoice_id       uuid,
  goods_receipt_id uuid,
  amount           numeric(14,2) not null check (amount > 0),
  created_at       timestamptz not null default now(),
  constraint payment_allocations_one_target check (
    (invoice_id is not null and goods_receipt_id is null)
    or (invoice_id is null and goods_receipt_id is not null)
  )
);

create index payment_allocations_payment_idx on public.payment_allocations (payment_id);
create index payment_allocations_invoice_idx on public.payment_allocations (invoice_id) where invoice_id is not null;
create index payment_allocations_grn_idx on public.payment_allocations (goods_receipt_id) where goods_receipt_id is not null;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.ledger_entries      enable row level security;
alter table public.payments            enable row level security;
alter table public.payment_allocations enable row level security;

-- Staff with a finance remit see the books. Sales and warehouse do not.
create policy ledger_entries_staff_read on public.ledger_entries
  for select to authenticated
  using (public.staff_has_role('owner', 'manager', 'accountant'));

-- A shop sees its own account, and nothing else. This is what powers the
-- "my balance" and "my statement" screens in the mobile app.
create policy ledger_entries_customer_read on public.ledger_entries
  for select to authenticated
  using (party_type = 'customer' and party_id = (select public.current_customer_id()));

create policy payments_staff_read on public.payments
  for select to authenticated
  using (public.staff_has_role('owner', 'manager', 'accountant'));

create policy payments_customer_read on public.payments
  for select to authenticated
  using (party_type = 'customer' and party_id = (select public.current_customer_id()));

create policy payment_allocations_staff_read on public.payment_allocations
  for select to authenticated
  using (public.staff_has_role('owner', 'manager', 'accountant'));

grant select on public.ledger_entries, public.payments, public.payment_allocations to authenticated;

revoke all on function public.customer_balance(uuid) from public, anon;
revoke all on function public.supplier_balance(uuid) from public, anon;
revoke all on function public.customer_available_credit(uuid) from public, anon;
revoke all on function public.customer_would_exceed_credit(uuid, numeric) from public, anon;
grant execute on function public.customer_balance(uuid) to authenticated, service_role;
grant execute on function public.supplier_balance(uuid) to authenticated, service_role;
grant execute on function public.customer_available_credit(uuid) to authenticated, service_role;
grant execute on function public.customer_would_exceed_credit(uuid, numeric) to authenticated, service_role;
