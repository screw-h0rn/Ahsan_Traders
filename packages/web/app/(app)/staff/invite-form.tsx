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
import { inviteStaffAction, type StaffActionState } from './actions';
import { SubmitButton } from '@/components/submit-button';
import { FormAlert } from '@/components/form-alert';

const initial: StaffActionState = {};

export function InviteForm() {
  const [state, formAction] = useActionState(inviteStaffAction, initial);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invite a team member</CardTitle>
        <CardDescription>They join your company with the role you choose.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="flex flex-col gap-4">
          <FormAlert error={state.error} message={state.message} />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="invite_full_name">Name</Label>
              <Input id="invite_full_name" name="full_name" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="invite_email">Email</Label>
              <Input id="invite_email" name="email" type="email" required />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="invite_role">Role</Label>
            <select
              id="invite_role"
              name="role"
              defaultValue="sales"
              className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 focus-visible:border-brand-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              <option value="manager">Manager</option>
              <option value="sales">Sales</option>
              <option value="warehouse">Warehouse</option>
              <option value="accountant">Accountant</option>
            </select>
          </div>
          <SubmitButton className="w-fit">Send invite</SubmitButton>
        </form>
      </CardContent>
    </Card>
  );
}
