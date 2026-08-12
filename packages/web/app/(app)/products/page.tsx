import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, cn } from '@at/ui';
import { can, getStaffProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { formatMoney } from '@/lib/format';
import { productImageUrl } from '@/lib/product-image';
import { SearchInput } from '@/components/search-input';
import { ProductForm } from './product-form';
type ProductRow = {
  id: string;
  name: string;
  sku: string;
  unit: string;
  purchase_price: number;
  sale_price: number;
  units_per_carton: number;
  parent_product_id: string | null;
  variant_label: string | null;
  status: 'active' | 'archived';
  image_path: string | null;
  categories: { name: string } | null;
};
export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const caller = await getStaffProfile();
  if (!caller) redirect('/login');
  if (!can(caller, 'catalog.view')) redirect('/dashboard');
  const supabase = await createClient();
  const [{ data: products }, { data: categories }, { data: tenant }] = await Promise.all([
    supabase
      .from('products')
      .select(
        'id,name,sku,unit,purchase_price,sale_price,units_per_carton,parent_product_id,variant_label,status,image_path,categories(name)',
      )
      .order('created_at', { ascending: false }),
    supabase.from('categories').select('id,name').eq('status', 'active').order('name'),
    supabase.from('company_settings').select('currency').single(),
  ]);
  const all = (products ?? []) as ProductRow[];
  const term = q?.trim().toLowerCase() ?? '';
  const matches = (p: ProductRow) =>
    !term ||
    p.name.toLowerCase().includes(term) ||
    p.sku.toLowerCase().includes(term) ||
    (p.variant_label?.toLowerCase().includes(term) ?? false);
  const variantsByParent = new Map<string, ProductRow[]>();
  for (const p of all) {
    if (!p.parent_product_id) continue;
    const group = variantsByParent.get(p.parent_product_id) ?? [];
    group.push(p);
    variantsByParent.set(p.parent_product_id, group);
  }
  const rows: { product: ProductRow; isVariant: boolean }[] = [];
  for (const p of all) {
    if (p.parent_product_id) continue;
    const variants = variantsByParent.get(p.id) ?? [];
    const parentMatches = matches(p);
    const matchingVariants = parentMatches ? variants : variants.filter(matches);
    if (!parentMatches && matchingVariants.length === 0) continue;
    rows.push({ product: p, isVariant: false });
    for (const v of matchingVariants) rows.push({ product: v, isVariant: true });
  }
  const count = rows.length;
  const currency = tenant?.currency ?? 'PKR';
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Products</h1>
        <p className="text-slate-500">Your sellable inventory catalog.</p>
      </div>
      {can(caller, 'catalog.manage') && <ProductForm categories={categories ?? []} />}
      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-1">
            <CardTitle>All products</CardTitle>
            <CardDescription>
              {count} product{count === 1 ? '' : 's'}
              {q?.trim() ? ` matching “${q.trim()}”` : ''}
            </CardDescription>
          </div>
          <SearchInput placeholder="Search name or SKU…" defaultValue={q} />
        </CardHeader>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <p className="px-5 pb-5 text-sm text-slate-500">
              {q?.trim()
                ? `No products match “${q.trim()}”.`
                : 'No products yet. Add your first catalog item.'}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-5 py-3">Photo</th>
                    <th className="px-5 py-3">Product</th>
                    <th className="px-5 py-3">SKU</th>
                    <th className="px-5 py-3">Category</th>
                    <th className="px-5 py-3">Pack</th>
                    <th className="px-5 py-3 text-right">Purchase</th>
                    <th className="px-5 py-3 text-right">Sale</th>
                    <th className="px-5 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ product: p, isVariant }) => (
                    <tr key={p.id} className="border-b border-slate-100 last:border-0">
                      <td className="px-5 py-3">
                        <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-md border border-slate-200 bg-slate-50">
                          {p.image_path ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={productImageUrl(p.image_path) ?? undefined}
                              alt={p.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <span className="text-[10px] text-slate-300">—</span>
                          )}
                        </div>
                      </td>
                      <td className={cn('px-5 py-3', isVariant && 'pl-10')}>
                        <Link
                          href={`/products/${p.id}`}
                          className={cn(
                            'font-medium text-brand-700 hover:underline',
                            isVariant && 'font-normal',
                          )}
                        >
                          {isVariant ? (
                            <>
                              <span className="mr-1 text-slate-400">↳</span>
                              {p.name} — {p.variant_label}
                            </>
                          ) : (
                            p.name
                          )}
                        </Link>
                        <span className="ml-2 text-xs text-slate-400">/{p.unit}</span>
                      </td>
                      <td className="px-5 py-3">{p.sku}</td>
                      <td className="px-5 py-3">{p.categories?.name ?? '—'}</td>
                      <td className="px-5 py-3">
                        {p.units_per_carton > 1 ? `${p.units_per_carton} / ctn` : '—'}
                      </td>
                      <td className="px-5 py-3 text-right">
                        {formatMoney(p.purchase_price, currency)}
                      </td>
                      <td className="px-5 py-3 text-right">
                        {formatMoney(p.sale_price, currency)}
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={cn(
                            'rounded-md px-2 py-0.5 text-xs',
                            p.status === 'active'
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-slate-200 text-slate-600',
                          )}
                        >
                          {p.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
