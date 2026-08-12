'use server';

import { revalidatePath } from 'next/cache';
import { uuidSchema, z, optionalArg } from '@at/shared';
import { requirePermission } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export type PurchaseActionState = { error?: string; message?: string };

const receiveLineSchema = z.object({
  purchase_order_item_id: uuidSchema,
  quantity_received: z.coerce.number().min(0),
});

export async function createPurchaseOrderAction(
  _prev: PurchaseActionState,
  formData: FormData,
): Promise<PurchaseActionState> {
  if (!(await requirePermission('purchases.manage'))) {
    return { error: 'You are not allowed to manage purchases.' };
  }
  const supplier = uuidSchema.safeParse(formData.get('supplier_id'));
  const branch = uuidSchema.safeParse(formData.get('branch_id'));
  const productIds = formData.getAll('product_id');
  const uoms = formData.getAll('uom');
  const quantities = formData.getAll('qty_entered');
  const prices = formData.getAll('unit_price');
  if (!supplier.success || !branch.success) return { error: 'Choose a supplier and branch.' };
  if (
    !productIds.length ||
    productIds.length !== quantities.length ||
    productIds.length !== prices.length ||
    productIds.length !== uoms.length
  ) {
    return { error: 'Add at least one complete line.' };
  }
  const lineSchema = z.object({
    product_id: uuidSchema,
    uom: z.enum(['unit', 'carton']),
    qty_entered:  
    z.coerce
    .number()
    .int('Quantity must be a whole number')
    .min(1, 'Quantity must be at least 1'),
    unit_price: z.coerce.number().min(0),
  });
  const lines = [];
  const seen = new Set<string>();
  for (let index = 0; index < productIds.length; index += 1) {
    if (!productIds[index]) return { error: 'Choose a product on every line.' };
    const parsed = lineSchema.safeParse({
      product_id: productIds[index],
      uom: uoms[index],
      qty_entered: quantities[index],
      unit_price: prices[index],
    });
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Check line values.' };
    const lineKey = `${parsed.data.product_id}:${parsed.data.uom}`;
    if (seen.has(lineKey)) return { error: 'Use each product only once per unit type.' };
    seen.add(lineKey);
    lines.push(parsed.data);
  }
  const expected = String(formData.get('expected_date') ?? '').trim() || undefined;
  const notes = String(formData.get('notes') ?? '').trim() || undefined;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('create_purchase_order', {
    p_supplier_id: optionalArg(supplier.data),
    p_branch_id: optionalArg(branch.data),
    p_expected_date: optionalArg(expected),
    p_notes: optionalArg(notes),
    p_items: lines,
  });
  if (error) return { error: error.message };
  revalidatePath('/purchases');
  return { message: `Purchase order ${data?.[0]?.po_number ?? ''} created.` };
}

export async function issuePurchaseOrderAction(
  _prev: PurchaseActionState,
  formData: FormData,
): Promise<PurchaseActionState> {
  if (!(await requirePermission('purchases.manage'))) {
    return { error: 'You are not allowed to manage purchases.' };
  }
  const id = uuidSchema.safeParse(formData.get('purchase_order_id'));
  if (!id.success) return { error: 'Invalid purchase order.' };
  const supabase = await createClient();
  const { error } = await supabase.rpc('issue_purchase_order', { p_purchase_order_id: id.data });
  if (error) return { error: error.message };
  revalidatePath('/purchases');
  revalidatePath(`/purchases/${id.data}`);
  return { message: 'Purchase order issued.' };
}

export async function receivePurchaseOrderAction(
  _prev: PurchaseActionState,
  formData: FormData,
): Promise<PurchaseActionState> {
  if (!(await requirePermission('purchases.manage'))) {
    return { error: 'You are not allowed to receive purchases.' };
  }

  const id = uuidSchema.safeParse(formData.get('purchase_order_id'));
  if (!id.success) return { error: 'Invalid purchase order.' };

  const receivedDate = String(formData.get('received_date') ?? '').trim() || undefined;
  const itemIds = formData.getAll('purchase_order_item_id');
  const quantities = formData.getAll('quantity_received');
  if (!itemIds.length || itemIds.length !== quantities.length) {
    return { error: 'Add at least one receiving line.' };
  }

  const lines = [];
  for (let index = 0; index < itemIds.length; index += 1) {
    const parsed = receiveLineSchema.safeParse({
      purchase_order_item_id: itemIds[index],
      quantity_received: quantities[index],
    });
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? 'Check line values.' };
    }
    lines.push(parsed.data);
  }

  if (!lines.some((line) => line.quantity_received > 0)) {
    return { error: 'Receive at least one unit.' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('receive_purchase_order', {
    p_purchase_order_id: id.data,
    p_received_date: optionalArg(receivedDate),
    p_notes: optionalArg(String(formData.get('notes') ?? '').trim() || null),
    p_items: lines,
  });
  if (error) return { error: error.message };

  revalidatePath('/purchases');
  revalidatePath(`/purchases/${id.data}`);
  return { message: `GRN ${data?.[0]?.grn_number ?? ''} recorded.` };
}
