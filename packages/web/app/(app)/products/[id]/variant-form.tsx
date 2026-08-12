'use client';

import { useActionState, useState } from 'react';
import { Button, Input, Label } from '@at/ui';
import { FormAlert } from '@/components/form-alert';
import { SubmitButton } from '@/components/submit-button';
import { createVariantAction, type ProductActionState } from '../actions';

const initial: ProductActionState = {};

export type VariantDefaults = {
  purchase_price: number;
  sale_price: number;
  carton_sale_price: number | null;
  units_per_carton: number;
  unit: string;
};

export function VariantForm({
  parentId,
  defaults,
}: {
  parentId: string;
  defaults: VariantDefaults;
}) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(createVariantAction, initial);
  if (!open)
    return (
      <div className="flex items-center justify-between">
        {state.message && <FormAlert message={state.message} />}
        <Button className="ml-auto" size="sm" onClick={() => setOpen(true)}>
          Add variant
        </Button>
      </div>
    );
  return (
    <form action={action} className="flex flex-col gap-4 border-t border-slate-100 pt-4">
      <FormAlert error={state.error} message={state.message} />
      <input type="hidden" name="parent_product_id" value={parentId} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="variant_label">Variant label</Label>
          <Input id="variant_label" name="variant_label" required maxLength={50} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="variant_sku">SKU</Label>
          <Input id="variant_sku" name="sku" required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="variant_barcode">Barcode</Label>
          <Input id="variant_barcode" name="barcode" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="variant_purchase_price">Purchase price (per unit)</Label>
          <Input
            id="variant_purchase_price"
            name="purchase_price"
            type="number"
            min={0}
            step="0.01"
            defaultValue={defaults.purchase_price}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="variant_sale_price">Sale price (per unit)</Label>
          <Input
            id="variant_sale_price"
            name="sale_price"
            type="number"
            min={0}
            step="0.01"
            defaultValue={defaults.sale_price}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="variant_carton_sale_price">Carton sale price</Label>
          <Input
            id="variant_carton_sale_price"
            name="carton_sale_price"
            type="number"
            min={0}
            step="0.01"
            defaultValue={defaults.carton_sale_price ?? ''}
          />
          <p className="text-xs text-slate-500">
            Leave empty to use units per carton × sale price.
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="variant_units_per_carton">Units per carton</Label>
          <Input
            id="variant_units_per_carton"
            name="units_per_carton"
            type="number"
            min={1}
            step={1}
            defaultValue={defaults.units_per_carton}
          />
          <p className="text-xs text-slate-500">
            How many {defaults.unit}s one carton contains. 1 = not sold by carton.
          </p>
        </div>
      </div>
      <div className="flex gap-3">
        <SubmitButton>Save variant</SubmitButton>
        <Button variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
