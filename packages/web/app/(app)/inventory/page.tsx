import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, cn } from '@at/ui';
import { can, getStaffProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { BranchFilter } from './branch-filter';
function formatStock(quantity: number, unit: string, unitsPerCarton: number) {
  if (unitsPerCarton <= 1) return `${quantity} ${unit}`;
  const cartons = Math.floor(quantity / unitsPerCarton);
  const loose = quantity % unitsPerCarton;
  const parts: string[] = [];
  if (cartons > 0) parts.push(`${cartons} ctn`);
  if (loose > 0) parts.push(`${loose} ${unit}`);
  if (parts.length === 0) return `0 ${unit}`;
  return `${parts.join(' + ')} (${quantity} ${unit})`;
}
export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ branch?: string }>;
}) {
  const { branch: branchFilter } = await searchParams;
  const caller = await getStaffProfile();
  if (!caller) redirect('/login');
  if (!can(caller, 'inventory.view')) redirect('/dashboard');
  const supabase = await createClient();
  let stockQuery = supabase.from('inventory').select('product_id,branch_id,quantity,reorder_threshold');
  if (branchFilter) stockQuery = stockQuery.eq('branch_id', branchFilter);
  const [{ data: products }, { data: stock }, { data: branches }] = await Promise.all([
    supabase
      .from('products')
      .select('id,name,sku,unit,status,units_per_carton,variant_label')
      .order('name'),
    stockQuery,
    supabase.from('branches').select('id,name').eq('status', 'active').order('created_at'),
  ]);
  const totals = new Map<string, { quantity: number; threshold: number }>();
  for (const row of stock ?? []) {
    const current = totals.get(row.product_id) ?? { quantity: 0, threshold: 0 };
    current.quantity += row.quantity;
    current.threshold += row.reorder_threshold;
    totals.set(row.product_id, current);
  }
  const activeBranch = branches?.find((b) => b.id === branchFilter);
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Inventory</h1>
          <p className="text-slate-500">
            {activeBranch
              ? `On-hand stock at ${activeBranch.name}.`
              : `On-hand stock across ${branches?.length ?? 0} active branch${
                  branches?.length === 1 ? '' : 'es'
                }.`}
          </p>
        </div>
        {can(caller, 'branches.manage') && (
          <Link href="/branches" className="text-sm font-medium text-brand-700 hover:underline">
            Manage branches →
          </Link>
        )}
      </div>
      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-1">
            <CardTitle>Stock levels</CardTitle>
            <CardDescription>{products?.length ?? 0} catalog products</CardDescription>
          </div>
          <BranchFilter branches={branches ?? []} value={branchFilter} />
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                <th className="px-5 py-3">Product</th>
                <th className="px-5 py-3">SKU</th>
                <th className="px-5 py-3 text-right">On hand</th>
                <th className="px-5 py-3 text-right">Reorder at</th>
                <th className="px-5 py-3">State</th>
              </tr>
            </thead>
            <tbody>
              {(products ?? []).map((p) => {
                const s = totals.get(p.id) ?? { quantity: 0, threshold: 0 };
                const low = s.threshold > 0 && s.quantity <= s.threshold;
                return (
                  <tr key={p.id} className="border-b border-slate-100">
                    <td className="px-5 py-3">
                      <Link
                        href={`/inventory/${p.id}`}
                        className="font-medium text-brand-700 hover:underline"
                      >
                        {p.variant_label ? `${p.name} — ${p.variant_label}` : p.name}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-slate-600">{p.sku}</td>
                    <td className="px-5 py-3 text-right font-medium">
                      {formatStock(s.quantity, p.unit, p.units_per_carton)}
                    </td>
                    <td className="px-5 py-3 text-right">{s.threshold || '—'}</td>
                    <td className="px-5 py-3">
                      <span
                        className={cn(
                          'rounded-md px-2 py-0.5 text-xs',
                          low ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-700',
                        )}
                      >
                        {low ? 'Low stock' : 'In stock'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
