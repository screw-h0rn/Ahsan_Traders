'use client';

import { useState, useTransition } from 'react';
import { Button } from '@at/ui';
import { sendInvoiceWhatsAppAction, type WhatsAppSendResult } from '../actions';

/**
 * Tier-2 sending: uploads the invoice PDF to the tenant's WhatsApp Cloud API
 * account and delivers it as a document attachment.
 *
 * The neighbouring "Share on WhatsApp" button is Tier 1 — it opens wa.me with
 * a text summary. wa.me cannot carry a file attachment, which is a WhatsApp
 * limitation, so sending the actual PDF requires this Cloud API path.
 */
export function SendWhatsAppButton({ salesOrderId }: { salesOrderId: string }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<WhatsAppSendResult | null>(null);

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant="outline"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setResult(await sendInvoiceWhatsAppAction(salesOrderId));
          })
        }
      >
        {pending ? 'Sending PDF…' : 'Send PDF on WhatsApp'}
      </Button>
      {result?.message ? <p className="text-xs text-emerald-600">{result.message}</p> : null}
      {result?.error ? <p className="max-w-60 text-right text-xs text-rose-600">{result.error}</p> : null}
    </div>
  );
}
