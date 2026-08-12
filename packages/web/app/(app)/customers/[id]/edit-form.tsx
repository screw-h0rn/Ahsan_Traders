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
} from '@at/ui';
import {
  setCustomerStatusAction,
  updateCustomerAction,
  type CustomerActionState,
} from '../actions';
import { SubmitButton } from '@/components/submit-button';
import { FormAlert } from '@/components/form-alert';

const initial: CustomerActionState = {};

export type CustomerRecord = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  opening_balance: number;
  credit_limit: number | null;
  notes: string | null;
  status: string;
};

export function CustomerEditForm({ customer }: { customer: CustomerRecord }) {
  const [state, formAction] = useActionState(updateCustomerAction, initial);
  const [statusState, statusAction] = useActionState(setCustomerStatusAction, initial);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Details</CardTitle>
        <CardDescription>Edit contact info, opening balance, and credit limit.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <form action={formAction} className="flex flex-col gap-4">
          <FormAlert error={state.error} message={state.message} />
          <input type="hidden" name="customer_id" value={customer.id} />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" defaultValue={customer.name} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" name="phone" defaultValue={customer.phone ?? ''} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" defaultValue={customer.email ?? ''} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="opening_balance">Opening balance</Label>
              <Input
                id="opening_balance"
                name="opening_balance"
                type="number"
                step="0.01"
                defaultValue={customer.opening_balance}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="credit_limit">Credit limit</Label>
              <Input
                id="credit_limit"
                name="credit_limit"
                type="number"
                step="0.01"
                min={0}
                defaultValue={customer.credit_limit ?? ''}
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="address">Address</Label>
            <Input id="address" name="address" defaultValue={customer.address ?? ''} />
          </div>
          <SubmitButton className="w-fit">Save changes</SubmitButton>
        </form>

        <form action={statusAction} className="flex items-center gap-3 border-t border-slate-100 pt-4">
          <FormAlert error={statusState.error} message={statusState.message} />
          <input type="hidden" name="customer_id" value={customer.id} />
          <input
            type="hidden"
            name="status"
            value={customer.status === 'active' ? 'archived' : 'active'}
          />
          <SubmitButton
            variant={customer.status === 'active' ? 'danger' : 'secondary'}
            size="sm"
          >
            {customer.status === 'active' ? 'Archive customer' : 'Restore customer'}
          </SubmitButton>
        </form>
      </CardContent>
    </Card>
  );
}
