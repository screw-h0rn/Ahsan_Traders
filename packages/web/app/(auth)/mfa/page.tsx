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
import { verifyMfaChallengeAction, signOutAction, type AuthState } from '../actions';

const initial: AuthState = {};

export default function MfaChallengePage() {
  const [state, action] = useActionState(verifyMfaChallengeAction, initial);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Two-factor check</CardTitle>
        <CardDescription>
          Enter the 6-digit code from your authenticator app to finish signing in.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="flex flex-col gap-4">
          <FormAlert error={state.error} message={state.message} />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="code">Authentication code</Label>
            <Input
              id="code"
              name="code"
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              placeholder="123456"
              autoFocus
              required
              className="text-center text-lg tracking-[0.4em]"
            />
          </div>
          <SubmitButton>Verify</SubmitButton>
        </form>
        <form action={signOutAction} className="mt-4 text-center">
          <button type="submit" className="text-sm text-slate-500 hover:text-slate-700 hover:underline">
            Use a different account
          </button>
        </form>
      </CardContent>
    </Card>
  );
}
