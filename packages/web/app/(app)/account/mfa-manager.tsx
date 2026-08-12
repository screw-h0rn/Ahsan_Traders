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
  cn,
} from '@at/ui';
import { FormAlert } from '@/components/form-alert';
import { SubmitButton } from '@/components/submit-button';
import {
  enrollMfaAction,
  unenrollMfaAction,
  verifyMfaEnrollmentAction,
  type AccountActionState,
} from './actions';

const initial: AccountActionState = {};

export type MfaFactor = {
  id: string;
  friendly_name: string | null;
  status: 'verified' | 'unverified';
  created_at: string;
};

export function MfaManager({ factors }: { factors: MfaFactor[] }) {
  const [enrollState, enrollAction] = useActionState(enrollMfaAction, initial);
  const [verifyState, verifyAction] = useActionState(verifyMfaEnrollmentAction, initial);
  const [unenrollState, unenrollAction] = useActionState(unenrollMfaAction, initial);

  const verified = factors.filter((f) => f.status === 'verified');
  const enrolling = enrollState.enroll && !verifyState.message;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Two-factor authentication</CardTitle>
        <CardDescription>
          Add a 6-digit authenticator code (Google Authenticator, Authy, 1Password…) as a
          second lock on your sign-in.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <FormAlert
          error={enrollState.error ?? verifyState.error ?? unenrollState.error}
          message={verifyState.message ?? unenrollState.message}
        />

        {verified.length > 0 && (
          <div className="flex flex-col gap-3">
            {verified.map((factor) => (
              <div
                key={factor.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white/50 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-slate-900">
                    {factor.friendly_name ?? 'Authenticator app'}
                  </p>
                  <p className="text-xs text-emerald-700">Active — codes required at sign-in</p>
                </div>
                <form action={unenrollAction}>
                  <input type="hidden" name="factor_id" value={factor.id} />
                  <SubmitButton variant="danger" size="sm">
                    Remove
                  </SubmitButton>
                </form>
              </div>
            ))}
          </div>
        )}

        {enrolling ? (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-slate-600">
              1. Scan this QR code with your authenticator app (or enter the secret
              manually). 2. Type the 6-digit code it shows to finish.
            </p>
            <div className="flex flex-wrap items-start gap-6">
              <div
                className={cn('h-44 w-44 rounded-xl border border-slate-200 bg-white p-2')}
                // Supabase returns the QR as a self-contained SVG string.
                dangerouslySetInnerHTML={{ __html: enrollState.enroll!.qrSvg }}
              />
              <div className="flex min-w-60 flex-1 flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
                    Manual secret
                  </span>
                  <code className="break-all rounded-md bg-white/70 px-2 py-1 text-xs">
                    {enrollState.enroll!.secret}
                  </code>
                </div>
                <form action={verifyAction} className="flex items-end gap-3">
                  <input type="hidden" name="factor_id" value={enrollState.enroll!.factorId} />
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="mfa_code">6-digit code</Label>
                    <Input
                      id="mfa_code"
                      name="code"
                      inputMode="numeric"
                      pattern="\d{6}"
                      maxLength={6}
                      placeholder="123456"
                      required
                      className="w-32 text-center tracking-[0.3em]"
                    />
                  </div>
                  <SubmitButton>Verify &amp; enable</SubmitButton>
                </form>
              </div>
            </div>
          </div>
        ) : (
          verified.length === 0 && (
            <form action={enrollAction}>
              <SubmitButton className="w-fit">Set up two-factor authentication</SubmitButton>
            </form>
          )
        )}
      </CardContent>
    </Card>
  );
}
