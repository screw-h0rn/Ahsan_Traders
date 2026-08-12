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
import { updateSettingsAction, type SettingsActionState } from './actions';
import { SubmitButton } from '@/components/submit-button';
import { FormAlert } from '@/components/form-alert';

const initial: SettingsActionState = {};

export type TenantSettings = {
  name: string;
  address: string | null;
  phone: string | null;
  currency: string;
  tax_name: string;
  tax_rate: number;
};

export function SettingsForm({ tenant }: { tenant: TenantSettings }) {
  const [state, formAction] = useActionState(updateSettingsAction, initial);

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <FormAlert error={state.error} message={state.message} />

      <Card>
        <CardHeader>
          <CardTitle>Company profile</CardTitle>
          <CardDescription>Shown on invoices and statements.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Company name</Label>
            <Input id="name" name="name" defaultValue={tenant.name} required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="address">Address</Label>
            <Input id="address" name="address" defaultValue={tenant.address ?? ''} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" name="phone" defaultValue={tenant.phone ?? ''} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="currency">Currency</Label>
              <Input
                id="currency"
                name="currency"
                defaultValue={tenant.currency}
                maxLength={3}
                required
              />
              <p className="text-xs text-slate-400">3-letter code, e.g. PKR</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tax</CardTitle>
          <CardDescription>
            Default sales tax applied to invoices. You can adjust per invoice later.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tax_name">Tax name</Label>
            <Input id="tax_name" name="tax_name" defaultValue={tenant.tax_name} required />
            <p className="text-xs text-slate-400">e.g. GST, Sales Tax</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tax_rate">Rate (%)</Label>
            <Input
              id="tax_rate"
              name="tax_rate"
              type="number"
              step="0.01"
              min={0}
              max={100}
              defaultValue={tenant.tax_rate}
              required
            />
          </div>
        </CardContent>
      </Card>

      <SubmitButton className="w-fit">Save settings</SubmitButton>
    </form>
  );
}
