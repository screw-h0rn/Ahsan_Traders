'use server';

import { revalidatePath } from 'next/cache';
import { uuidSchema, z, optionalArg } from '@at/shared';
import { requirePermission } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export type TransferActionState = { error?: string; message?: string };

export async function createTransferAction(
  _prev: TransferActionState,
  formData: FormData,
): Promise<TransferActionState> {
  if (!(await requirePermission('inventory.adjust'))) {
    return { error: 'You are not allowed to transfer stock.' };
  }

  const from = uuidSchema.safeParse(formData.get('from_branch_id'));
  const to = uuidSchema.safeParse(formData.get('to_branch_id'));
  if (!from.success || !to.success) return { error: 'Choose both branches.' };
  if (from.data === to.data) {
    return { error: 'Source and destination must be different branches.' };
  }

  const productIds = formData.getAll('product_id');
  const quantities = formData.getAll('quantity');
  if (!productIds.length || productIds.length !== quantities.length) {
    return { error: 'Add at least one complete line.' };
  }
  const lineSchema = z.object({
    product_id: uuidSchema,
    quantity:  
    z.coerce
    .number()
    .int('Quantity must be a whole number')
    .min(1, 'Quantity must be at least 1'),
  });
  const lines = [];
  for (let index = 0; index < productIds.length; index += 1) {
    const parsed = lineSchema.safeParse({
      product_id: productIds[index],
      quantity: quantities[index],
    });
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Check line values.' };
    lines.push(parsed.data);
  }

  const notes = String(formData.get('notes') ?? '').trim() || undefined;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('create_stock_transfer', {
    p_from_branch_id: from.data,
    p_to_branch_id: to.data,
    p_notes: optionalArg(notes),
    p_items: lines,
  });
  if (error) return { error: error.message };

  revalidatePath('/transfers');
  revalidatePath('/inventory');
  return { message: `Transfer ${data?.[0]?.transfer_number ?? ''} created — stock is now in transit.` };
}

export async function receiveTransferAction(
  _prev: TransferActionState,
  formData: FormData,
): Promise<TransferActionState> {
  if (!(await requirePermission('inventory.adjust'))) {
    return { error: 'You are not allowed to receive transfers.' };
  }
  const id = uuidSchema.safeParse(formData.get('transfer_id'));
  if (!id.success) return { error: 'Invalid transfer.' };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('receive_stock_transfer', {
    p_stock_transfer_id: id.data,
  });
  if (error) return { error: error.message };

  revalidatePath('/transfers');
  revalidatePath(`/transfers/${id.data}`);
  revalidatePath('/inventory');
  return { message: `Transfer ${data ?? ''} received — destination stock updated.` };
}

export async function cancelTransferAction(
  _prev: TransferActionState,
  formData: FormData,
): Promise<TransferActionState> {
  if (!(await requirePermission('inventory.adjust'))) {
    return { error: 'You are not allowed to cancel transfers.' };
  }
  const id = uuidSchema.safeParse(formData.get('transfer_id'));
  if (!id.success) return { error: 'Invalid transfer.' };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('cancel_stock_transfer', {
    p_stock_transfer_id: id.data,
  });
  if (error) return { error: error.message };

  revalidatePath('/transfers');
  revalidatePath(`/transfers/${id.data}`);
  revalidatePath('/inventory');
  return { message: `Transfer ${data ?? ''} cancelled — stock returned to source.` };
}
