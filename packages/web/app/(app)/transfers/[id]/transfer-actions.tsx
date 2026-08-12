'use client';

import { useActionState } from 'react';
import { FormAlert } from '@/components/form-alert';
import { SubmitButton } from '@/components/submit-button';
import {
  cancelTransferAction,
  receiveTransferAction,
  type TransferActionState,
} from '../actions';

const initial: TransferActionState = {};

export function TransferActions({ transferId }: { transferId: string }) {
  const [receiveState, receiveAction] = useActionState(receiveTransferAction, initial);
  const [cancelState, cancelAction] = useActionState(cancelTransferAction, initial);

  return (
    <div className="flex flex-col gap-3">
      <FormAlert
        error={receiveState.error ?? cancelState.error}
        message={receiveState.message ?? cancelState.message}
      />
      <div className="flex flex-wrap items-center gap-3">
        <form action={receiveAction}>
          <input type="hidden" name="transfer_id" value={transferId} />
          <SubmitButton>Confirm receipt at destination</SubmitButton>
        </form>
        <form action={cancelAction}>
          <input type="hidden" name="transfer_id" value={transferId} />
          <SubmitButton variant="danger" size="sm">
            Cancel &amp; return to source
          </SubmitButton>
        </form>
      </div>
    </div>
  );
}
