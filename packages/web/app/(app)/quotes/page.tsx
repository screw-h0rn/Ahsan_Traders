import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, cn } from '@at/ui';
import { createClient } from '@/lib/supabase/server';
import { can, getStaffProfile } from '@/lib/auth';
import { formatDate, formatMoney } from '@/lib/format';
import { QuoteForm } from './quote-form';

const statusStyles: Record<string, string> = {
  open: 'bg-sky-100 text-sky-800',
  accepted: 'bg-emerald-100 text-emerald-700',
  rejected: 'bg-slate-200 text-slate-600',
};

export default async function QuotesPage() {
  const caller = await getStaffProfile();
  if (!caller) redirect('/login');
  if (!can(caller, 'sales.view')) redirect('/dashboard');

  const supabase = await createClient();
  const [{ data: quotes }, { data: customers }, { data: branches }, { data: products }, { data: tenant }] =
    await Promise.all([
      supabase
        .from('quotations')
        .select('id, quote_number, status, quote_date, valid_until, total, customers(name)')
        .order('created_at', { ascending: false })
        .limit(100),
      supabase.from('customers').select('id,name').eq('status', 'active').order('name'),
      supabase.from('branches').select('id,name').eq('status', 'active').order('created_at'),
      supabase
        .from('products')
        .select('id,name,sku,barcode,unit,variant_label,units_per_carton,sale_price,carton_sale_price')
        .eq('status', 'active')
        .order('name'),
      supabase.from('company_settings').select('currency').single(),
    ]);

  const list = quotes ?? [];
  const currency = tenant?.currency ?? 'PKR';
  const canManage = can(caller, 'sales.manage');

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Quotations</h1>
        <p className="text-slate-500">
          Price offers for customers — accepted quotes become sales orders.
        </p>
      </div>

      {canManage && (
        <QuoteForm
          customers={customers ?? []}
          branches={branches ?? []}
          products={products ?? []}
          currency={currency}
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle>All quotations</CardTitle>
          <CardDescription>
            {list.length} quotation{list.length === 1 ? '' : 's'}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {list.length === 0 ? (
            <p className="px-5 pb-5 text-sm text-slate-500">
              No quotations yet. Create one to send a price offer to a customer.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-3 font-medium">Quote</th>
                  <th className="px-5 py-3 font-medium">Customer</th>
                  <th className="px-5 py-3 font-medium text-right">Total</th>
                  <th className="px-5 py-3 font-medium">Valid until</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {list.map((q) => (
                  <tr key={q.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                    <td className="px-5 py-3">
                      <Link
                        href={`/quotes/${q.id}`}
                        className="font-medium text-brand-700 hover:underline"
                      >
                        {q.quote_number}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-slate-600">{q.customers?.name ?? '—'}</td>
                    <td className="px-5 py-3 text-right font-medium text-slate-900">
                      {formatMoney(q.total, currency)}
                    </td>
                    <td className="px-5 py-3 text-slate-600">
                      {q.valid_until ? formatDate(q.valid_until) : '—'}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={cn(
                          'rounded-md px-2 py-0.5 text-xs font-medium',
                          statusStyles[q.status] ?? 'bg-slate-200 text-slate-600',
                        )}
                      >
                        {q.status}
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
