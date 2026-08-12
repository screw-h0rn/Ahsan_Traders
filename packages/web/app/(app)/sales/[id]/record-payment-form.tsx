'use client';

import { useActionState, useState } from 'react';
import { Button, Input, Label, Select } from '@at/ui';
import { FormAlert } from '@/components/form-alert';
import { SubmitButton } from '@/components/submit-button';
import { formatMoney } from '@/lib/format';
import {
  recordInvoicePaymentAction,
  type PaymentActionState,
} from '../../payments/actions';

const initial: PaymentActionState = {};

function today() {
  return new Date().toISOString().slice(0, 10);
}

export function RecordPaymentForm({
  invoiceId,
  salesOrderId,
  outstanding,
  currency,
}: {
  invoiceId: string;
  salesOrderId: string;
  outstanding: number;
  currency: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(recordInvoicePaymentAction, initial);

  if (!open) {
    return (
      <div className="flex items-center justify-between gap-4">
        {state.message ? <FormAlert message={state.message} /> : <span />}
        <Button className="w-fit" onClick={() => setOpen(true)}>
          Record payment ({formatMoney(outstanding, currency)} due)
        </Button>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-3 rounded-md border border-slate-200 p-4">
      <p className="text-sm font-semibold text-slate-900">Record payment against this invoice</p>
      <FormAlert error={state.error} message={state.message} />
      <input type="hidden" name="invoice_id" value={invoiceId} />
      <input type="hidden" name="sales_order_id" value={salesOrderId} />
      <div className="grid gap-3 sm:grid-cols-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="pay_amount">Amount</Label>
          <Input
            id="pay_amount"
            name="amount"
            type="number"
            min={0.01}
            max={outstanding}
            step="0.01"
            required
            defaultValue={outstanding}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="pay_method">Method</Label>
          <Select id="pay_method" name="method" defaultValue="cash">
            <option value="cash">Cash</option>
            <option value="bank_transfer">Bank transfer</option>
            <option value="cheque">Cheque</option>
            <option value="other">Other</option>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="pay_date">Date</Label>
          <Input id="pay_date" name="payment_date" type="date" defaultValue={today()} required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="pay_notes">Notes</Label>
          <Input id="pay_notes" name="notes" maxLength={1000} />
        </div>
      </div>
      <div className="flex gap-3">
        <SubmitButton className="w-fit">Record payment</SubmitButton>
        <Button variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
