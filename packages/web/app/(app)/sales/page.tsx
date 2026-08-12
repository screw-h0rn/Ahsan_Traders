import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, cn } from '@at/ui';
import { can, getStaffProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { formatDate, formatMoney } from '@/lib/format';
import { orderStatus } from '@/lib/order-status';
import { SalesOrderForm } from './sales-order-form';

export default async function SalesPage() {
  const caller = await getStaffProfile();
  if (!caller) redirect('/login');
  if (!can(caller, 'sales.view')) redirect('/dashboard');

  const supabase = await createClient();
  const [{ data: orders }, { data: customers }, { data: branches }, { data: products }, { data: tenant }] =
    await Promise.all([
      supabase
        .from('sales_orders')
        .select('id,so_number,order_date,status,total,hold_reason,customers(name),branches(name)')
        .order('created_at', { ascending: false }),
      supabase.from('customers').select('id,name').eq('status', 'active').order('name'),
      supabase.from('branches').select('id,name').eq('status', 'active').order('name'),
      supabase
        .from('products')
        .select('id,name,sku,barcode,unit,variant_label,units_per_carton,sale_price,carton_sale_price')
        .eq('status', 'active')
        .order('name'),
      supabase.from('company_settings').select('currency').single(),
    ]);

  const currency = tenant?.currency ?? 'PKR';
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Sales orders</h1>
        <p className="text-slate-500">Book sales, hold exceptions, and confirm orders.</p>
      </div>
      {can(caller, 'sales.manage') && (
        <SalesOrderForm
          customers={customers ?? []}
          branches={branches ?? []}
          products={products ?? []}
          currency={currency}
        />
      )}
      <Card>
        <CardHeader>
          <CardTitle>All sales orders</CardTitle>
          <CardDescription>{orders?.length ?? 0} orders</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {!orders?.length ? (
            <p className="px-5 pb-5 text-sm text-slate-500">No sales orders yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                  <th className="px-5 py-3">SO</th>
                  <th className="px-5 py-3">Customer</th>
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
                        href={`/sales/${order.id}`}
                        className="font-medium text-brand-700 hover:underline"
                      >
                        {order.so_number}
                      </Link>
                    </td>
                    <td className="px-5 py-3">{order.customers?.name}</td>
                    <td className="px-5 py-3">{order.branches?.name}</td>
                    <td className="px-5 py-3">{formatDate(order.order_date)}</td>
                    <td className="px-5 py-3 text-right">{formatMoney(order.total, currency)}</td>
                    <td className="px-5 py-3">
                      <span
                        className={cn(
                          'rounded-md px-2 py-0.5 text-xs',
                          orderStatus(order.status).badge,
                        )}
                      >
                        {orderStatus(order.status).label}
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