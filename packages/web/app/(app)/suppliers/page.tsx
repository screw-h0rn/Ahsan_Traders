import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, cn } from '@at/ui';
import { createClient } from '@/lib/supabase/server';
import { can, getStaffProfile } from '@/lib/auth';
import { formatMoney } from '@/lib/format';
import { SearchInput } from '@/components/search-input';
import { SupplierForm } from './supplier-form';

export default async function SuppliersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const caller = await getStaffProfile();
  if (!caller) redirect('/login');
  if (!can(caller, 'suppliers.view')) redirect('/dashboard');

  const supabase = await createClient();
  let suppliersQuery = supabase
    .from('suppliers')
    .select('id, name, phone, opening_balance, status')
    .order('created_at', { ascending: false });
  if (q?.trim()) suppliersQuery = suppliersQuery.ilike('name', `%${q.trim()}%`);

  const [{ data: suppliers }, { data: tenant }] = await Promise.all([
    suppliersQuery,
    supabase.from('company_settings').select('currency').single(),
  ]);

  const currency = tenant?.currency ?? 'PKR';
  const canManage = can(caller, 'suppliers.manage');
  const list = suppliers ?? [];
  const supplierIds = list.map((supplier) => supplier.id);
  const { data: ledgerEntries } = supplierIds.length
    ? await supabase
        .from('ledger_entries')
        .select('party_id,debit,credit')
        .eq('party_type', 'supplier')
        .in('party_id', supplierIds)
    : { data: [] as { party_id: string; debit: number; credit: number }[] };

  const payableBySupplier = new Map<string, number>();
  for (const entry of ledgerEntries ?? []) {
    const current = payableBySupplier.get(entry.party_id) ?? 0;
    payableBySupplier.set(entry.party_id, current + Number(entry.credit) - Number(entry.debit));
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Suppliers</h1>
        <p className="text-slate-500">The vendors you buy stock from.</p>
      </div>

      {canManage && <SupplierForm />}

      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-1">
            <CardTitle>All suppliers</CardTitle>
            <CardDescription>
              {list.length} supplier{list.length === 1 ? '' : 's'}
              {q?.trim() ? ` matching “${q.trim()}”` : ''}
            </CardDescription>
          </div>
          <SearchInput placeholder="Search suppliers…" defaultValue={q} />
        </CardHeader>
        <CardContent className="p-0">
          {list.length === 0 ? (
            <p className="px-5 pb-5 text-sm text-slate-500">
              {q?.trim()
                ? `No suppliers match “${q.trim()}”.`
                : 'No suppliers yet. Add your first vendor to start purchasing.'}
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-3 font-medium">Name</th>
                  <th className="px-5 py-3 font-medium">Phone</th>
                  <th className="px-5 py-3 font-medium text-right">Balance (payable)</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {list.map((s) => (
                  <tr key={s.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                    <td className="px-5 py-3">
                      <Link
                        href={`/suppliers/${s.id}`}
                        className="font-medium text-brand-700 hover:underline"
                      >
                        {s.name}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-slate-600">{s.phone ?? '—'}</td>
                    <td className="px-5 py-3 text-right font-medium text-slate-900">
                      {formatMoney(
                        Number(s.opening_balance) + (payableBySupplier.get(s.id) ?? 0),
                        currency,
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={cn(
                          'rounded-md px-2 py-0.5 text-xs font-medium',
                          s.status === 'active'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-slate-200 text-slate-600',
                        )}
                      >
                        {s.status}
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
