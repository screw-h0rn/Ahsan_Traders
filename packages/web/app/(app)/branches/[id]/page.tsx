import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@at/ui';
import { createClient } from '@/lib/supabase/server';
import { can, getStaffProfile } from '@/lib/auth';
import { BranchEditForm, type BranchRecord } from './edit-form';

export default async function BranchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const caller = await getStaffProfile();
  if (!caller) redirect('/login');
  if (!can(caller, 'branches.manage')) redirect('/dashboard');

  const supabase = await createClient();
  const [{ data: branch }, { data: stockRows }] = await Promise.all([
    supabase.from('branches').select('id, name, type, status').eq('id', id).maybeSingle(),
    supabase
      .from('inventory')
      .select('quantity, products(name, sku, unit)')
      .eq('branch_id', id)
      .gt('quantity', 0)
      .order('quantity', { ascending: false })
      .limit(50),
  ]);

  if (!branch) notFound();
  const stocked = stockRows ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/branches" className="text-sm text-brand-600 hover:underline">
          ← Branches
        </Link>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{branch.name}</h1>
        <p className="capitalize text-slate-500">{branch.type}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Stock at this location</CardTitle>
          <CardDescription>
            {stocked.length} product{stocked.length === 1 ? '' : 's'} on hand
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {stocked.length === 0 ? (
            <p className="px-5 pb-5 text-sm text-slate-500">
              No stock held here yet. Receive a purchase or adjust stock into this location.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-3 font-medium">Product</th>
                  <th className="px-5 py-3 font-medium">SKU</th>
                  <th className="px-5 py-3 font-medium text-right">On hand</th>
                </tr>
              </thead>
              <tbody>
                {stocked.map((row, i) => (
                  <tr key={i} className="border-b border-slate-100 last:border-0">
                    <td className="px-5 py-3 font-medium text-slate-900">
                      {row.products?.name ?? '—'}
                    </td>
                    <td className="px-5 py-3 text-slate-600">{row.products?.sku ?? '—'}</td>
                    <td className="px-5 py-3 text-right">
                      {row.quantity} {row.products?.unit ?? ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <BranchEditForm branch={branch as BranchRecord} />
    </div>
  );
}
