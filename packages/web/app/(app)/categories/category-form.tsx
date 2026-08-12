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
import { FormAlert } from '@/components/form-alert';
import { SubmitButton } from '@/components/submit-button';
import { createCategoryAction, type CategoryActionState } from './actions';

const initial: CategoryActionState = {};

type ParentOption = { id: string; name: string };

export function CategoryForm({ parents }: { parents: ParentOption[] }) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(createCategoryAction, initial);

  if (!open) {
    return (
      <div className="flex items-center justify-between">
        {state.message && <FormAlert message={state.message} />}
        <Button className="ml-auto" onClick={() => setOpen(true)}>
          Add category
        </Button>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>New category</CardTitle>
        <CardDescription>
          Choose a parent to nest this category, or leave it at the top level.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="flex flex-col gap-4">
          <FormAlert error={state.error} message={state.message} />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="category_name">Name</Label>
              <Input id="category_name" name="name" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="category_parent">Parent category</Label>
              <Select id="category_parent" name="parent_id" defaultValue="">
                <option value="">Top level</option>
                {parents.map((parent) => (
                  <option key={parent.id} value={parent.id}>
                    {parent.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <div className="flex gap-3">
            <SubmitButton>Save category</SubmitButton>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
