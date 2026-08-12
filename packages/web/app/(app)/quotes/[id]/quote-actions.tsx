'use client';

import { useActionState } from 'react';
import { FormAlert } from '@/components/form-alert';
import { SubmitButton } from '@/components/submit-button';
import {
  convertQuotationAction,
  rejectQuotationAction,
  type QuoteActionState,
} from '../actions';

const initial: QuoteActionState = {};

export function QuoteActions({ quotationId }: { quotationId: string }) {
  const [convertState, convertAction] = useActionState(convertQuotationAction, initial);
  const [rejectState, rejectAction] = useActionState(rejectQuotationAction, initial);

  return (
    <div className="flex flex-col gap-3">
      <FormAlert
        error={convertState.error ?? rejectState.error}
        message={convertState.message ?? rejectState.message}
      />
      <div className="flex flex-wrap items-center gap-3">
        <form action={convertAction}>
          <input type="hidden" name="quotation_id" value={quotationId} />
          <SubmitButton>Accept &amp; convert to sales order</SubmitButton>
        </form>
        <form action={rejectAction}>
          <input type="hidden" name="quotation_id" value={quotationId} />
          <SubmitButton variant="danger" size="sm">
            Mark rejected
          </SubmitButton>
        </form>
      </div>
    </div>
  );
}
