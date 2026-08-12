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
import { createSupplierAction, type SupplierActionState } from './actions';
import { SubmitButton } from '@/components/submit-button';
import { FormAlert } from '@/components/form-alert';

const initial: SupplierActionState = {};

function selectOnFocus(e: React.FocusEvent<HTMLInputElement>) {
  e.target.select();
}

export function SupplierForm() {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(createSupplierAction, initial);

  if (!open) {
    return (
      <div className="flex items-center justify-between">
        {state.message && <FormAlert message={state.message} />}
        <Button className="ml-auto" onClick={() => setOpen(true)}>
          Add supplier
        </Button>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>New supplier</CardTitle>
        <CardDescription>
          Opening balance is what you currently owe them (use a negative number if
          they owe you).
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="flex flex-col gap-4">
          <FormAlert error={state.error} message={state.message} />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sup_name">Name</Label>
              <Input id="sup_name" name="name" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sup_phone">Phone</Label>
              <Input id="sup_phone" name="phone" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sup_email">Email</Label>
              <Input id="sup_email" name="email" type="email" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sup_opening">Opening balance</Label>
              <Input
                id="sup_opening"
                name="opening_balance"
                type="number"
                step="0.01"
                defaultValue={0}
                onFocus={selectOnFocus}

              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sup_address">Address</Label>
            <Input id="sup_address" name="address" />
          </div>
          <div className="flex gap-3">
            <SubmitButton>Save supplier</SubmitButton>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
