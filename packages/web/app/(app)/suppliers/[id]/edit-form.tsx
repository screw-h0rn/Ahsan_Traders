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
  setSupplierStatusAction,
  updateSupplierAction,
  type SupplierActionState,
} from '../actions';
import { SubmitButton } from '@/components/submit-button';
import { FormAlert } from '@/components/form-alert';

const initial: SupplierActionState = {};

export type SupplierRecord = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  opening_balance: number;
  notes: string | null;
  status: string;
};

export function SupplierEditForm({ supplier }: { supplier: SupplierRecord }) {
  const [state, formAction] = useActionState(updateSupplierAction, initial);
  const [statusState, statusAction] = useActionState(setSupplierStatusAction, initial);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Details</CardTitle>
        <CardDescription>Edit contact info and opening balance.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <form action={formAction} className="flex flex-col gap-4">
          <FormAlert error={state.error} message={state.message} />
          <input type="hidden" name="supplier_id" value={supplier.id} />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" defaultValue={supplier.name} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" name="phone" defaultValue={supplier.phone ?? ''} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" defaultValue={supplier.email ?? ''} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="opening_balance">Opening balance</Label>
              <Input
                id="opening_balance"
                name="opening_balance"
                type="number"
                step="0.01"
                defaultValue={supplier.opening_balance}
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="address">Address</Label>
            <Input id="address" name="address" defaultValue={supplier.address ?? ''} />
          </div>
          <SubmitButton className="w-fit">Save changes</SubmitButton>
        </form>

        <form action={statusAction} className="flex items-center gap-3 border-t border-slate-100 pt-4">
          <FormAlert error={statusState.error} message={statusState.message} />
          <input type="hidden" name="supplier_id" value={supplier.id} />
          <input
            type="hidden"
            name="status"
            value={supplier.status === 'active' ? 'archived' : 'active'}
          />
          <SubmitButton
            variant={supplier.status === 'active' ? 'danger' : 'secondary'}
            size="sm"
          >
            {supplier.status === 'active' ? 'Archive supplier' : 'Restore supplier'}
          </SubmitButton>
        </form>
      </CardContent>
    </Card>
  );
}
