import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, cn } from '@at/ui';
import { can, getStaffProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { formatMoney } from '@/lib/format';
import { productImageUrl } from '@/lib/product-image';
import { ProductEditForm } from './edit-form';
import { ProductImageUpload } from './image-upload';
import { VariantForm } from './variant-form';
export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const caller = await getStaffProfile();
  if (!caller) redirect('/login');
  if (!can(caller, 'catalog.view')) redirect('/dashboard');
  const supabase = await createClient();
  const [{ data: product }, { data: categories }, { data: tenant }] = await Promise.all([
    supabase
      .from('products')
      .select(
        'id,name,sku,barcode,unit,category_id,purchase_price,sale_price,units_per_carton,carton_sale_price,parent_product_id,variant_label,status,image_path,categories(name)',
      )
      .eq('id', id)
      .maybeSingle(),
    supabase.from('categories').select('id,name').eq('status', 'active').order('name'),
    supabase.from('company_settings').select('currency').single(),
  ]);
  if (!product) notFound();
  const currency = tenant?.currency ?? 'PKR';
  const isParent = !product.parent_product_id;
  const [{ data: variants }, { data: parent }] = await Promise.all([
    isParent
      ? supabase
          .from('products')
          .select('id,sku,variant_label,sale_price,carton_sale_price,units_per_carton,status')
          .eq('parent_product_id', product.id)
          .order('variant_label')
      : Promise.resolve({ data: null }),
    product.parent_product_id
      ? supabase
          .from('products')
          .select('id,name')
          .eq('id', product.parent_product_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/products" className="text-sm text-brand-600 hover:underline">
          ← Products
        </Link>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">
          {product.variant_label ? `${product.name} — ${product.variant_label}` : product.name}
        </h1>
        <p className="text-slate-500">
          {product.sku} · {product.categories?.name ?? 'Uncategorized'} · {product.status}
        </p>
        {parent && (
          <p className="mt-1 text-sm text-slate-500">
            Variant of {parent.name} —{' '}
            <Link href={`/products/${parent.id}`} className="text-brand-600 hover:underline">
              view parent
            </Link>
          </p>
        )}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Photo</CardTitle>
          <CardDescription>
            Shown to customers browsing the catalogue in the mobile app — many recognise a
            product by its picture faster than by its name.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {can(caller, 'catalog.manage') ? (
            <ProductImageUpload
              productId={product.id}
              imageUrl={productImageUrl(product.image_path)}
              productName={product.name}
            />
          ) : product.image_path ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={productImageUrl(product.image_path) ?? undefined}
              alt={product.name}
              className="h-24 w-24 rounded-lg border border-slate-200 object-cover"
            />
          ) : (
            <p className="text-sm text-slate-500">No photo uploaded.</p>
          )}
        </CardContent>
      </Card>
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Purchase price</CardTitle>
            <CardDescription>Cost per {product.unit}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{formatMoney(product.purchase_price, currency)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Sale price</CardTitle>
            <CardDescription>Selling price per {product.unit}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{formatMoney(product.sale_price, currency)}</p>
          </CardContent>
        </Card>
      </div>
      {can(caller, 'catalog.manage') && (
        <ProductEditForm product={product} categories={categories ?? []} />
      )}
      {isParent && (
        <Card>
          <CardHeader>
            <CardTitle>Variants</CardTitle>
            <CardDescription>
              Size or packaging variants sold under this product.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {(variants ?? []).length === 0 ? (
              <p className="text-sm text-slate-500">No variants yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                      <th className="py-2 pr-4">Variant</th>
                      <th className="py-2 pr-4">SKU</th>
                      <th className="py-2 pr-4 text-right">Unit price</th>
                      <th className="py-2 pr-4 text-right">Carton price</th>
                      <th className="py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(variants ?? []).map((v) => (
                      <tr key={v.id} className="border-b border-slate-100 last:border-0">
                        <td className="py-2 pr-4">
                          <Link
                            href={`/products/${v.id}`}
                            className="font-medium text-brand-700 hover:underline"
                          >
                            {v.variant_label}
                          </Link>
                        </td>
                        <td className="py-2 pr-4">{v.sku}</td>
                        <td className="py-2 pr-4 text-right">
                          {formatMoney(v.sale_price, currency)}
                        </td>
                        <td className="py-2 pr-4 text-right">
                          {v.units_per_carton > 1
                            ? formatMoney(
                                v.carton_sale_price ?? v.units_per_carton * v.sale_price,
                                currency,
                              )
                            : '—'}
                        </td>
                        <td className="py-2">
                          <span
                            className={cn(
                              'rounded-md px-2 py-0.5 text-xs',
                              v.status === 'active'
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-slate-200 text-slate-600',
                            )}
                          >
                            {v.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {can(caller, 'catalog.manage') && (
              <VariantForm
                parentId={product.id}
                defaults={{
                  purchase_price: product.purchase_price,
                  sale_price: product.sale_price,
                  carton_sale_price: product.carton_sale_price,
                  units_per_carton: product.units_per_carton,
                  unit: product.unit,
                }}
              />
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
