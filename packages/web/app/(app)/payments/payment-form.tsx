'use client';

import { useActionState, useEffect, useMemo, useState, useTransition } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label, cn } from '@at/ui';
import { SubmitButton } from '@/components/submit-button';
import { FormAlert } from '@/components/form-alert';
import { formatDate, formatMoney } from '@/lib/format';
import {
  getOpenDocumentsAction,
  recordPaymentAction,
  type OpenDocument,
  type PaymentActionState,
} from './actions';

const initial: PaymentActionState = {};

type Party = { id: string; name: string; phone?: string | null };
type Kind = 'customer_receipt' | 'supplier_payment';

function today() {
  return new Date().toISOString().slice(0, 10);
}

export function PaymentForm({
  customers,
  suppliers,
  currency,
}: {
  customers: Party[];
  suppliers: Party[];
  currency: string;
}) {
  const [state, action] = useActionState(recordPaymentAction, initial);
  const [kind, setKind] = useState<Kind>('customer_receipt');
  const [partyId, setPartyId] = useState<string>(() => customers[0]?.id ?? '');
  const [amount, setAmount] = useState('');
  const [mode, setMode] = useState<'auto' | 'manual'>('auto');
  const [openDocs, setOpenDocs] = useState<OpenDocument[]>([]);
  const [manual, setManual] = useState<Record<string, string>>({});
  const [loading, startLoading] = useTransition();

  const parties = useMemo(
    () => (kind === 'customer_receipt' ? customers : suppliers),
    [kind, customers, suppliers],
  );

  useEffect(() => {
    if (!partyId) return;
    startLoading(async () => {
      setOpenDocs([]);
      setManual({});
      const result = await getOpenDocumentsAction(kind, partyId);
      setOpenDocs(result.documents ?? []);
    });
  }, [kind, partyId]);

  function changeKind(nextKind: Kind) {
    setKind(nextKind);
    const nextParties = nextKind === 'customer_receipt' ? customers : suppliers;
    setPartyId(nextParties[0]?.id ?? '');
  }

  const allocations = useMemo(() => {
    if (mode !== 'manual') return [];
    return Object.entries(manual)
      .map(([document_id, value]) => ({ document_id, amount: Number(value) }))
      .filter((a) => Number.isFinite(a.amount) && a.amount > 0);
  }, [mode, manual]);

  const allocatedTotal = allocations.reduce((sum, a) => sum + a.amount, 0);
  const totalOutstanding = openDocs.reduce((sum, d) => sum + Number(d.outstanding), 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Record payment</CardTitle>
        <CardDescription>
          Posts a ledger entry, updates balances, and links the payment to open{' '}
          {kind === 'customer_receipt' ? 'invoices' : 'goods receipts'}.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="flex flex-col gap-4">
          <FormAlert error={state.error} message={state.message} />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="kind">Type</Label>
              <select
                id="kind"
                name="kind"
                value={kind}
                onChange={(e) => changeKind(e.target.value as Kind)}
                className={cn(
                  'h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900',
                )}
              >
                <option value="customer_receipt">Receive from customer</option>
                <option value="supplier_payment">Pay supplier</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="payment_date">Date</Label>
              <Input id="payment_date" name="payment_date" type="date" defaultValue={today()} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="party_id">Party</Label>
              <select
                id="party_id"
                name="party_id"
                value={partyId}
                onChange={(e) => setPartyId(e.target.value)}
                className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900"
              >
                {parties.length === 0 ? <option value="">No parties found</option> : null}
                {parties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-400">
                {kind === 'customer_receipt'
                  ? 'Select customer to receive payment from.'
                  : 'Select supplier to issue payment to.'}
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="amount">Amount</Label>
              <Input
                id="amount"
                name="amount"
                inputMode="decimal"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
          </div>

          <div className="rounded-md border border-slate-200 p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-900">
                Open {kind === 'customer_receipt' ? 'invoices' : 'goods receipts'}
                {loading ? ' — loading…' : ` (${openDocs.length})`}
              </p>
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value as 'auto' | 'manual')}
                className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-900"
              >
                <option value="auto">Allocate automatically (oldest first)</option>
                <option value="manual">Choose documents manually</option>
              </select>
            </div>
            {openDocs.length === 0 && !loading ? (
              <p className="text-xs text-slate-500">
                Nothing outstanding — the payment will sit as an on-account
                {kind === 'customer_receipt' ? ' advance from this customer.' : ' credit with this supplier.'}
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                    <th className="py-2">Document</th>
                    <th className="py-2">Date</th>
                    <th className="py-2 text-right">Total</th>
                    <th className="py-2 text-right">Outstanding</th>
                    {mode === 'manual' ? <th className="py-2 text-right">Allocate</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {openDocs.map((doc) => (
                    <tr key={doc.document_id} className="border-b border-slate-100">
                      <td className="py-2 font-medium">{doc.document_number}</td>
                      <td className="py-2">{formatDate(doc.document_date)}</td>
                      <td className="py-2 text-right">{formatMoney(doc.total, currency)}</td>
                      <td className="py-2 text-right">{formatMoney(doc.outstanding, currency)}</td>
                      {mode === 'manual' ? (
                        <td className="py-2 text-right">
                          <input
                            type="number"
                            min={0}
                            max={doc.outstanding}
                            step="0.01"
                            value={manual[doc.document_id] ?? ''}
                            onChange={(e) =>
                              setManual((current) => ({
                                ...current,
                                [doc.document_id]: e.target.value,
                              }))
                            }
                            className="h-8 w-28 rounded-md border border-slate-200 px-2 text-right text-sm"
                          />
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {openDocs.length > 0 ? (
              <p className="mt-2 text-xs text-slate-500">
                Total outstanding: {formatMoney(totalOutstanding, currency)}
                {mode === 'manual'
                  ? ` · allocated: ${formatMoney(allocatedTotal, currency)}${
                      Number(amount) > 0 && allocatedTotal > Number(amount)
                        ? ' — exceeds the payment amount!'
                        : ''
                    }`
                  : ''}
              </p>
            ) : null}
          </div>

          <input
            type="hidden"
            name="allocations"
            value={mode === 'manual' && allocations.length ? JSON.stringify(allocations) : ''}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="method">Method</Label>
              <select
                id="method"
                name="method"
                defaultValue="cash"
                className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900"
              >
                <option value="cash">Cash</option>
                <option value="bank_transfer">Bank transfer</option>
                <option value="cheque">Cheque</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="notes">Notes</Label>
              <Input id="notes" name="notes" maxLength={1000} placeholder="Optional note" />
            </div>
          </div>

          <SubmitButton className="w-fit">Record</SubmitButton>
        </form>
      </CardContent>
    </Card>
  );
}
