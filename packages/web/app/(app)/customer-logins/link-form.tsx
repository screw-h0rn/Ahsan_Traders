'use client';

import { useActionState, useState } from 'react';
import { Input, Select } from '@at/ui';
import { FormAlert } from '@/components/form-alert';
import { SubmitButton } from '@/components/submit-button';
import {
  approveNewCustomerAction,
  blockCustomerLoginAction,
  linkCustomerLoginAction,
  type CustomerLoginActionState,
} from './actions';

const initial: CustomerLoginActionState = {};

export function LinkLoginForm({
  accountId,
  customers,
}: {
  accountId: string;
  customers: { id: string; name: string; phone: string | null }[];
}) {
  const [state, action] = useActionState(linkCustomerLoginAction, initial);

  return (
    <form action={action} className="flex flex-wrap items-center justify-end gap-2">
      <input type="hidden" name="account_id" value={accountId} />
      <Select name="customer_id" defaultValue="" className="min-w-56" required>
        <option value="" disabled>
          …or link to an existing customer
        </option>
        {customers.map((customer) => (
          <option key={customer.id} value={customer.id}>
            {customer.name}
            {customer.phone ? ` · ${customer.phone}` : ''}
          </option>
        ))}
      </Select>
      <SubmitButton size="sm" variant="secondary">
        Link
      </SubmitButton>
      <FormAlert error={state.error} message={state.message} />
    </form>
  );
}

/**
 * Approve a brand-new shopkeeper by creating a customer record from what they
 * typed at signup. Pre-filled but editable — the owner should verify these
 * before approving, not just trust them; anyone can type anything into a
 * signup form.
 */
export function ApproveNewCustomerForm({
  accountId,
  defaultName,
  defaultPhone,
  defaultAddress,
}: {
  accountId: string;
  defaultName: string | null;
  defaultPhone: string | null;
  defaultAddress: string | null;
}) {
  const [state, action] = useActionState(approveNewCustomerAction, initial);
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700"
      >
        Approve as new customer
      </button>
    );
  }

  return (
    <form
      action={action}
      className="flex w-full max-w-xs flex-col gap-2 rounded-md border border-slate-200 bg-slate-50 p-3"
    >
      <input type="hidden" name="account_id" value={accountId} />
      <p className="text-xs font-medium uppercase text-slate-500">Verify before approving</p>
      <Input name="name" defaultValue={defaultName ?? ''} placeholder="Shop / customer name" required />
      <Input name="phone" defaultValue={defaultPhone ?? ''} placeholder="Phone" />
      <Input name="address" defaultValue={defaultAddress ?? ''} placeholder="Address" />
      <Input
        name="credit_limit"
        type="number"
        min={0}
        step="0.01"
        placeholder="Credit limit — blank means cash only"
      />
      <p className="text-xs text-slate-500">
        Leave blank for cash-only (safest default for a new shop). Type a number to allow credit
        up to that amount.
      </p>
      <div className="flex gap-2">
        <SubmitButton size="sm">Create & approve</SubmitButton>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-md px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
        >
          Cancel
        </button>
      </div>
      <FormAlert error={state.error} message={state.message} />
    </form>
  );
}

export function BlockLoginButton({
  accountId,
  label = 'Withdraw access',
}: {
  accountId: string;
  label?: string;
}) {
  const [state, action] = useActionState(blockCustomerLoginAction, initial);

  return (
    <form action={action} className="flex items-center justify-end gap-2">
      <input type="hidden" name="account_id" value={accountId} />
      <SubmitButton variant="danger" size="sm">
        {label}
      </SubmitButton>
      <FormAlert error={state.error} message={state.message} />
    </form>
  );
}
