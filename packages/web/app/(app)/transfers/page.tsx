import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, cn } from '@at/ui';
import { createClient } from '@/lib/supabase/server';
import { can, getStaffProfile } from '@/lib/auth';
import { formatDate } from '@/lib/format';
import { TransferForm } from './transfer-form';

const statusStyles: Record<string, string> = {
  in_transit: 'bg-amber-100 text-amber-800',
  received: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-slate-200 text-slate-600',
};

export default async function TransfersPage() {
  const caller = await getStaffProfile();
  if (!caller) redirect('/login');
  if (!can(caller, 'inventory.view')) redirect('/dashboard');

  const supabase = await createClient();
  const [{ data: transfers }, { data: branches }, { data: products }] = await Promise.all([
    supabase
      .from('stock_transfers')
      .select(
        'id, transfer_number, status, created_at, notes, from_branch:branches!stock_transfers_from_branch_id_fkey(name), to_branch:branches!stock_transfers_to_branch_id_fkey(name), stock_transfer_items(quantity)',
      )
      .order('created_at', { ascending: false })
      .limit(100),
    supabase.from('branches').select('id,name').eq('status', 'active').order('created_at'),
    supabase.from('products').select('id,name,sku').eq('status', 'active').order('name'),
  ]);

  const list = transfers ?? [];
  const canManage = can(caller, 'inventory.adjust');

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Stock transfers</h1>
        <p className="text-slate-500">
          Move stock between branches — quantities stay accounted for while in transit.
        </p>
      </div>

      {canManage && (branches?.length ?? 0) >= 2 && (
        <TransferForm branches={branches ?? []} products={products ?? []} />
      )}
      {canManage && (branches?.length ?? 0) < 2 && (
        <Card>
          <CardContent className="pt-6 text-sm text-slate-500">
            You need at least two active branches to transfer stock.{' '}
            {can(caller, 'branches.manage') && (
              <Link href="/branches" className="font-medium text-brand-700 hover:underline">
                Add a branch →
              </Link>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>All transfers</CardTitle>
          <CardDescription>
            {list.length} transfer{list.length === 1 ? '' : 's'}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {list.length === 0 ? (
            <p className="px-5 pb-5 text-sm text-slate-500">
              No transfers yet. Stock moved between branches shows up here.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-3 font-medium">Transfer</th>
                  <th className="px-5 py-3 font-medium">Route</th>
                  <th className="px-5 py-3 font-medium text-right">Lines</th>
                  <th className="px-5 py-3 font-medium">Date</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {list.map((t) => (
                  <tr key={t.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                    <td className="px-5 py-3">
                      <Link
                        href={`/transfers/${t.id}`}
                        className="font-medium text-brand-700 hover:underline"
                      >
                        {t.transfer_number}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-slate-600">
                      {t.from_branch?.name} → {t.to_branch?.name}
                    </td>
                    <td className="px-5 py-3 text-right text-slate-600">
                      {t.stock_transfer_items?.length ?? 0}
                    </td>
                    <td className="px-5 py-3 text-slate-600">{formatDate(t.created_at)}</td>
                    <td className="px-5 py-3">
                      <span
                        className={cn(
                          'rounded-md px-2 py-0.5 text-xs font-medium',
                          statusStyles[t.status] ?? 'bg-slate-200 text-slate-600',
                        )}
                      >
                        {t.status.replace('_', ' ')}
                      </span>
                    </td>
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
