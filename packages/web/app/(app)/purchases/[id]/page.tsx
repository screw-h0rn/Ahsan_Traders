import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@at/ui';
import { can, getStaffProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { formatDate, formatLineQuantity, formatMoney, productLabel } from '@/lib/format';
import { IssueForm } from './issue-form';
import { ReceiveForm } from './receive-form';

export default async function PurchaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const caller = await getStaffProfile();
  if (!caller) redirect('/login');
  if (!can(caller, 'purchases.view')) redirect('/dashboard');
  const supabase = await createClient();
  const [{ data: order }, { data: items }, { data: tenant }] = await Promise.all([
    supabase
      .from('purchase_orders')
      .select(
        'id,po_number,order_date,expected_date,status,subtotal,total,notes,suppliers(name),branches(name)',
      )
      .eq('id', id)
      .maybeSingle(),
    supabase
      .from('purchase_order_items')
      .select('id,quantity,uom,qty_entered,received_quantity,unit_price,line_total,products(name,sku,unit,variant_label,units_per_carton)')
      .eq('purchase_order_id', id),
    supabase.from('company_settings').select('currency').single(),
  ]);
  if (!order) notFound();
  const { data: receipts } = await supabase
    .from('goods_receipts')
    .select('id,grn_number,received_date,total_received,notes,created_at')
    .eq('purchase_order_id', id)
    .order('created_at', { ascending: false });
  const currency = tenant?.currency ?? 'PKR';
  const purchaseItems = (items ?? []).map((item) => ({
    ...item,
    remaining_quantity: item.quantity - item.received_quantity,
  }));
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div>
          <Link href="/purchases" className="text-sm text-brand-600 hover:underline">
            ← Purchase orders
          </Link>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">{order.po_number}</h1>
          <p className="text-slate-500">
            {order.suppliers?.name} · {order.branches?.name} · {formatDate(order.order_date)}
          </p>
        </div>
        {order.status === 'draft' && can(caller, 'purchases.manage') && <IssueForm id={order.id} />}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Order lines</CardTitle>
          <CardDescription>
            {order.status} · expected{' '}
            {order.expected_date ? formatDate(order.expected_date) : 'not set'}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                <th className="px-5 py-3">Product</th>
                <th className="px-5 py-3 text-right">Quantity</th>
                <th className="px-5 py-3 text-right">Unit price</th>
                <th className="px-5 py-3 text-right">Line total</th>
              </tr>
            </thead>
            <tbody>
              {(items ?? []).map((item) => (
                <tr key={item.id} className="border-b border-slate-100">
                  <td className="px-5 py-3">
                    <span className="font-medium">
                      {productLabel(item.products?.name, item.products?.variant_label)}
                    </span>
                    <span className="ml-2 text-xs text-slate-400">{item.products?.sku}</span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    {formatLineQuantity({
                      uom: item.uom,
                      qty_entered: item.qty_entered,
                      quantity: item.quantity,
                      unit: item.products?.unit,
                    })}
                    <span className="block text-xs text-slate-400">
                      received {item.received_quantity}/{item.quantity} {item.products?.unit}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    {formatMoney(item.unit_price, currency)}
                    <span className="text-xs text-slate-400">
                      {' '}/ {item.uom === 'carton' ? 'ctn' : (item.products?.unit ?? 'unit')}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right font-medium">
                    {formatMoney(item.line_total, currency)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3} className="px-5 py-4 text-right font-semibold">
                  Total
                </td>
                <td className="px-5 py-4 text-right text-lg font-bold">
                  {formatMoney(order.total, currency)}
                </td>
              </tr>
            </tfoot>
          </table>
        </CardContent>
      </Card>
      {order.notes && (
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600">{order.notes}</p>
          </CardContent>
        </Card>
      )}
      {can(caller, 'purchases.manage') && order.status !== 'draft' && order.status !== 'cancelled' && (
        <ReceiveForm purchaseOrderId={order.id} items={purchaseItems} />
      )}
      {(receipts?.length ?? 0) > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Goods receipts</CardTitle>
            <CardDescription>Posted GRNs for this order</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                  <th className="px-5 py-3">GRN</th>
                  <th className="px-5 py-3">Date</th>
                  <th className="px-5 py-3 text-right">Total</th>
                  <th className="px-5 py-3">Notes</th>
                </tr>
              </thead>
              <tbody>
                {receipts?.map((receipt) => (
                  <tr key={receipt.id} className="border-b border-slate-100">
                    <td className="px-5 py-3 font-medium text-slate-900">{receipt.grn_number}</td>
                    <td className="px-5 py-3">{formatDate(receipt.received_date)}</td>
                    <td className="px-5 py-3 text-right">
                      {formatMoney(receipt.total_received, currency)}
                    </td>
                    <td className="px-5 py-3 text-slate-500">{receipt.notes ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
