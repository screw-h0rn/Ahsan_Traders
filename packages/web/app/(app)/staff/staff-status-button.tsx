'use client';

import { useActionState } from 'react';
import { setStaffStatusAction, type StaffActionState } from './actions';
import { SubmitButton } from '@/components/submit-button';
import { FormAlert } from '@/components/form-alert';

const initial: StaffActionState = {};

export function StaffStatusButton({
  staffId,
  currentStatus,
}: {
  staffId: string;
  currentStatus: 'active' | 'inactive';
}) {
  const [state, formAction] = useActionState(setStaffStatusAction, initial);
  const nextStatus = currentStatus === 'active' ? 'inactive' : 'active';

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="staff_id" value={staffId} />
      <input type="hidden" name="status" value={nextStatus} />
      <FormAlert error={state.error} />
      <SubmitButton
        variant={nextStatus === 'inactive' ? 'danger' : 'secondary'}
        size="sm"
      >
        {nextStatus === 'inactive' ? 'Deactivate' : 'Reactivate'}
      </SubmitButton>
    </form>
  );
}
