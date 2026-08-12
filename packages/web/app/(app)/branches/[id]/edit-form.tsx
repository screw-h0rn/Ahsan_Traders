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
  Select,
} from '@at/ui';
import {
  setBranchStatusAction,
  updateBranchAction,
  type BranchActionState,
} from '../actions';
import { SubmitButton } from '@/components/submit-button';
import { FormAlert } from '@/components/form-alert';

const initial: BranchActionState = {};

export type BranchRecord = {
  id: string;
  name: string;
  type: 'branch' | 'warehouse';
  status: 'active' | 'archived';
};

export function BranchEditForm({ branch }: { branch: BranchRecord }) {
  const [state, formAction] = useActionState(updateBranchAction, initial);
  const [statusState, statusAction] = useActionState(setBranchStatusAction, initial);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Details</CardTitle>
        <CardDescription>Rename this location or change its type.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <form action={formAction} className="flex flex-col gap-4">
          <FormAlert error={state.error} message={state.message} />
          <input type="hidden" name="branch_id" value={branch.id} />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" defaultValue={branch.name} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="type">Type</Label>
              <Select id="type" name="type" defaultValue={branch.type}>
                <option value="branch">Branch</option>
                <option value="warehouse">Warehouse</option>
              </Select>
            </div>
          </div>
          <SubmitButton className="w-fit">Save changes</SubmitButton>
        </form>

        <form action={statusAction} className="flex items-center gap-3 border-t border-slate-100 pt-4">
          <FormAlert error={statusState.error} message={statusState.message} />
          <input type="hidden" name="branch_id" value={branch.id} />
          <input
            type="hidden"
            name="status"
            value={branch.status === 'active' ? 'archived' : 'active'}
          />
          <SubmitButton
            variant={branch.status === 'active' ? 'danger' : 'secondary'}
            size="sm"
          >
            {branch.status === 'active' ? 'Archive branch' : 'Restore branch'}
          </SubmitButton>
        </form>
      </CardContent>
    </Card>
  );
}
