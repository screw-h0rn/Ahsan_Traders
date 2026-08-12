import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, cn } from '@at/ui';
import { createClient } from '@/lib/supabase/server';
import { can, getStaffProfile } from '@/lib/auth';
import { formatDate } from '@/lib/format';
import { TransferActions } from './transfer-actions';

const statusStyles: Record<string, string> = {
  in_transit: 'bg-amber-100 text-amber-800',
  received: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-slate-200 text-slate-600',
};

export default async function TransferDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const caller = await getStaffProfile();
  if (!caller) redirect('/login');
  if (!can(caller, 'inventory.view')) redirect('/dashboard');

  const supabase = await createClient();
  const { data: transfer } = await supabase
    .from('stock_transfers')
    .select(
      'id, transfer_number, status, notes, created_at, received_at, from_branch:branches!stock_transfers_from_branch_id_fkey(name), to_branch:branches!stock_transfers_to_branch_id_fkey(name), stock_transfer_items(quantity, products(name, sku, unit))',
    )
    .eq('id', id)
    .maybeSingle();

  if (!transfer) notFound();
  const items = transfer.stock_transfer_items ?? [];
  const canManage = can(caller, 'inventory.adjust');

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/transfers" className="text-sm text-brand-600 hover:underline">
            ← Transfers
          </Link>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            {transfer.transfer_number}
          </h1>
          <p className="text-slate-500">
            {transfer.from_branch?.name} → {transfer.to_branch?.name} ·{' '}
            {formatDate(transfer.created_at)}
            {transfer.received_at ? ` · received ${formatDate(transfer.received_at)}` : ''}
          </p>
        </div>
        <span
          className={cn(
            'rounded-md px-2.5 py-1 text-xs font-semibold uppercase tracking-wide',
            statusStyles[transfer.status] ?? 'bg-slate-200 text-slate-600',
          )}
        >
          {transfer.status.replace('_', ' ')}
        </span>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Items</CardTitle>
          <CardDescription>
            {items.length} line{items.length === 1 ? '' : 's'}
            {transfer.notes ? ` · ${transfer.notes}` : ''}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-5 py-3 font-medium">Product</th>
                <th className="px-5 py-3 font-medium">SKU</th>
                <th className="px-5 py-3 font-medium text-right">Quantity</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={i} className="border-b border-slate-100 last:border-0">
                  <td className="px-5 py-3 font-medium text-slate-900">
                    {item.products?.name ?? '—'}
                  </td>
                  <td className="px-5 py-3 text-slate-600">{item.products?.sku ?? '—'}</td>
                  <td className="px-5 py-3 text-right">
                    {item.quantity} {item.products?.unit ?? ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {canManage && transfer.status === 'in_transit' && (
        <Card>
          <CardHeader>
            <CardTitle>In transit</CardTitle>
            <CardDescription>
              Confirm receipt to add this stock at {transfer.to_branch?.name}, or cancel
              to return it to {transfer.from_branch?.name}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TransferActions transferId={transfer.id} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
