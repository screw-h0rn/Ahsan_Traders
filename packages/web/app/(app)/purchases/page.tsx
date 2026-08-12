import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, cn } from '@at/ui';
import { can, getStaffProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { formatDate, formatMoney } from '@/lib/format';
import { PurchaseOrderForm } from './purchase-order-form';

export default async function PurchasesPage() {
  const caller = await getStaffProfile();
  if (!caller) redirect('/login');
  if (!can(caller, 'purchases.view')) redirect('/dashboard');
  const supabase = await createClient();
  const [
    { data: orders },
    { data: suppliers },
    { data: branches },
    { data: products },
    { data: tenant },
  ] = await Promise.all([
    supabase
      .from('purchase_orders')
      .select('id,po_number,order_date,status,total,suppliers(name),branches(name)')
      .order('created_at', { ascending: false }),
    supabase.from('suppliers').select('id,name').eq('status', 'active').order('name'),
    supabase.from('branches').select('id,name').eq('status', 'active').order('name'),
    supabase
      .from('products')
      .select('id,name,sku,barcode,unit,variant_label,units_per_carton,purchase_price')
      .eq('status', 'active')
      .order('name'),
    supabase.from('company_settings').select('currency').single(),
  ]);
  const currency = tenant?.currency ?? 'PKR';
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Purchase orders</h1>
        <p className="text-slate-500">Order stock from suppliers and prepare it for receiving.</p>
      </div>
      {can(caller, 'purchases.manage') && (
        <PurchaseOrderForm
          suppliers={suppliers ?? []}
          branches={branches ?? []}
          products={products ?? []}
          currency={currency}
        />
      )}
      <Card>
        <CardHeader>
          <CardTitle>All purchase orders</CardTitle>
          <CardDescription>{orders?.length ?? 0} orders</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {!orders?.length ? (
            <p className="px-5 pb-5 text-sm text-slate-500">No purchase orders yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                  <th className="px-5 py-3">PO</th>
                  <th className="px-5 py-3">Supplier</th>
                  <th className="px-5 py-3">Branch</th>
                  <th className="px-5 py-3">Date</th>
                  <th className="px-5 py-3 text-right">Total</th>
                  <th className="px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id} className="border-b border-slate-100">
                    <td className="px-5 py-3">
                      <Link
                        href={`/purchases/${order.id}`}
                        className="font-medium text-brand-700 hover:underline"
                      >
                        {order.po_number}
                      </Link>
                    </td>
                    <td className="px-5 py-3">{order.suppliers?.name}</td>
                    <td className="px-5 py-3">{order.branches?.name}</td>
                    <td className="px-5 py-3">{formatDate(order.order_date)}</td>
                    <td className="px-5 py-3 text-right">{formatMoney(order.total, currency)}</td>
                    <td className="px-5 py-3">
                      <span
                        className={cn(
                          'rounded-md px-2 py-0.5 text-xs',
                          order.status === 'issued'
                            ? 'bg-blue-100 text-blue-700'
                            : order.status === 'partially_received'
                              ? 'bg-amber-100 text-amber-700'
                              : order.status === 'received'
                                ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-slate-200 text-slate-700',
                        )}
                      >
                        {order.status}
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
