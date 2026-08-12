-- ============================================================================
-- 17 · Customer self-signup with owner approval.
--
-- A shopkeeper installs the app and registers with their phone number, shop
-- name, city and a password they choose — no SMS/OTP provider required. Two
-- outcomes, exactly as before, but now the pending case carries what they
-- typed so the owner has something to verify against:
--
--   * their phone matches a customer already on file  -> linked instantly
--   * it does not                                      -> pending, and the
--     owner sees their claimed shop name/phone/city and either creates a new
--     customer from those details or links them to an existing one
-- ============================================================================

alter table public.customer_accounts
  add column requested_shop_name text,
  add column requested_city text;

comment on column public.customer_accounts.requested_shop_name is
  'What the signer-up typed as their shop name. Not trusted data — shown to the owner to verify before approval.';
comment on column public.customer_accounts.requested_city is
  'What the signer-up typed as their city/area. Same caveat as requested_shop_name.';

-- ---------------------------------------------------------------------------
-- handle_new_user(): capture shop_name / city at signup.
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
  v_shop_name    text;
  v_city         text;
  v_role         text;
  v_customer_id  uuid;
  v_match_count  int;
begin
  v_account_type := coalesce(nullif(trim(new.raw_user_meta_data ->> 'account_type'), ''), '');
  v_full_name    := coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), new.email, new.phone, 'User');
  v_phone        := coalesce(new.phone, nullif(trim(new.raw_user_meta_data ->> 'phone'), ''));
  v_phone_norm   := public.normalize_phone(v_phone);
  v_shop_name    := nullif(trim(new.raw_user_meta_data ->> 'shop_name'), '');
  v_city         := nullif(trim(new.raw_user_meta_data ->> 'city'), '');

  if v_account_type = 'customer' or (v_account_type = '' and new.email is null and v_phone is not null) then
    select count(*) into v_match_count
    from public.customers c
    where c.phone_norm = v_phone_norm and c.status = 'active';

    if v_match_count = 1 then
      select c.id into v_customer_id
      from public.customers c
      where c.phone_norm = v_phone_norm and c.status = 'active';
    end if;

    if v_match_count = 1 and not exists (
      select 1 from public.customer_accounts ca
      where ca.customer_id = v_customer_id and ca.status = 'active'
    ) then
      insert into public.customer_accounts (id, customer_id, phone, status, linked_at)
      values (new.id, v_customer_id, v_phone, 'active', now());
    else
      insert into public.customer_accounts (id, phone, status, requested_shop_name, requested_city)
      values (new.id, v_phone, 'pending', v_shop_name, v_city);
    end if;

    return new;
  end if;

  if not exists (select 1 from public.staff) then
    insert into public.staff (id, full_name, email, phone, role, status)
    values (new.id, v_full_name, new.email, v_phone, 'owner', 'active');
    return new;
  end if;

  if coalesce(nullif(trim(new.raw_user_meta_data ->> 'staff_invite'), ''), '') = 'true' then
    v_role := coalesce(nullif(trim(new.raw_user_meta_data ->> 'role'), ''), 'sales');
    if v_role not in ('manager', 'sales', 'warehouse', 'accountant') then
      v_role := 'sales';
    end if;

    insert into public.staff (id, full_name, email, phone, role, status)
    values (new.id, v_full_name, new.email, v_phone, v_role, 'active');
    return new;
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- approve_customer_signup(): the missing half of the workflow — create a
-- customer FROM the pending signup's own details (or supplied overrides) and
-- link in one transaction. link_customer_account() (existing customer) and
-- block_customer_account() are unchanged.
-- ---------------------------------------------------------------------------
create or replace function public.approve_customer_signup(
  p_account_id uuid,
  p_name text default null,
  p_phone text default null,
  p_address text default null,
  p_credit_limit numeric default null
)
returns table (customer_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text := public.current_staff_role();
  v_account public.customer_accounts%rowtype;
  v_name text;
  v_customer_id uuid;
begin
  if v_role is null or v_role not in ('owner', 'manager') then
    raise exception 'Only owners and managers can approve signups.' using errcode = '42501';
  end if;

  select * into v_account from public.customer_accounts where id = p_account_id for update;
  if not found then
    raise exception 'Signup not found.';
  end if;
  if v_account.status = 'active' then
    raise exception 'This login is already active.';
  end if;

  v_name := coalesce(nullif(trim(p_name), ''), v_account.requested_shop_name, 'New Customer');

  insert into public.customers (name, phone, address, credit_limit)
  values (
    v_name,
    coalesce(nullif(trim(p_phone), ''), v_account.phone),
    coalesce(nullif(trim(p_address), ''), v_account.requested_city),
    p_credit_limit
  )
  returning id into v_customer_id;

  update public.customer_accounts
  set customer_id = v_customer_id, status = 'active', linked_at = now(), linked_by = auth.uid()
  where id = p_account_id;

  return query select v_customer_id;
end;
$$;

revoke execute on function public.approve_customer_signup(uuid, text, text, text, numeric) from public, anon;
grant execute on function public.approve_customer_signup(uuid, text, text, text, numeric) to authenticated, service_role;
