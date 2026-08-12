'use client';

import { useActionState, useState } from 'react';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Select,
} from '@at/ui';
import { FormAlert } from '@/components/form-alert';
import { SubmitButton } from '@/components/submit-button';
import { LineItemsEditor, type PickerProduct } from '@/components/line-items-editor';
import { createQuotationAction, type QuoteActionState } from './actions';

const initial: QuoteActionState = {};
type Option = { id: string; name: string };

export function QuoteForm({
  customers,
  branches,
  products,
  currency,
}: {
  customers: Option[];
  branches: Option[];
  products: PickerProduct[];
  currency: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(createQuotationAction, initial);

  if (!open) {
    return (
      <div className="flex items-center justify-between">
        {state.message && <FormAlert message={state.message} />}
        <Button className="ml-auto" onClick={() => setOpen(true)}>
          New quotation
        </Button>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>New quotation</CardTitle>
        <CardDescription>
          A price offer for a customer — stock and credit checks run only when it
          converts to an order.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="flex flex-col gap-4">
          <FormAlert error={state.error} message={state.message} />
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="customer_id">Customer</Label>
              <Select id="customer_id" name="customer_id" required defaultValue="">
                <option value="">Choose customer</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="branch_id">Fulfil from</Label>
              <Select id="branch_id" name="branch_id" required>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="valid_until">Valid until</Label>
              <Input id="valid_until" name="valid_until" type="date" />
            </div>
          </div>

          <LineItemsEditor products={products} priceMode="sale" currency={currency} />

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Input id="notes" name="notes" maxLength={1000} />
          </div>
          <div className="flex gap-3">
            <SubmitButton>Create quotation</SubmitButton>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
