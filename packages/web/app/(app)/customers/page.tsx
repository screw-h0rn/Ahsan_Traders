import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, cn } from '@at/ui';
import { createClient } from '@/lib/supabase/server';
import { can, getStaffProfile } from '@/lib/auth';
import { creditLimitShort } from '@/lib/credit';
import { formatMoney } from '@/lib/format';
import { SearchInput } from '@/components/search-input';
import { CustomerForm } from './customer-form';

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const caller = await getStaffProfile();
  if (!caller) redirect('/login');
  if (!can(caller, 'customers.view')) redirect('/dashboard');

  const supabase = await createClient();
  let customersQuery = supabase
    .from('customers')
    .select('id, name, phone, opening_balance, credit_limit, status')
    .order('created_at', { ascending: false });
  if (q?.trim()) customersQuery = customersQuery.ilike('name', `%${q.trim()}%`);

  const [{ data: customers }, { data: tenant }] = await Promise.all([
    customersQuery,
    supabase.from('company_settings').select('currency').single(),
  ]);

  const currency = tenant?.currency ?? 'PKR';
  const canManage = can(caller, 'customers.manage');
  const list = customers ?? [];
  const customerIds = list.map((customer) => customer.id);
  const { data: ledgerEntries } = customerIds.length
    ? await supabase
        .from('ledger_entries')
        .select('party_id,debit,credit')
        .eq('party_type', 'customer')
        .in('party_id', customerIds)
    : { data: [] as { party_id: string; debit: number; credit: number }[] };

  const receivableByCustomer = new Map<string, number>();
  for (const entry of ledgerEntries ?? []) {
    const current = receivableByCustomer.get(entry.party_id) ?? 0;
    receivableByCustomer.set(entry.party_id, current + Number(entry.debit) - Number(entry.credit));
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Customers</h1>
        <p className="text-slate-500">The parties you sell to.</p>
      </div>

      {canManage && <CustomerForm />}

      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-1">
            <CardTitle>All customers</CardTitle>
            <CardDescription>
              {list.length} customer{list.length === 1 ? '' : 's'}
              {q?.trim() ? ` matching “${q.trim()}”` : ''}
            </CardDescription>
          </div>
          <SearchInput placeholder="Search customers…" defaultValue={q} />
        </CardHeader>
        <CardContent className="p-0">
          {list.length === 0 ? (
            <p className="px-5 pb-5 text-sm text-slate-500">
              {q?.trim()
                ? `No customers match “${q.trim()}”.`
                : 'No customers yet. Add your first customer to start selling.'}
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-3 font-medium">Name</th>
                  <th className="px-5 py-3 font-medium">Phone</th>
                  <th className="px-5 py-3 font-medium text-right">Balance (receivable)</th>
                  <th className="px-5 py-3 font-medium text-right">Credit limit</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {list.map((c) => (
                  <tr key={c.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                    <td className="px-5 py-3">
                      <Link
                        href={`/customers/${c.id}`}
                        className="font-medium text-brand-700 hover:underline"
                      >
                        {c.name}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-slate-600">{c.phone ?? '—'}</td>
                    <td className="px-5 py-3 text-right font-medium text-slate-900">
                      {formatMoney(
                        Number(c.opening_balance) + (receivableByCustomer.get(c.id) ?? 0),
                        currency,
                      )}
                    </td>
                    <td className="px-5 py-3 text-right text-slate-600">
                      {creditLimitShort(c.credit_limit, currency)}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={cn(
                          'rounded-md px-2 py-0.5 text-xs font-medium',
                          c.status === 'active'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-slate-200 text-slate-600',
                        )}
                      >
                        {c.status}
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
