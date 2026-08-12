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
import { updateWhatsAppIntegrationAction, type SettingsActionState } from './actions';

const initial: SettingsActionState = {};

export function WhatsAppForm({
  configured,
  phoneNumberId,
}: {
  configured: boolean;
  phoneNumberId: string | null;
}) {
  const [state, action] = useActionState(updateWhatsAppIntegrationAction, initial);

  return (
    <Card>
      <CardHeader>
        <CardTitle>WhatsApp integration</CardTitle>
        <CardDescription>
          Connect your Meta WhatsApp Cloud API account to send invoices and receipts to
          customers directly from the app.{' '}
          {configured ? (
            <span className="font-medium text-emerald-600">Connected.</span>
          ) : (
            <span className="text-slate-500">
              Not connected — “Send on WhatsApp” share links still work without this.
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="flex flex-col gap-4">
          <FormAlert error={state.error} message={state.message} />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="phone_number_id">Phone Number ID</Label>
              <Input
                id="phone_number_id"
                name="phone_number_id"
                defaultValue={phoneNumberId ?? ''}
                placeholder="From Meta Business → WhatsApp → API setup"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="access_token">Permanent access token</Label>
              <Input
                id="access_token"
                name="access_token"
                type="password"
                placeholder={configured ? '•••••••• (saved — enter to replace)' : 'EAAG…'}
                autoComplete="off"
              />
            </div>
          </div>
          <p className="text-xs text-slate-500">
            The token is stored server-side only and never sent to the browser. Note: outside a
            24-hour customer-service window Meta requires pre-approved template messages; a
            free-form send outside the window will be rejected by Meta and logged here as failed.
            Leave both fields empty and save to disconnect.
          </p>
          <SubmitButton className="w-fit">Save WhatsApp settings</SubmitButton>
        </form>
      </CardContent>
    </Card>
  );
}
