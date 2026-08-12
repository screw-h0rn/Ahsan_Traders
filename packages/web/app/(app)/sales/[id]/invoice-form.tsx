'use client';

import { useActionState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label } from '@at/ui';
import { FormAlert } from '@/components/form-alert';
import { SubmitButton } from '@/components/submit-button';
import { createSalesInvoiceAction, type SalesActionState } from '../actions';

const initial: SalesActionState = {};

function today() {
  return new Date().toISOString().slice(0, 10);
}

export function InvoiceForm({ salesOrderId }: { salesOrderId: string }) {
  const [state, action] = useActionState(createSalesInvoiceAction, initial);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Generate invoice</CardTitle>
        <CardDescription>
          This applies tax, deducts the stock, debits the customer, and moves the order to
          <span className="font-medium"> Confirmed</span>. You can then send the invoice PDF on
          WhatsApp and record payment against it.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="flex flex-col gap-4">
          <FormAlert error={state.error} message={state.message} />
          <input type="hidden" name="sales_order_id" value={salesOrderId} />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="invoice_date">Invoice date</Label>
              <Input id="invoice_date" name="invoice_date" type="date" defaultValue={today()} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="notes">Notes</Label>
              <Input id="notes" name="notes" maxLength={1000} placeholder="Optional invoice note" />
            </div>
          </div>
          <SubmitButton className="w-fit">Generate invoice</SubmitButton>
        </form>
      </CardContent>
    </Card>
  );
}