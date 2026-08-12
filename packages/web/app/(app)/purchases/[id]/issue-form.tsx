'use client';
import { useActionState } from 'react';
import { FormAlert } from '@/components/form-alert';
import { SubmitButton } from '@/components/submit-button';
import { issuePurchaseOrderAction, type PurchaseActionState } from '../actions';
const initial: PurchaseActionState = {};
export function IssueForm({ id }: { id: string }) {
  const [state, action] = useActionState(issuePurchaseOrderAction, initial);
  return (
    <form action={action} className="flex items-center gap-3">
      <FormAlert error={state.error} message={state.message} />
      <input type="hidden" name="purchase_order_id" value={id} />
      <SubmitButton>Issue to supplier</SubmitButton>
    </form>
  );
}
