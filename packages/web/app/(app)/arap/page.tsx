import { redirect } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, cn } from '@at/ui';
import { can, getStaffProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { formatMoney } from '@/lib/format';
import { ArapTabs, type PartyBalanceItem } from './arap-tabs';

export default async function ArapPage() {
  const caller = await getStaffProfile();
  if (!caller) redirect('/login');
  if (!can(caller, 'finance.view')) redirect('/dashboard');

  const supabase = await createClient();
  const [{ data: customersData }, { data: suppliersData }, { data: tenant }] = await Promise.all([
    supabase.rpc('report_party_balances', { p_party_type: 'customer' }),
    supabase.rpc('report_party_balances', { p_party_type: 'supplier' }),
    supabase.from('company_settings').select('currency').single(),
  ]);

  const currency = tenant?.currency ?? 'PKR';
  // report_party_balances() returns: party_id, name, phone, opening_balance,
  // total_debit, total_credit, balance, credit_limit.
  const customers: PartyBalanceItem[] = (customersData ?? []).map((row: Record<string, unknown>) => ({
    party_id: String(row.party_id),
    party_name: String(row.name),
    party_phone: row.phone ? String(row.phone) : null,
    opening_balance: Number(row.opening_balance ?? 0),
    total_debit: Number(row.total_debit ?? 0),
    total_credit: Number(row.total_credit ?? 0),
    current_balance: Number(row.balance ?? 0),
    credit_limit: row.credit_limit !== null && row.credit_limit !== undefined ? Number(row.credit_limit) : null,
  }));

  const suppliers: PartyBalanceItem[] = (suppliersData ?? []).map((row: Record<string, unknown>) => ({
    party_id: String(row.party_id),
    party_name: String(row.name),
    party_phone: row.phone ? String(row.phone) : null,
    opening_balance: Number(row.opening_balance ?? 0),
    total_debit: Number(row.total_debit ?? 0),
    total_credit: Number(row.total_credit ?? 0),
    current_balance: Number(row.balance ?? 0),
    credit_limit: null,
  }));

  const totalAR = customers.reduce((sum, c) => sum + c.current_balance, 0);
  const totalAP = suppliers.reduce((sum, s) => sum + s.current_balance, 0);
  const netPosition = totalAR - totalAP;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Accounts Receivable &amp; Payable
        </h1>
        <p className="text-slate-500">
          Real-time receivables (AR) and payables (AP) balances derived directly from ledger entries.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="border-l-4 border-l-emerald-600 bg-emerald-50/30">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-semibold uppercase tracking-wider text-emerald-800">
              Total Accounts Receivable (AR)
            </CardDescription>
            <CardTitle className="text-2xl font-bold text-emerald-900">
              {formatMoney(totalAR, currency)}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-xs text-slate-500">
              Owed by {customers.filter((c) => c.current_balance > 0).length} customer(s)
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-600 bg-amber-50/30">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-semibold uppercase tracking-wider text-amber-800">
              Total Accounts Payable (AP)
            </CardDescription>
            <CardTitle className="text-2xl font-bold text-amber-900">
              {formatMoney(totalAP, currency)}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-xs text-slate-500">
              Owed to {suppliers.filter((s) => s.current_balance > 0).length} supplier(s)
            </p>
          </CardContent>
        </Card>

        <Card
          className={cn(
            'border-l-4',
            netPosition >= 0
              ? 'border-l-slate-700 bg-slate-50/50'
              : 'border-l-red-600 bg-red-50/30'
          )}
        >
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-semibold uppercase tracking-wider text-slate-700">
              Net Receivables Position
            </CardDescription>
            <CardTitle
              className={cn(
                'text-2xl font-bold',
                netPosition >= 0 ? 'text-slate-900' : 'text-red-900'
              )}
            >
              {formatMoney(netPosition, currency)}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-xs text-slate-500">
              {netPosition >= 0 ? 'Net cash positive (AR ≥ AP)' : 'Net cash deficit (AP > AR)'}
            </p>
          </CardContent>
        </Card>
      </div>

      <ArapTabs customers={customers} suppliers={suppliers} currency={currency} />
    </div>
  );
}
