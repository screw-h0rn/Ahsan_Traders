-- ============================================================================
-- 07 · Recording payments.
--
-- One call does three things atomically: writes the payment, posts the ledger
-- entry that moves the party's balance, and allocates the money against open
-- documents so each invoice knows how much of it has been settled.
--
-- Allocation is either explicit (the user ticked which invoices) or automatic
-- (oldest first). Anything left over stays unallocated — an advance on account,
-- which the ledger already accounts for correctly.
-- ============================================================================

create or replace function public.record_payment(
  p_party_type text,
  p_party_id uuid,
  p_direction text,
  p_amount numeric,
  p_method text,
  p_payment_date date default null,
  p_notes text default null,
  p_reference text default null,
  p_allocations jsonb default null
)
returns table (payment_id uuid, payment_number text, allocated_amount numeric, unallocated_amount numeric)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text := public.current_staff_role();
  v_id uuid := gen_random_uuid();
  v_number text;
  v_amount numeric;
  v_debit numeric := 0;
  v_credit numeric := 0;
  v_remaining numeric;
  v_allocated numeric := 0;
  v_alloc jsonb;
  v_doc_id uuid;
  v_alloc_amount numeric;
  v_outstanding numeric;
  v_open record;
begin
  if v_role is null or v_role not in ('owner', 'manager', 'accountant') then
    raise exception 'Your role is not allowed to record payments.' using errcode = '42501';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be greater than zero.';
  end if;
  if p_party_type not in ('customer', 'supplier') then
    raise exception 'Party must be a customer or a supplier.';
  end if;
  if p_method not in ('cash', 'bank_transfer', 'cheque', 'card', 'other') then
    raise exception 'Unknown payment method.';
  end if;
  if p_party_type = 'customer' and p_direction <> 'in' then
    raise exception 'Money from a customer must be recorded as direction "in".';
  end if;
  if p_party_type = 'supplier' and p_direction <> 'out' then
    raise exception 'Money to a supplier must be recorded as direction "out".';
  end if;

  v_amount := round(p_amount, 2);

  if p_party_type = 'customer' then
    if not exists (select 1 from public.customers where id = p_party_id) then
      raise exception 'Customer not found.';
    end if;
    v_credit := v_amount;   -- they owe us less
  else
    if not exists (select 1 from public.suppliers where id = p_party_id) then
      raise exception 'Supplier not found.';
    end if;
    v_debit := v_amount;    -- we owe them less
  end if;

  v_number := 'PAY-' || upper(substr(replace(v_id::text, '-', ''), 1, 8));

  insert into public.payments (
    id, payment_number, party_type, party_id, direction, amount, method, reference, payment_date, notes, created_by
  ) values (
    v_id, v_number, p_party_type, p_party_id, p_direction, v_amount, p_method,
    nullif(trim(p_reference), ''), coalesce(p_payment_date, current_date), nullif(trim(p_notes), ''), auth.uid()
  );

  insert into public.ledger_entries (
    party_type, party_id, entry_date, debit, credit, reference_type, reference_id, notes, created_by
  ) values (
    p_party_type, p_party_id, coalesce(p_payment_date, current_date), v_debit, v_credit,
    'payment', v_id, nullif(trim(p_notes), ''), auth.uid()
  );

  v_remaining := v_amount;

  if p_allocations is not null and jsonb_typeof(p_allocations) = 'array'
     and jsonb_array_length(p_allocations) > 0 then
    -- Explicit: settle exactly what was ticked.
    for v_alloc in select value from jsonb_array_elements(p_allocations)
    loop
      v_alloc_amount := round(coalesce((v_alloc ->> 'amount')::numeric, 0), 2);
      if v_alloc_amount <= 0 then
        raise exception 'Each allocation must be greater than zero.';
      end if;
      if v_alloc_amount > v_remaining then
        raise exception 'The allocations add up to more than the payment.';
      end if;

      if p_party_type = 'customer' then
        v_doc_id := (v_alloc ->> 'invoice_id')::uuid;
        select total - amount_paid into v_outstanding from public.sales_invoices
        where id = v_doc_id and customer_id = p_party_id and status = 'posted' for update;
        if not found then
          raise exception 'Invoice not found for this customer.';
        end if;
        if v_alloc_amount > v_outstanding then
          raise exception 'Allocation is more than the amount outstanding on that invoice.';
        end if;

        insert into public.payment_allocations (payment_id, invoice_id, amount)
        values (v_id, v_doc_id, v_alloc_amount);

        update public.sales_invoices
        set amount_paid = amount_paid + v_alloc_amount,
            payment_status = case when amount_paid + v_alloc_amount >= total then 'paid' else 'partial' end
        where id = v_doc_id;
      else
        v_doc_id := (v_alloc ->> 'goods_receipt_id')::uuid;
        select total_received - amount_paid into v_outstanding from public.goods_receipts
        where id = v_doc_id and supplier_id = p_party_id for update;
        if not found then
          raise exception 'Goods receipt not found for this supplier.';
        end if;
        if v_alloc_amount > v_outstanding then
          raise exception 'Allocation is more than the amount outstanding on that receipt.';
        end if;

        insert into public.payment_allocations (payment_id, goods_receipt_id, amount)
        values (v_id, v_doc_id, v_alloc_amount);

        update public.goods_receipts
        set amount_paid = amount_paid + v_alloc_amount,
            payment_status = case when amount_paid + v_alloc_amount >= total_received then 'paid' else 'partial' end
        where id = v_doc_id;
      end if;

      v_remaining := v_remaining - v_alloc_amount;
      v_allocated := v_allocated + v_alloc_amount;
    end loop;
  else
    -- Automatic: oldest document first.
    if p_party_type = 'customer' then
      for v_open in
        select id, total - amount_paid as outstanding from public.sales_invoices
        where customer_id = p_party_id and status = 'posted' and amount_paid < total
        order by invoice_date, created_at
        for update
      loop
        exit when v_remaining <= 0;
        v_alloc_amount := least(v_remaining, v_open.outstanding);
        insert into public.payment_allocations (payment_id, invoice_id, amount)
        values (v_id, v_open.id, v_alloc_amount);
        update public.sales_invoices
        set amount_paid = amount_paid + v_alloc_amount,
            payment_status = case when amount_paid + v_alloc_amount >= total then 'paid' else 'partial' end
        where id = v_open.id;
        v_remaining := v_remaining - v_alloc_amount;
        v_allocated := v_allocated + v_alloc_amount;
      end loop;
    else
      for v_open in
        select id, total_received - amount_paid as outstanding from public.goods_receipts
        where supplier_id = p_party_id and amount_paid < total_received
        order by received_date, created_at
        for update
      loop
        exit when v_remaining <= 0;
        v_alloc_amount := least(v_remaining, v_open.outstanding);
        insert into public.payment_allocations (payment_id, goods_receipt_id, amount)
        values (v_id, v_open.id, v_alloc_amount);
        update public.goods_receipts
        set amount_paid = amount_paid + v_alloc_amount,
            payment_status = case when amount_paid + v_alloc_amount >= total_received then 'paid' else 'partial' end
        where id = v_open.id;
        v_remaining := v_remaining - v_alloc_amount;
        v_allocated := v_allocated + v_alloc_amount;
      end loop;
    end if;
  end if;

  return query select v_id, v_number, v_allocated, v_remaining;
