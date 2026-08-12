'use client';

import { useActionState, useState } from 'react';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@at/ui';
import { FormAlert } from '@/components/form-alert';
import { SubmitButton } from '@/components/submit-button';
import { createProductAction, type ProductActionState } from './actions';
import { ProductFields, type CategoryOption } from './product-fields';
const initial: ProductActionState = {};
export function ProductForm({ categories }: { categories: CategoryOption[] }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(createProductAction, initial);
  if (!open)
    return (
      <div className="flex items-center justify-between">
        {state.message && <FormAlert message={state.message} />}
        <Button className="ml-auto" onClick={() => setOpen(true)}>
          Add product
        </Button>
      </div>
    );
  return (
    <Card>
      <CardHeader>
        <CardTitle>New product</CardTitle>
        <CardDescription>Add a catalog item with its buying and selling prices.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="flex flex-col gap-4">
          <FormAlert error={state.error} message={state.message} />
          <ProductFields categories={categories} />
          <div className="flex gap-3">
            <SubmitButton>Save product</SubmitButton>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
