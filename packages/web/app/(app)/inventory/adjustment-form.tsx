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
import { adjustInventoryAction, type InventoryActionState } from './actions';
const initial: InventoryActionState = {};
export function AdjustmentForm({
  productId,
  branches,
  currentThreshold,
}: {
  productId: string;
  branches: { id: string; name: string }[];
  currentThreshold: number;
}) {
  const [state, action] = useActionState(adjustInventoryAction, initial);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Adjust stock</CardTitle>
        <CardDescription>
          Use a positive quantity to add stock or a negative quantity to remove it.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="flex flex-col gap-4">
          <FormAlert error={state.error} message={state.message} />
          <input type="hidden" name="product_id" value={productId} />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="branch_id">Branch</Label>
              <Select id="branch_id" name="branch_id" required>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="quantity_delta">Quantity change</Label>
              <Input
                id="quantity_delta"
                name="quantity_delta"
                type="number"
                step="0.001"
                defaultValue={0}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="reorder_threshold">Reorder threshold</Label>
              <Input
                id="reorder_threshold"
                name="reorder_threshold"
                type="number"
                min={0}
                step="0.001"
                defaultValue={currentThreshold}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="notes">Reason / notes</Label>
              <Input id="notes" name="notes" maxLength={500} />
            </div>
          </div>
          <SubmitButton className="w-fit">Update inventory</SubmitButton>
        </form>
      </CardContent>
    </Card>
  );
}