end;
$$;

/** Documents still owing, for the allocation picker. */
create or replace function public.open_documents(p_party_type text, p_party_id uuid)
returns table (
  document_id uuid,
  document_number text,
  document_date date,
  total numeric,
  amount_paid numeric,
  outstanding numeric
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if public.current_staff_role() not in ('owner', 'manager', 'accountant') then
    raise exception 'Your role is not allowed to view open documents.' using errcode = '42501';
  end if;

  if p_party_type = 'customer' then
    return query
    select si.id, si.invoice_number, si.invoice_date, si.total, si.amount_paid,
           si.total - si.amount_paid
    from public.sales_invoices si
    where si.customer_id = p_party_id and si.status = 'posted' and si.amount_paid < si.total
    order by si.invoice_date, si.created_at;
  elsif p_party_type = 'supplier' then
    return query
    select gr.id, gr.grn_number, gr.received_date, gr.total_received, gr.amount_paid,
           gr.total_received - gr.amount_paid
    from public.goods_receipts gr
    where gr.supplier_id = p_party_id and gr.amount_paid < gr.total_received
    order by gr.received_date, gr.created_at;
  else
    raise exception 'Party must be a customer or a supplier.';
  end if;
end;
$$;

revoke all on function public.record_payment(text, uuid, text, numeric, text, date, text, text, jsonb) from public, anon;
revoke all on function public.open_documents(text, uuid) from public, anon;
grant execute on function public.record_payment(text, uuid, text, numeric, text, date, text, text, jsonb) to authenticated, service_role;
grant execute on function public.open_documents(text, uuid) to authenticated, service_role;
