'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
} from '@at/ui';
import { signInAction, type AuthState } from '../actions';
import { SubmitButton } from '@/components/submit-button';
import { FormAlert } from '@/components/form-alert';

const initial: AuthState = {};

export default function LoginPage() {
  const [state, formAction] = useActionState(signInAction, initial);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
        <CardDescription>Welcome back. Enter your details to continue.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="flex flex-col gap-4">
          <FormAlert error={state.error} message={state.message} />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" autoComplete="email" required />
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <Link href="/forgot-password" className="text-xs text-brand-600 hover:underline">
                Forgot password?
              </Link>
            </div>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </div>
          <SubmitButton className="mt-2 w-full">Sign in</SubmitButton>
        </form>
      </CardContent>
    </Card>
  );
}
