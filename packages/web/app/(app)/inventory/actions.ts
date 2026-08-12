'use server';
import { revalidatePath } from 'next/cache';
import { uuidSchema, z, optionalArg } from '@at/shared';
import { requirePermission } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export type InventoryActionState = { error?: string; message?: string };
const schema = z.object({
  product_id: uuidSchema,
  branch_id: uuidSchema,
  quantity_delta: z.coerce.number().finite(),
  reorder_threshold: z.coerce.number().finite().min(0),
  notes: z.string().trim().max(500).optional().or(z.literal('')),
});
export async function adjustInventoryAction(
  _prev: InventoryActionState,
  formData: FormData,
): Promise<InventoryActionState> {
  if (!(await requirePermission('inventory.adjust')))
    return { error: 'You are not allowed to adjust inventory.' };
  const parsed = schema.safeParse({
    product_id: formData.get('product_id'),
    branch_id: formData.get('branch_id'),
    quantity_delta: formData.get('quantity_delta') || 0,
    reorder_threshold: formData.get('reorder_threshold') || 0,
    notes: formData.get('notes') ?? '',
  });
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? 'Check the form values.' };
  const supabase = await createClient();
  const { error } = await supabase.rpc('adjust_stock', {
    p_product_id: parsed.data.product_id,
    p_branch_id: optionalArg(parsed.data.branch_id),
    p_quantity_delta: parsed.data.quantity_delta,
    p_reorder_threshold: parsed.data.reorder_threshold,
    p_movement_type: 'adjustment',
    p_notes: parsed.data.notes || undefined,
  });
  if (error) return { error: error.message };
  revalidatePath('/inventory');
  revalidatePath(`/inventory/${parsed.data.product_id}`);
  return { message: 'Inventory updated.' };
}
