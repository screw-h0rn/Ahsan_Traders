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
import { FormAlert } from '@/components/form-alert';
import { SubmitButton } from '@/components/submit-button';
import {
  setCategoryStatusAction,
  updateCategoryAction,
  type CategoryActionState,
} from '../actions';

const initial: CategoryActionState = {};

type CategoryRecord = {
  id: string;
  name: string;
  parent_id: string | null;
  status: string;
};

type ParentOption = { id: string; name: string };

export function CategoryEditForm({
  category,
  parents,
}: {
  category: CategoryRecord;
  parents: ParentOption[];
}) {
  const [state, formAction] = useActionState(updateCategoryAction, initial);
  const [statusState, statusAction] = useActionState(setCategoryStatusAction, initial);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Details</CardTitle>
        <CardDescription>Rename the category or move it within the hierarchy.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <form action={formAction} className="flex flex-col gap-4">
          <FormAlert error={state.error} message={state.message} />
          <input type="hidden" name="category_id" value={category.id} />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" defaultValue={category.name} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="parent_id">Parent category</Label>
              <Select id="parent_id" name="parent_id" defaultValue={category.parent_id ?? ''}>
                <option value="">Top level</option>
                {parents.map((parent) => (
                  <option key={parent.id} value={parent.id}>
                    {parent.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <SubmitButton className="w-fit">Save changes</SubmitButton>
        </form>

        <form
          action={statusAction}
          className="flex items-center gap-3 border-t border-slate-100 pt-4"
        >
          <FormAlert error={statusState.error} message={statusState.message} />
          <input type="hidden" name="category_id" value={category.id} />
          <input
            type="hidden"
            name="status"
            value={category.status === 'active' ? 'archived' : 'active'}
          />
          <SubmitButton variant={category.status === 'active' ? 'danger' : 'secondary'} size="sm">
            {category.status === 'active' ? 'Archive category' : 'Restore category'}
          </SubmitButton>
        </form>
      </CardContent>
    </Card>
  );
}
