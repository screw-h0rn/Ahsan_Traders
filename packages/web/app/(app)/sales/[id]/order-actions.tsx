'use client';

import { useActionState } from 'react';
import { FormAlert } from '@/components/form-alert';
import { SubmitButton } from '@/components/submit-button';
import {
  approveSalesOrderAction,
  cancelSalesOrderAction,
  type SalesActionState,
} from '../actions';

const initial: SalesActionState = {};

/**
 * Approve / cancel controls for an order that is still pending or on hold.
 * Without these, an order that failed a stock or credit check — or one placed
 * through the retailer marketplace — had no way forward in the portal at all.
 */
export function OrderActions({
  salesOrderId,
  status,
  holdReason,
}: {
  salesOrderId: string;
  status: string;
  holdReason: string | null;
}) {
  const [approveState, approve] = useActionState(approveSalesOrderAction, initial);
  const [cancelState, cancel] = useActionState(cancelSalesOrderAction, initial);

  const isHeld = status === 'held';

  return (
    <div className="flex flex-col gap-3">
      <FormAlert
        error={approveState.error ?? cancelState.error}
        message={approveState.message ?? cancelState.message}
      />

      {isHeld && holdReason ? (
        <p className="text-sm text-amber-800">
          Approving overrides this hold: <span className="font-medium">{holdReason}</span>. Orders
          that do not have enough stock cannot be approved.
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <form action={approve}>
          <input type="hidden" name="sales_order_id" value={salesOrderId} />
          <SubmitButton>{isHeld ? 'Approve anyway' : 'Accept order'}</SubmitButton>
        </form>

        <form action={cancel} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="sales_order_id" value={salesOrderId} />
          <input
            type="text"
            name="reason"
            placeholder="Reason (optional)"
            className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 placeholder:text-slate-400"
          />
          <SubmitButton variant="danger" size="sm">
            Cancel order
          </SubmitButton>
        </form>
      </div>
    </div>
  );
}
