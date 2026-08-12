import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@at/ui';
import { createClient } from '@/lib/supabase/server';
import { can, getStaffProfile } from '@/lib/auth';
import { creditLimitLabel } from '@/lib/credit';
import { formatMoney } from '@/lib/format';
import { CustomerEditForm } from './edit-form';

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const caller = await getStaffProfile();
  if (!caller) redirect('/login');
  if (!can(caller, 'customers.view')) redirect('/dashboard');

  const supabase = await createClient();
  const [{ data: customer }, { data: tenant }, { data: ledgerEntries }] = await Promise.all([
    supabase
      .from('customers')
      .select('id, name, phone, email, address, opening_balance, credit_limit, notes, status')
      .eq('id', id)
      .maybeSingle(),
    supabase.from('company_settings').select('currency').single(),
    supabase
      .from('ledger_entries')
      .select('id,debit,credit,reference_type,created_at')
      .eq('party_type', 'customer')
      .eq('party_id', id)
      .order('created_at', { ascending: false })
      .limit(20),
  ]);

  if (!customer) notFound();
  const currency = tenant?.currency ?? 'PKR';
  const canManage = can(caller, 'customers.manage');
  const ledgerDelta = (ledgerEntries ?? []).reduce(
    (sum, entry) => sum + Number(entry.debit) - Number(entry.credit),
    0,
  );
  const receivableBalance = Number(customer.opening_balance) + ledgerDelta;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div>
          <Link href="/customers" className="text-sm text-brand-600 hover:underline">
            ← Customers
          </Link>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            {customer.name}
          </h1>
          <p className="text-slate-500">{customer.phone ?? 'No phone on file'}</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Balance (receivable)</CardTitle>
            <CardDescription>What this customer currently owes you</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-slate-900">
              {formatMoney(receivableBalance, currency)}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Opening balance {formatMoney(customer.opening_balance, currency)} plus
              append-only ledger entries.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Credit limit</CardTitle>
            <CardDescription>Checked against the ledger balance when an order is placed</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-slate-900">
              {creditLimitLabel(customer.credit_limit, currency)}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Orders that would push the balance past this limit will be held for
              approval.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ledger</CardTitle>
          <CardDescription>Customer receivable history</CardDescription>
        </CardHeader>
        <CardContent>
          {ledgerEntries?.length ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2">When</th>
                  <th className="py-2">Reference</th>
                  <th className="py-2 text-right">Debit</th>
                  <th className="py-2 text-right">Credit</th>
                </tr>
              </thead>
              <tbody>
                {ledgerEntries.map((entry) => (
                  <tr key={entry.id} className="border-b border-slate-100 last:border-0">
                    <td className="py-2 text-slate-600">{new Date(entry.created_at).toLocaleString()}</td>
                    <td className="py-2 text-slate-600">{entry.reference_type ?? 'manual'}</td>
                    <td className="py-2 text-right font-medium text-slate-900">
                      {entry.debit > 0 ? formatMoney(entry.debit, currency) : '—'}
                    </td>
                    <td className="py-2 text-right text-slate-600">
                      {entry.credit > 0 ? formatMoney(entry.credit, currency) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-slate-500">No ledger entries posted yet.</p>
          )}
        </CardContent>
      </Card>

      {canManage && <CustomerEditForm customer={customer} />}
    </div>
  );
}
