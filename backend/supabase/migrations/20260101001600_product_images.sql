-- ============================================================================
-- 16 · Product images.
--
-- Many of the shop owners ordering through the mobile app are more
-- comfortable recognising a product by its picture than reading its name off
-- a list, so a photo is not a cosmetic extra here — it is how a meaningful
-- share of customers will actually choose what to order. The catalogue must
-- carry an image on every product and expose it to both the web portal and
-- the mobile app through the same field.
--
-- STORAGE MODEL
--
-- A single public bucket, `product-images`. Public, not signed-URL private,
-- because:
--   - product photos are marketing material, not sensitive business data
--     (unlike invoices, which stay private and go through signed access);
--   - a public URL can be cached by the CDN and by the mobile app's image
--     cache indefinitely, which matters on the patchy connections these
--     stores often have;
--   - signed URLs expire and would need refreshing in a customer's order
--     history and cart — needless complexity for a plain product photo.
--
-- Anyone can READ an image (it is going to be shown to a customer browsing
-- the shop anyway). Only staff may upload, replace or delete one.
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images', 'product-images', true,
  5 * 1024 * 1024, -- 5 MB
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = true,
      file_size_limit = 5 * 1024 * 1024,
      allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

-- storage.objects already has RLS enabled by Supabase; add policies scoped to
-- this bucket only.
drop policy if exists product_images_public_read on storage.objects;
create policy product_images_public_read on storage.objects
  for select
  using (bucket_id = 'product-images');

drop policy if exists product_images_staff_write on storage.objects;
create policy product_images_staff_write on storage.objects
  for insert to authenticated
  with check (bucket_id = 'product-images' and public.staff_has_role('owner', 'manager'));

drop policy if exists product_images_staff_update on storage.objects;
create policy product_images_staff_update on storage.objects
  for update to authenticated
  using (bucket_id = 'product-images' and public.staff_has_role('owner', 'manager'))
  with check (bucket_id = 'product-images' and public.staff_has_role('owner', 'manager'));

drop policy if exists product_images_staff_delete on storage.objects;
create policy product_images_staff_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'product-images' and public.staff_has_role('owner', 'manager'));

-- ---------------------------------------------------------------------------
-- products.image_path — the object path inside the bucket, e.g.
-- "a1b2c3d4-.../cover.webp". The full public URL is assembled on the client
-- from NEXT_PUBLIC_SUPABASE_URL, never stored, so it survives a project move.
-- ---------------------------------------------------------------------------
alter table public.products
  add column image_path text;

comment on column public.products.image_path is
  'Path inside the product-images storage bucket. NULL = no photo yet. Build the URL with storage.getPublicUrl().';

-- ---------------------------------------------------------------------------
-- customer_catalog(): add the image so the shop app can show it.
-- ---------------------------------------------------------------------------
drop function if exists public.customer_catalog(text, uuid, integer, integer);
create function public.customer_catalog(
  p_search text default null,
  p_category_id uuid default null,
  p_limit integer default 200,
  p_offset integer default 0
)
returns table (
  product_id uuid,
  name text,
  variant_label text,
  sku text,
  barcode text,
  category_id uuid,
  category_name text,
  unit text,
  units_per_carton integer,
  unit_price numeric,
  carton_price numeric,
  in_stock boolean,
  image_path text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_search text := nullif(trim(coalesce(p_search, '')), '');
begin
  perform public.require_customer();

  return query
  select p.id, p.name, p.variant_label, p.sku, p.barcode,
         p.category_id, cat.name,
         p.unit, p.units_per_carton,
         p.sale_price,
         coalesce(p.carton_sale_price, p.sale_price * p.units_per_carton),
         public.product_on_hand(p.id) > 0,
         p.image_path
  from public.products p
  left join public.categories cat on cat.id = p.category_id
  where p.status = 'active'
    and p.is_public
    and (p_category_id is null or p.category_id = p_category_id)
    and (
      v_search is null
      or p.name ilike '%' || v_search || '%'
      or p.sku ilike '%' || v_search || '%'
      or p.barcode = v_search
    )
  order by p.name
  limit greatest(least(coalesce(p_limit, 200), 500), 1)
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

revoke execute on function public.customer_catalog(text, uuid, integer, integer) from public, anon;
grant execute on function public.customer_catalog(text, uuid, integer, integer) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- field_app_bootstrap(): the field rep also benefits from seeing a photo when
-- booking an order face to face with a shopkeeper.
-- ---------------------------------------------------------------------------
create or replace function public.field_app_bootstrap(p_branch_id uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_role text := public.current_staff_role();
  v_branch uuid;
begin
  if v_role is null or v_role not in ('owner', 'manager', 'sales', 'accountant') then
    raise exception 'Your role cannot use the field app.' using errcode = '42501';
  end if;

  v_branch := coalesce(
    p_branch_id,
    (select id from public.branches where status = 'active' order by is_default desc, name limit 1)
  );

  return jsonb_build_object(
    'branch_id', v_branch,
    'company', (select to_jsonb(cs) - 'id' from public.company_settings cs where cs.id),
    'branches', (select coalesce(jsonb_agg(jsonb_build_object('id', b.id, 'name', b.name, 'type', b.type)), '[]'::jsonb)
                 from public.branches b where b.status = 'active'),
    'customers', (select coalesce(jsonb_agg(jsonb_build_object(
                    'id', c.id, 'name', c.name, 'phone', c.phone,
                    'balance', public.customer_balance(c.id),
                    'credit_limit', c.credit_limit,
                    'available_credit', public.customer_available_credit(c.id))), '[]'::jsonb)
                  from public.customers c where c.status = 'active'),
    'products', (select coalesce(jsonb_agg(jsonb_build_object(
                    'id', p.id, 'name', p.name, 'sku', p.sku, 'barcode', p.barcode,
                    'variant_label', p.variant_label, 'unit', p.unit,
                    'units_per_carton', p.units_per_carton,
                    'unit_price', p.sale_price,
                    'carton_price', coalesce(p.carton_sale_price, p.sale_price * p.units_per_carton),
                    'image_path', p.image_path,
                    'quantity', coalesce((select i.quantity from public.inventory i
                                          where i.product_id = p.id and i.branch_id = v_branch), 0))), '[]'::jsonb)
                 from public.products p where p.status = 'active'),
    'cached_at', now()
  );
end;
$$;
