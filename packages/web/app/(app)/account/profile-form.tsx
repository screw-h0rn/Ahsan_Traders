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
import { FormAlert } from '@/components/form-alert';
import { SubmitButton } from '@/components/submit-button';
import { updateProfileAction, type AccountActionState } from './actions';

const initial: AccountActionState = {};

export function ProfileForm({ fullName, email }: { fullName: string; email: string }) {
  const [state, action] = useActionState(updateProfileAction, initial);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
        <CardDescription>How your name appears across the workspace.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="flex flex-col gap-4">
          <FormAlert error={state.error} message={state.message} />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="full_name">Full name</Label>
              <Input id="full_name" name="full_name" defaultValue={fullName} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="acc_email">Email</Label>
              <Input id="acc_email" value={email} disabled />
            </div>
          </div>
          <SubmitButton className="w-fit">Save profile</SubmitButton>
        </form>
      </CardContent>
    </Card>
  );
}
