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
} from '@at/ui';
import { createCustomerAction, type CustomerActionState } from './actions';
import { SubmitButton } from '@/components/submit-button';
import { FormAlert } from '@/components/form-alert';

const initial: CustomerActionState = {};

function selectOnFocus(e: React.FocusEvent<HTMLInputElement>) {
  e.target.select();
}

export function CustomerForm() {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(createCustomerAction, initial);

  if (!open) {
    return (
      <div className="flex items-center justify-between">
        {state.message && <FormAlert message={state.message} />}
        <Button className="ml-auto" onClick={() => setOpen(true)}>
          Add customer
        </Button>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>New customer</CardTitle>
        <CardDescription>
          Opening balance is what they currently owe you (use a negative number if
          you owe them). Credit limit 0 means no limit is enforced.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="flex flex-col gap-4">
          <FormAlert error={state.error} message={state.message} />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cus_name">Name</Label>
              <Input id="cus_name" name="name" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cus_phone">Phone</Label>
              <Input id="cus_phone" name="phone" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cus_email">Email</Label>
              <Input id="cus_email" name="email" type="email" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cus_opening">Opening balance</Label>
              <Input
                id="cus_opening"
                name="opening_balance"
                type="number"
                step="0.01"
                defaultValue={0}
                onFocus={selectOnFocus}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cus_credit">Credit limit</Label>
              <Input
                id="cus_credit"
                name="credit_limit"
                type="number"
                step="0.01"
                min={0}
                defaultValue={0}
                onFocus={selectOnFocus}
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cus_address">Address</Label>
            <Input id="cus_address" name="address" />
          </div>
          <div className="flex gap-3">
            <SubmitButton>Save customer</SubmitButton>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}