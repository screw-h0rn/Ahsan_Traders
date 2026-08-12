import { Input, Label, Select } from '@at/ui';
import type { FocusEvent } from 'react';

export const PRODUCT_UNITS = [
  'piece',
  'bottle',
  'carton',
  'box',
  'pack',
  'kg',
  'gram',
  'litre',
  'ml',
  'dozen',
  'meter',
  'bag',
];
export type CategoryOption = { id: string; name: string };
export type ProductValues = {
  name?: string;
  sku?: string;
  barcode?: string | null;
  unit?: string;
  category_id?: string | null;
  purchase_price?: number;
  sale_price?: number;
  units_per_carton?: number;
  carton_sale_price?: number | null;
};

function selectOnFocus(e: FocusEvent<HTMLInputElement>) {
  e.target.select();
}

export function ProductFields({
  categories,
  values = {},
}: {
  categories: CategoryOption[];
  values?: ProductValues;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" defaultValue={values.name} required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="sku">SKU</Label>
        <Input id="sku" name="sku" defaultValue={values.sku} required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="barcode">Barcode</Label>
        <Input id="barcode" name="barcode" defaultValue={values.barcode ?? ''} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="category_id">Category</Label>
        <Select id="category_id" name="category_id" defaultValue={values.category_id ?? ''}>
          <option value="">Uncategorized</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="unit">Unit</Label>
        <Select id="unit" name="unit" defaultValue={values.unit ?? 'piece'}>
          {PRODUCT_UNITS.map((unit) => (
            <option key={unit} value={unit}>
              {unit}
            </option>
          ))}
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="purchase_price">Purchase price (per unit)</Label>
        <Input
          id="purchase_price"
          name="purchase_price"
          type="number"
          min={0}
          step="0.01"
          defaultValue={values.purchase_price ?? 0}
          onFocus={selectOnFocus}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="sale_price">Sale price (per unit)</Label>
        <Input
          id="sale_price"
          name="sale_price"
          type="number"
          min={0}
          step="0.01"
          defaultValue={values.sale_price ?? 0}
          onFocus={selectOnFocus}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="units_per_carton">Units per carton</Label>
        <Input
          id="units_per_carton"
          name="units_per_carton"
          type="number"
          min={1}
          step={1}
          defaultValue={values.units_per_carton ?? 1}
          onFocus={selectOnFocus}
        />
        <p className="text-xs text-slate-500">
          How many {values.unit ?? 'piece'}s one carton contains. 1 = not sold by carton.
        </p>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="carton_sale_price">Carton sale price</Label>
        <Input
          id="carton_sale_price"
          name="carton_sale_price"
          type="number"
          min={0}
          step="0.01"
          defaultValue={values.carton_sale_price ?? ''}
        />
        <p className="text-xs text-slate-500">
          Leave empty to use units per carton × sale price.
        </p>
      </div>
    </div>
  );
}