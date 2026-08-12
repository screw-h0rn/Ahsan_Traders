'use client';

import { useActionState, useState } from 'react';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Select,
} from '@at/ui';
import { createBranchAction, type BranchActionState } from './actions';
import { SubmitButton } from '@/components/submit-button';
import { FormAlert } from '@/components/form-alert';

const initial: BranchActionState = {};

export function BranchForm() {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(createBranchAction, initial);

  if (!open) {
    return (
      <div className="flex items-center justify-between">
        {state.message && <FormAlert message={state.message} />}
        <Button className="ml-auto" onClick={() => setOpen(true)}>
          Add branch
        </Button>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>New branch</CardTitle>
        <CardDescription>
          A branch sells and holds stock; a warehouse only holds stock.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="flex flex-col gap-4">
          <FormAlert error={state.error} message={state.message} />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="br_name">Name</Label>
              <Input id="br_name" name="name" required placeholder="e.g. Lahore Depot" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="br_type">Type</Label>
              <Select id="br_type" name="type" defaultValue="branch">
                <option value="branch">Branch</option>
                <option value="warehouse">Warehouse</option>
              </Select>
            </div>
          </div>
          <div className="flex gap-3">
            <SubmitButton>Save branch</SubmitButton>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
