'use client';

import { useActionState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label } from '@at/ui';
import { FormAlert } from '@/components/form-alert';
import { SubmitButton } from '@/components/submit-button';
import { receivePurchaseOrderAction, type PurchaseActionState } from '../actions';

type ReceiveLine = {
  id: string;
  remaining_quantity: number;
  products?: {
    name: string;
    sku: string;
    unit: string;
    variant_label?: string | null;
    units_per_carton?: number;
  } | null;
};

function cartonHint(remaining: number, upc?: number) {
  if (!upc || upc <= 1) return null;
  const cartons = Math.floor(remaining / upc);
  const loose = Math.round((remaining % upc) * 1000) / 1000;
  if (cartons <= 0) return null;
  return loose > 0 ? `≈ ${cartons} ctn + ${loose}` : `= ${cartons} ctn`;
}

const initial: PurchaseActionState = {};

function today() {
  return new Date().toISOString().slice(0, 10);
}

export function ReceiveForm({ purchaseOrderId, items }: { purchaseOrderId: string; items: ReceiveLine[] }) {
  const [state, action] = useActionState(receivePurchaseOrderAction, initial);
  const openItems = items.filter((item) => item.remaining_quantity > 0);

  if (!openItems.length) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Receive goods</CardTitle>
        <CardDescription>Record a partial or full GRN against this purchase order.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="flex flex-col gap-4">
          <FormAlert error={state.error} message={state.message} />
          <input type="hidden" name="purchase_order_id" value={purchaseOrderId} />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="received_date">Received date</Label>
              <Input id="received_date" name="received_date" type="date" defaultValue={today()} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="notes">Notes</Label>
              <Input id="notes" name="notes" maxLength={1000} placeholder="Shortage, damage, or supplier note" />
            </div>
          </div>
          <div className="flex flex-col gap-3">
            {openItems.map((item) => (
              <div
                key={item.id}
                className="grid gap-3 rounded-md border border-slate-200 p-3 sm:grid-cols-[2fr_1fr]"
              >
                <div>
                  <p className="font-medium text-slate-900">
                    {item.products?.variant_label
                      ? `${item.products.name} — ${item.products.variant_label}`
                      : item.products?.name}
                  </p>
                  <p className="text-xs text-slate-500">
                    {item.products?.sku} · remaining {item.remaining_quantity} {item.products?.unit}
                    {cartonHint(item.remaining_quantity, item.products?.units_per_carton)
                      ? ` (${cartonHint(item.remaining_quantity, item.products?.units_per_carton)})`
                      : ''}
                  </p>
                  <p className="text-xs text-slate-400">Quantities are received in {item.products?.unit ?? 'base units'}.</p>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor={`qty_${item.id}`}>Qty received</Label>
                  <Input
                    id={`qty_${item.id}`}
                    name="quantity_received"
                    type="number"
                    min={0}
                    step="0.001"
                    defaultValue={item.remaining_quantity}
                  />
                  <input type="hidden" name="purchase_order_item_id" value={item.id} />
                </div>
              </div>
            ))}
          </div>
          <SubmitButton className="w-fit">Record GRN</SubmitButton>
        </form>
      </CardContent>
    </Card>
  );
}