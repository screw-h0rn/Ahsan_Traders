import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@at/ui';
import { createClient } from '@/lib/supabase/server';
import { can, getStaffProfile } from '@/lib/auth';
import { formatMoney } from '@/lib/format';
import { SupplierEditForm } from './edit-form';

export default async function SupplierDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const caller = await getStaffProfile();
  if (!caller) redirect('/login');
  if (!can(caller, 'suppliers.view')) redirect('/dashboard');

  const supabase = await createClient();
  const [{ data: supplier }, { data: tenant }, { data: ledgerEntries }] = await Promise.all([
    supabase
      .from('suppliers')
      .select('id, name, phone, email, address, opening_balance, notes, status')
      .eq('id', id)
      .maybeSingle(),
    supabase.from('company_settings').select('currency').single(),
    supabase
      .from('ledger_entries')
      .select('id,debit,credit,reference_type,created_at,notes')
      .eq('party_type', 'supplier')
      .eq('party_id', id)
      .order('created_at', { ascending: false })
      .limit(20),
  ]);

  if (!supplier) notFound();
  const currency = tenant?.currency ?? 'PKR';
  const canManage = can(caller, 'suppliers.manage');
  const ledgerDelta = (ledgerEntries ?? []).reduce(
    (sum, entry) => sum + Number(entry.credit) - Number(entry.debit),
    0,
  );
  const payableBalance = Number(supplier.opening_balance) + ledgerDelta;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div>
          <Link href="/suppliers" className="text-sm text-brand-600 hover:underline">
            ← Suppliers
          </Link>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            {supplier.name}
          </h1>
          <p className="text-slate-500">{supplier.phone ?? 'No phone on file'}</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Balance (payable)</CardTitle>
            <CardDescription>What you currently owe this supplier</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-slate-900">
              {formatMoney(payableBalance, currency)}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Opening balance {formatMoney(supplier.opening_balance, currency)} plus
              append-only ledger entries.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ledger</CardTitle>
            <CardDescription>Transaction history</CardDescription>
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
                      <td className="py-2 text-slate-600">
                        {new Date(entry.created_at).toLocaleString()}
                      </td>
                      <td className="py-2 text-slate-600">{entry.reference_type ?? 'manual'}</td>
                      <td className="py-2 text-right text-slate-600">
                        {entry.debit > 0 ? formatMoney(entry.debit, currency) : '—'}
                      </td>
                      <td className="py-2 text-right font-medium text-slate-900">
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
      </div>

      {canManage && <SupplierEditForm supplier={supplier} />}
    </div>
  );
}
