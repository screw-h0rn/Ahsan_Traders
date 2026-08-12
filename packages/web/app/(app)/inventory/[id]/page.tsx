import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, cn } from '@at/ui';
import { can, getStaffProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { AdjustmentForm } from '../adjustment-form';
export default async function InventoryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const caller = await getStaffProfile();
  if (!caller) redirect('/login');
  if (!can(caller, 'inventory.view')) redirect('/dashboard');
  const supabase = await createClient();
  const [{ data: product }, { data: branches }, { data: stock }, { data: movements }] =
    await Promise.all([
      supabase.from('products').select('id,name,sku,unit').eq('id', id).maybeSingle(),
      supabase.from('branches').select('id,name').eq('status', 'active').order('name'),
      supabase
        .from('inventory')
        .select('branch_id,quantity,reorder_threshold,branches(name)')
        .eq('product_id', id),
      supabase
        .from('stock_movements')
        .select(
          'id,branch_id,quantity_delta,balance_after,movement_type,notes,created_at,branches(name)',
        )
        .eq('product_id', id)
        .order('created_at', { ascending: false })
        .limit(50),
    ]);
  if (!product) notFound();
  const first = stock?.[0];
  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/inventory" className="text-sm text-brand-600 hover:underline">
          ← Inventory
        </Link>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">{product.name}</h1>
        <p className="text-slate-500">
          {product.sku} · stock measured in {product.unit}
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {(branches ?? []).map((branch) => {
          const row = stock?.find((s) => s.branch_id === branch.id);
          const quantity = row?.quantity ?? 0;
          const threshold = row?.reorder_threshold ?? 0;
          const low = threshold > 0 && quantity <= threshold;
          return (
            <Card key={branch.id}>
              <CardHeader>
                <CardTitle>{branch.name}</CardTitle>
                <CardDescription>Current on-hand balance</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">
                  {quantity} {product.unit}
                </p>
                <span
                  className={cn(
                    'mt-2 inline-block rounded-md px-2 py-0.5 text-xs',
                    low ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-700',
                  )}
                >
                  {low ? `Low stock · reorder at ${threshold}` : 'In stock'}
                </span>
              </CardContent>
            </Card>
          );
        })}
      </div>
      {can(caller, 'inventory.adjust') && (
        <AdjustmentForm
          productId={product.id}
          branches={branches ?? []}
          currentThreshold={first?.reorder_threshold ?? 0}
        />
      )}
      <Card>
        <CardHeader>
          <CardTitle>Stock movements</CardTitle>
          <CardDescription>Append-only history of every quantity change</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {!movements?.length ? (
            <p className="px-5 pb-5 text-sm text-slate-500">No stock movements yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                  <th className="px-5 py-3">When</th>
                  <th className="px-5 py-3">Branch</th>
                  <th className="px-5 py-3">Type</th>
                  <th className="px-5 py-3 text-right">Change</th>
                  <th className="px-5 py-3 text-right">Balance</th>
                  <th className="px-5 py-3">Notes</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((m) => (
                  <tr key={m.id} className="border-b border-slate-100">
                    <td className="px-5 py-3">{new Date(m.created_at).toLocaleString('en-PK')}</td>
                    <td className="px-5 py-3">{m.branches?.name ?? '—'}</td>
                    <td className="px-5 py-3">{m.movement_type}</td>
                    <td
                      className={cn(
                        'px-5 py-3 text-right font-medium',
                        m.quantity_delta > 0 ? 'text-emerald-700' : 'text-red-700',
                      )}
                    >
                      {m.quantity_delta > 0 ? '+' : ''}
                      {m.quantity_delta}
                    </td>
                    <td className="px-5 py-3 text-right">{m.balance_after}</td>
                    <td className="px-5 py-3 text-slate-500">{m.notes ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
