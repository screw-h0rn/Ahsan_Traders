'use client';

import { useActionState } from 'react';
import {
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
import { createPurchaseOrderAction, type PurchaseActionState } from './actions';

const initial: PurchaseActionState = {};
type Option = { id: string; name: string };

export function PurchaseOrderForm({
  suppliers,
  branches,
  products,
  currency,
}: {
  suppliers: Option[];
  branches: Option[];
  products: PickerProduct[];
  currency: string;
}) {
  const [state, action] = useActionState(createPurchaseOrderAction, initial);
  return (
    <Card>
      <CardHeader>
        <CardTitle>New purchase order</CardTitle>
        <CardDescription>Create a draft with one or more product lines.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="flex flex-col gap-4">
          <FormAlert error={state.error} message={state.message} />
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="supplier_id">Supplier</Label>
              <Select id="supplier_id" name="supplier_id" required>
                <option value="">Choose supplier</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="branch_id">Deliver to</Label>
              <Select id="branch_id" name="branch_id" required>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="expected_date">Expected date</Label>
              <Input id="expected_date" name="expected_date" type="date" />
            </div>
          </div>
          <LineItemsEditor products={products} priceMode="purchase" currency={currency} />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Input id="notes" name="notes" maxLength={1000} />
          </div>
          <SubmitButton className="w-fit">Create draft PO</SubmitButton>
        </form>
      </CardContent>
    </Card>
  );
}
