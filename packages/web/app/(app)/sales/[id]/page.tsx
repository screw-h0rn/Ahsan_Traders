import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, cn } from '@at/ui';
import { can, getStaffProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { formatDate, formatLineQuantity, formatMoney, productLabel } from '@/lib/format';
import { isActionable, isInvoiceable, orderStatus } from '@/lib/order-status';
import { InvoiceForm } from './invoice-form';
import { OrderActions } from './order-actions';
import { RecordPaymentForm } from './record-payment-form';

const PAYMENT_BADGE: Record<string, string> = {
  paid: 'bg-emerald-100 text-emerald-700',
  partial: 'bg-amber-100 text-amber-700',
  unpaid: 'bg-rose-100 text-rose-700',
};

export default async function SalesDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const caller = await getStaffProfile();
  if (!caller) redirect('/login');
  if (!can(caller, 'sales.view')) redirect('/dashboard');

  const supabase = await createClient();
  const [{ data: order }, { data: items }, { data: tenant }, { data: invoice }] = await Promise.all([
    supabase
      .from('sales_orders')
      .select('id,so_number,order_date,status,subtotal,total,hold_reason,notes,customers(name),branches(name)')
      .eq('id', id)
      .maybeSingle(),
    supabase
      .from('sales_order_items')
      .select('id,quantity,uom,qty_entered,unit_price,line_total,products(name,sku,unit,variant_label)')
      .eq('sales_order_id', id),
    supabase.from('company_settings').select('currency').single(),
    supabase
      .from('sales_invoices')
      .select('id,invoice_number,invoice_date,subtotal,tax_rate,tax_amount,total,status,amount_paid,payment_status')
      .eq('sales_order_id', id)
      .maybeSingle(),
  ]);

  if (!order) notFound();
  const currency = tenant?.currency ?? 'PKR';
  const status = orderStatus(order.status);

  const { data: allocations } = invoice
    ? await supabase
        .from('payment_allocations')
        .select('id,amount,created_at,payments(payment_number,payment_date,method)')
        .eq('invoice_id', invoice.id)
        .order('created_at')
    : { data: null };

  const outstanding = invoice ? Math.round((invoice.total - invoice.amount_paid) * 100) / 100 : 0;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/sales" className="text-sm text-brand-600 hover:underline">
          ← Sales orders
        </Link>
        <div className="mt-1 flex items-center gap-3">
          <h1 className="text-2xl font-bold text-slate-900">{order.so_number}</h1>
          <span className={cn('rounded-md px-2 py-0.5 text-xs', status.badge)}>{status.label}</span>
        </div>
        <p className="text-slate-500">
          {order.customers?.name} · {order.branches?.name} · {formatDate(order.order_date)}
        </p>
        <p className="mt-1 text-sm text-slate-500">{status.hint}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Order lines</CardTitle>
          <CardDescription>
            {order.hold_reason ?? 'Stock and credit checks passed.'}
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
                  </td>
                  <td className="px-5 py-3 text-right">{formatMoney(item.unit_price, currency)}</td>
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

      {can(caller, 'sales.manage') && isActionable(order.status) ? (
        <Card>
          <CardHeader>
            <CardTitle>
              {order.status === 'awaiting_approval' ? 'Review this order' : 'Order on hold'}
            </CardTitle>
            <CardDescription>{status.hint}</CardDescription>
          </CardHeader>
          <CardContent>
            <OrderActions
              salesOrderId={order.id}
              status={order.status}
              holdReason={order.hold_reason ?? null}
            />
          </CardContent>
        </Card>
      ) : null}

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

      {invoice ? (
        <Card>
          <CardHeader>
            <CardTitle>Invoice</CardTitle>
            <CardDescription>Posted against this sales order</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="flex items-center gap-2 font-medium text-slate-900">
                  {invoice.invoice_number}
                  <span
                    className={cn(
                      'rounded-md px-2 py-0.5 text-xs',
                      PAYMENT_BADGE[invoice.payment_status] ?? 'bg-slate-200 text-slate-700',
                    )}
                  >
                    {invoice.payment_status}
                  </span>
                </p>
                <p className="text-sm text-slate-500">
                  {formatDate(invoice.invoice_date)} · {formatMoney(invoice.total, currency)}
                  {invoice.amount_paid > 0 ? (
                    <>
                      {' '}
                      · paid {formatMoney(invoice.amount_paid, currency)} · due{' '}
                      {formatMoney(outstanding, currency)}
                    </>
                  ) : null}
                </p>
              </div>
              <Link
                href={`/sales/${order.id}/invoice`}
                className="rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50"
              >
                View / print invoice
              </Link>
            </div>

            {allocations?.length ? (
              <div>
                <p className="mb-1 text-xs font-semibold uppercase text-slate-500">
                  Payments received
                </p>
                <ul className="flex flex-col gap-1 text-sm text-slate-600">
                  {allocations.map((allocation) => (
                    <li key={allocation.id} className="flex justify-between">
                      <span>
                        {allocation.payments?.payment_number} ·{' '}
                        {allocation.payments
                          ? `${formatDate(allocation.payments.payment_date)} · ${allocation.payments.method.replace('_', ' ')}`
                          : ''}
                      </span>
                      <span className="font-medium">{formatMoney(allocation.amount, currency)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {can(caller, 'finance.manage') && outstanding > 0 ? (
              <RecordPaymentForm
                invoiceId={invoice.id}
                salesOrderId={order.id}
                outstanding={outstanding}
                currency={currency}
              />
            ) : null}
          </CardContent>
        </Card>
      ) : can(caller, 'sales.manage') && isInvoiceable(order.status) ? (
        <InvoiceForm salesOrderId={order.id} />
      ) : null}
    </div>
  );
}
