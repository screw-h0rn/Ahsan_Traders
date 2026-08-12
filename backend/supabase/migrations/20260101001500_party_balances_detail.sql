-- ============================================================================
-- 15 · report_party_balances: full breakdown for the AR/AP page.
--
-- The AR/AP screen wants to show opening balance, total debits and total
-- credits alongside the running balance — not just the final number. The
-- first cut of this function only returned the balance. Extended here rather
-- than stripped from the UI, since the breakdown is genuinely useful for
-- reconciling a party's account at a glance.
--
-- Also fixes the same NULL-role hole as migration 14, since this function is
-- being replaced anyway: `if v_role is null or v_role not in (...)`.
-- ============================================================================

drop function if exists public.report_party_balances(text);
create function public.report_party_balances(p_party_type text)
returns table (
  party_id uuid,
  name text,
  phone text,
  opening_balance numeric,
  total_debit numeric,
  total_credit numeric,
  balance numeric,
  credit_limit numeric
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_role text := public.current_staff_role();
begin
  if v_role is null or v_role not in ('owner', 'manager', 'accountant') then
    raise exception 'Your role cannot view balances.' using errcode = '42501';
  end if;

  if p_party_type = 'customer' then
    return query
    select c.id, c.name, c.phone,
           coalesce(c.opening_balance, 0),
           coalesce(sum(le.debit), 0),
           coalesce(sum(le.credit), 0),
           public.customer_balance(c.id),
           c.credit_limit
    from public.customers c
    left join public.ledger_entries le
      on le.party_type = 'customer' and le.party_id = c.id
    where c.status = 'active' and public.customer_balance(c.id) <> 0
    group by c.id, c.name, c.phone, c.opening_balance, c.credit_limit
    order by public.customer_balance(c.id) desc;
  elsif p_party_type = 'supplier' then
    return query
    select s.id, s.name, s.phone,
           coalesce(s.opening_balance, 0),
           coalesce(sum(le.debit), 0),
           coalesce(sum(le.credit), 0),
           public.supplier_balance(s.id),
           null::numeric
    from public.suppliers s
    left join public.ledger_entries le
      on le.party_type = 'supplier' and le.party_id = s.id
    where s.status = 'active' and public.supplier_balance(s.id) <> 0
    group by s.id, s.name, s.phone, s.opening_balance
    order by public.supplier_balance(s.id) desc;
  else
    raise exception 'Party must be a customer or a supplier.';
  end if;
end;
$$;

revoke execute on function public.report_party_balances(text) from public, anon;
grant execute on function public.report_party_balances(text) to authenticated, service_role;
