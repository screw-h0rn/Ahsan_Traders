import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, cn } from '@at/ui';
import { can, getStaffProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { formatDate, formatLineQuantity, formatMoney, productLabel } from '@/lib/format';
import { buildInvoiceMessage } from '@/lib/whatsapp';
import { WhatsAppShareButton } from '@/components/whatsapp-share-button';
import { PrintInvoiceButton } from '../print-button';
import { SendWhatsAppButton } from '../send-whatsapp-button';

const PAYMENT_BADGE: Record<string, string> = {
  paid: 'bg-emerald-100 text-emerald-700',
  partial: 'bg-amber-100 text-amber-700',
  unpaid: 'bg-rose-100 text-rose-700',
};

export default async function SalesInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const caller = await getStaffProfile();
  if (!caller) redirect('/login');
  if (!can(caller, 'sales.view')) redirect('/dashboard');

  const supabase = await createClient();
  const [{ data: order }, { data: invoice }, { data: tenant }] = await Promise.all([
    supabase
      .from('sales_orders')
      .select('id,so_number,order_date,customers(name,phone,address),branches(name)')
      .eq('id', id)
      .maybeSingle(),
    supabase
      .from('sales_invoices')
      .select(
        'id,invoice_number,invoice_date,subtotal,tax_rate,tax_amount,total,notes,amount_paid,payment_status',
      )
      .eq('sales_order_id', id)
      .maybeSingle(),
    supabase.from('company_settings').select('currency,name,address,phone,tax_name').single(),
  ]);

  if (!order || !invoice) notFound();
  const currency = tenant?.currency ?? 'PKR';
  const { data: items } = await supabase
    .from('sales_invoice_items')
    .select('id,quantity,uom,qty_entered,unit_price,line_total,unit_cost,products(name,sku,unit,variant_label)')
    .eq('sales_invoice_id', invoice.id);

  const outstanding = Math.round((invoice.total - invoice.amount_paid) * 100) / 100;
  const cogs = (items ?? []).reduce((sum, item) => sum + item.quantity * item.unit_cost, 0);
  const grossProfit = Math.round((invoice.subtotal - cogs) * 100) / 100;
  const canSeeMargin = can(caller, 'finance.view');

  const whatsappMessage = buildInvoiceMessage({
    businessName: tenant?.name ?? 'Distribution Platform',
    customerName: order.customers?.name ?? 'Customer',
    invoiceNumber: invoice.invoice_number,
    invoiceDate: formatDate(invoice.invoice_date),
    currency,
    lines: (items ?? []).map((item) => ({
      label: productLabel(item.products?.name, item.products?.variant_label),
      quantity: formatLineQuantity({
        uom: item.uom,
        qty_entered: item.qty_entered,
        quantity: item.quantity,
        unit: item.products?.unit,
      }),
      total: formatMoney(item.line_total, currency),
    })),
    subtotal: formatMoney(invoice.subtotal, currency),
    taxLabel:
      invoice.tax_amount > 0
        ? `${tenant?.tax_name ?? 'GST'} (${invoice.tax_rate}%): ${formatMoney(invoice.tax_amount, currency)}`
        : null,
    total: formatMoney(invoice.total, currency),
    outstanding: outstanding > 0 ? formatMoney(outstanding, currency) : null,
  });

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 bg-white p-6 text-slate-900 print:max-w-none print:p-0">
      <div className="flex items-start justify-between print:hidden">
        <div>
          <Link href={`/sales/${id}`} className="text-sm text-brand-600 hover:underline">
            ← Sales order
          </Link>
          <h1 className="mt-1 flex items-center gap-3 text-2xl font-bold text-slate-900">
            {invoice.invoice_number}
            <span
              className={cn(
                'rounded-md px-2 py-0.5 text-xs font-medium',
                PAYMENT_BADGE[invoice.payment_status] ?? 'bg-slate-200 text-slate-700',
              )}
            >
              {invoice.payment_status}
            </span>
          </h1>
          <p className="text-slate-500">Posted invoice for {order.so_number}</p>
        </div>
        <div className="flex flex-wrap items-start justify-end gap-3">
          <a
            href={`/sales/${id}/invoice/pdf?download=1`}
            className="rounded-md border border-slate-200 px-3 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50"
          >
            Download PDF
          </a>
          <WhatsAppShareButton
            phone={order.customers?.phone}
            message={whatsappMessage}
            label="Share summary"
          />
          {can(caller, 'sales.manage') ? <SendWhatsAppButton salesOrderId={order.id} /> : null}
          <PrintInvoiceButton />
        </div>
      </div>

      <Card className="border-slate-200 shadow-none">
        <CardHeader>
          <CardTitle>{tenant?.name ?? 'Distribution Platform'}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <p className="font-medium">Bill to</p>
            <p>{order.customers?.name}</p>
            <p className="text-slate-500">{order.customers?.phone ?? '—'}</p>
            <p className="text-slate-500">{order.customers?.address ?? '—'}</p>
          </div>
          <div className="sm:text-right">
            <p><span className="font-medium">Invoice date:</span> {formatDate(invoice.invoice_date)}</p>
            <p><span className="font-medium">Sales order:</span> {order.so_number}</p>
            <p><span className="font-medium">Branch:</span> {order.branches?.name}</p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200 shadow-none">
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
          </table>
        </CardContent>
      </Card>

      <div className="ml-auto grid w-full max-w-sm gap-2 text-sm">
        <div className="flex justify-between">
          <span>Subtotal</span>
          <span>{formatMoney(invoice.subtotal, currency)}</span>
        </div>
        <div className="flex justify-between">
          <span>{tenant?.tax_name ?? 'GST'} ({invoice.tax_rate}%)</span>
          <span>{formatMoney(invoice.tax_amount, currency)}</span>
        </div>
        <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-semibold">
          <span>Total</span>
          <span>{formatMoney(invoice.total, currency)}</span>
        </div>
        {invoice.amount_paid > 0 ? (
          <>
            <div className="flex justify-between text-emerald-700">
              <span>Paid</span>
              <span>{formatMoney(invoice.amount_paid, currency)}</span>
            </div>
            <div className="flex justify-between font-semibold">
              <span>Balance due</span>
              <span>{formatMoney(outstanding, currency)}</span>
            </div>
          </>
        ) : null}
      </div>

      {canSeeMargin ? (
        <div className="ml-auto w-full max-w-sm rounded-md border border-dashed border-slate-300 p-3 text-sm print:hidden">
          <p className="mb-1 text-xs font-semibold uppercase text-slate-500">
            Margin (internal — not printed)
          </p>
          <div className="flex justify-between text-slate-600">
            <span>Cost of goods</span>
            <span>{formatMoney(Math.round(cogs * 100) / 100, currency)}</span>
          </div>
          <div
            className={cn(
              'flex justify-between font-semibold',
              grossProfit >= 0 ? 'text-emerald-700' : 'text-rose-700',
            )}
          >
            <span>Gross profit</span>
            <span>
              {formatMoney(grossProfit, currency)}
              {invoice.subtotal > 0
                ? ` (${Math.round((grossProfit / invoice.subtotal) * 1000) / 10}%)`
                : ''}
            </span>
          </div>
        </div>
      ) : null}

      {invoice.notes && <p className="text-sm text-slate-600">Notes: {invoice.notes}</p>}
    </div>
  );
}
