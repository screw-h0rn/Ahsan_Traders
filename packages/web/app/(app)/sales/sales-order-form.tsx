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
import { createSalesOrderAction, type SalesActionState } from './actions';

const initial: SalesActionState = {};
type Option = { id: string; name: string };

export function SalesOrderForm({
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
  const [state, action] = useActionState(createSalesOrderAction, initial);

  return (
    <Card>
      <CardHeader>
        <CardTitle>New sales order</CardTitle>
        <CardDescription>
          Book a sale. The server will confirm it when stock and credit allow it.
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
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="branch_id">Branch</Label>
              <Select id="branch_id" name="branch_id" required>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="notes">Notes</Label>
              <Input id="notes" name="notes" maxLength={1000} />
            </div>
          </div>
          <LineItemsEditor products={products} priceMode="sale" currency={currency} />
          <SubmitButton className="w-fit">Create sales order</SubmitButton>
        </form>
      </CardContent>
    </Card>
  );
}
