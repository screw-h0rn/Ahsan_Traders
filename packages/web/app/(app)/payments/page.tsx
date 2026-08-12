import { redirect } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@at/ui';
import { can, getStaffProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { formatDate, formatMoney } from '@/lib/format';
import { buildReceiptMessage } from '@/lib/whatsapp';
import { WhatsAppShareButton } from '@/components/whatsapp-share-button';
import { PaymentForm } from './payment-form';

export default async function PaymentsPage() {
  const caller = await getStaffProfile();
  if (!caller) redirect('/login');
  if (!can(caller, 'finance.view')) redirect('/dashboard');

  const supabase = await createClient();
  const [{ data: payments }, { data: customers }, { data: suppliers }, { data: tenant }] =
    await Promise.all([
      supabase
        .from('payments')
        .select('id,payment_number,party_type,party_id,direction,amount,method,payment_date,notes,created_at')
        .order('created_at', { ascending: false })
        .limit(50),
      supabase.from('customers').select('id,name,phone').eq('status', 'active').order('name'),
      supabase.from('suppliers').select('id,name,phone').eq('status', 'active').order('name'),
      supabase.from('company_settings').select('name,currency').single(),
    ]);

  const currency = tenant?.currency ?? 'PKR';
  const canManage = can(caller, 'finance.manage');
  const list = payments ?? [];

  const customerById = new Map((customers ?? []).map((c) => [c.id, c.name] as const));
  const customerPhoneById = new Map((customers ?? []).map((c) => [c.id, c.phone] as const));
  const supplierById = new Map((suppliers ?? []).map((s) => [s.id, s.name] as const));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Payments</h1>
        <p className="text-slate-500">Record receipts and supplier payments.</p>
      </div>

      {canManage && (
        <PaymentForm customers={customers ?? []} suppliers={suppliers ?? []} currency={currency} />
      )}

      <Card>
        <CardHeader>
          <CardTitle>Recent payments</CardTitle>
          <CardDescription>
            {list.length} record{list.length === 1 ? '' : 's'}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {list.length === 0 ? (
            <p className="px-5 pb-5 text-sm text-slate-500">No payments yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-3 font-medium">Number</th>
                  <th className="px-5 py-3 font-medium">Date</th>
                  <th className="px-5 py-3 font-medium">Party</th>
                  <th className="px-5 py-3 font-medium">Method</th>
                  <th className="px-5 py-3 font-medium text-right">Amount</th>
                  <th className="px-5 py-3 font-medium text-right print:hidden">Receipt</th>
                </tr>
              </thead>
              <tbody>
                {list.map((p) => {
                  const partyName =
                    p.party_type === 'customer'
                      ? customerById.get(p.party_id) ?? 'Customer'
                      : supplierById.get(p.party_id) ?? 'Supplier';
                  return (
                    <tr key={p.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                      <td className="px-5 py-3 font-medium text-slate-900">{p.payment_number}</td>
                      <td className="px-5 py-3 text-slate-600">{formatDate(p.payment_date)}</td>
                      <td className="px-5 py-3 text-slate-600">
                        {partyName}
                        <span className="ml-2 text-xs text-slate-400">({p.party_type})</span>
                      </td>
                      <td className="px-5 py-3 text-slate-600">{p.method.replace('_', ' ')}</td>
                      <td className="px-5 py-3 text-right font-medium text-slate-900">
                        {formatMoney(p.amount, currency)}
                      </td>
                      <td className="px-5 py-3 text-right print:hidden">
                        {p.party_type === 'customer' ? (
                          <WhatsAppShareButton
                            phone={customerPhoneById.get(p.party_id)}
                            label="WhatsApp"
                            className="h-8 px-2 text-xs"
                            message={buildReceiptMessage({
                              businessName: tenant?.name ?? 'Distribution Platform',
                              customerName: partyName,
                              paymentNumber: p.payment_number,
                              paymentDate: formatDate(p.payment_date),
                              amount: formatMoney(p.amount, currency),
                              method: p.method,
                            })}
                          />
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

