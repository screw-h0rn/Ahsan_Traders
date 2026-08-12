import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, cn } from '@at/ui';
import { createClient } from '@/lib/supabase/server';
import { can, getStaffProfile } from '@/lib/auth';
import { formatDate, formatMoney } from '@/lib/format';
import { QuoteActions } from './quote-actions';

const statusStyles: Record<string, string> = {
  open: 'bg-sky-100 text-sky-800',
  accepted: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-slate-200 text-slate-600',
};

export default async function QuoteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const caller = await getStaffProfile();
  if (!caller) redirect('/login');
  if (!can(caller, 'sales.view')) redirect('/dashboard');

  const supabase = await createClient();
  const [{ data: quote }, { data: tenant }] = await Promise.all([
    supabase
      .from('quotations')
      .select(
        'id, quote_number, status, quote_date, valid_until, subtotal, total, notes, sales_order_id, customers(name), branches(name), quotation_items(quantity, unit_price, line_total, products(name, sku, unit))',
      )
      .eq('id', id)
      .maybeSingle(),
    supabase.from('company_settings').select('currency').single(),
  ]);

  if (!quote) notFound();
  const currency = tenant?.currency ?? 'PKR';
  const items = quote.quotation_items ?? [];
  const canManage = can(caller, 'sales.manage');
  const expired = !!quote.valid_until && new Date(quote.valid_until) < new Date();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/quotes" className="text-sm text-brand-600 hover:underline">
            ← Quotations
          </Link>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            {quote.quote_number}
          </h1>
          <p className="text-slate-500">
            {quote.customers?.name} · from {quote.branches?.name} ·{' '}
            {formatDate(quote.quote_date)}
            {quote.valid_until ? ` · valid until ${formatDate(quote.valid_until)}` : ''}
          </p>
        </div>
        <span
          className={cn(
            'rounded-md px-2.5 py-1 text-xs font-semibold uppercase tracking-wide',
            statusStyles[quote.status] ?? 'bg-slate-200 text-slate-600',
          )}
        >
          {expired && quote.status === 'open' ? 'expired' : quote.status}
        </span>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Items</CardTitle>
          <CardDescription>
            {items.length} line{items.length === 1 ? '' : 's'} · total{' '}
            {formatMoney(quote.total, currency)}
            {quote.notes ? ` · ${quote.notes}` : ''}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-5 py-3 font-medium">Product</th>
                <th className="px-5 py-3 font-medium">SKU</th>
                <th className="px-5 py-3 font-medium text-right">Quantity</th>
                <th className="px-5 py-3 font-medium text-right">Unit price</th>
                <th className="px-5 py-3 font-medium text-right">Line total</th>
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
                  <td className="px-5 py-3 text-right">{formatMoney(item.unit_price, currency)}</td>
                  <td className="px-5 py-3 text-right font-medium">
                    {formatMoney(item.line_total, currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {quote.status === 'accepted' && quote.sales_order_id && (
        <Card>
          <CardContent className="pt-6 text-sm text-slate-600">
            This quotation was accepted —{' '}
            <Link
              href={`/sales/${quote.sales_order_id}`}
              className="font-medium text-brand-700 hover:underline"
            >
              view the sales order →
            </Link>
          </CardContent>
        </Card>
      )}

      {canManage && quote.status === 'open' && !expired && (
        <Card>
          <CardHeader>
            <CardTitle>Decision</CardTitle>
            <CardDescription>
              Converting creates a sales order with these exact lines — stock and
              credit checks run there and may hold the order for approval.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <QuoteActions quotationId={quote.id} />
          </CardContent>
        </Card>
      )}
      {canManage && quote.status === 'open' && expired && (
        <Card>
          <CardContent className="pt-6 text-sm text-slate-500">
            This quotation has expired and can no longer be converted — create a fresh
            one if the customer is still interested.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
