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
import { createTransferAction, type TransferActionState } from './actions';

const initial: TransferActionState = {};
type Option = { id: string; name: string };
type Product = Option & { sku: string };

export function TransferForm({
  branches,
  products,
}: {
  branches: Option[];
  products: Product[];
}) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(createTransferAction, initial);
  const [lines, setLines] = useState([0]);

  if (!open) {
    return (
      <div className="flex items-center justify-between">
        {state.message && <FormAlert message={state.message} />}
        <Button className="ml-auto" onClick={() => setOpen(true)}>
          New transfer
        </Button>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>New stock transfer</CardTitle>
        <CardDescription>
          Stock leaves the source immediately and arrives when the destination
          confirms receipt.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="flex flex-col gap-4">
          <FormAlert error={state.error} message={state.message} />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="from_branch_id">From</Label>
              <Select id="from_branch_id" name="from_branch_id" required defaultValue="">
                <option value="">Choose source</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="to_branch_id">To</Label>
              <Select id="to_branch_id" name="to_branch_id" required defaultValue="">
                <option value="">Choose destination</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            {lines.map((key, index) => (
              <div
                key={key}
                className="grid gap-3 rounded-md border border-slate-200 p-3 sm:grid-cols-[2fr_1fr_auto]"
              >
                <div>
                  <Label htmlFor={`product_${key}`}>Product</Label>
                  <Select id={`product_${key}`} name="product_id" required defaultValue="">
                    <option value="">Choose product</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} · {p.sku}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label htmlFor={`quantity_${key}`}>Quantity</Label>
                  <Input
                    id={`quantity_${key}`}
                    name="quantity"
                    type="number"
                    min={1}
                    step="1"
                    required
                  />
                </div>
                <Button
                  className="self-end"
                  variant="ghost"
                  disabled={lines.length === 1}
                  onClick={() =>
                    setLines((value) => value.filter((_, itemIndex) => itemIndex !== index))
                  }
                >
                  Remove
                </Button>
              </div>
            ))}
          </div>
          <Button
            className="w-fit"
            variant="outline"
            onClick={() => setLines((value) => [...value, Math.max(...value) + 1])}
          >
            Add line
          </Button>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Input id="notes" name="notes" maxLength={1000} />
          </div>
          <div className="flex gap-3">
            <SubmitButton>Create transfer</SubmitButton>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
