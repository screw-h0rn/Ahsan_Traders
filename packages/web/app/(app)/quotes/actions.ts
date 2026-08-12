'use server';

import { revalidatePath } from 'next/cache';
import { uuidSchema, z, optionalArg } from '@at/shared';
import { requirePermission } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export type QuoteActionState = { error?: string; message?: string };

export async function createQuotationAction(
  _prev: QuoteActionState,
  formData: FormData,
): Promise<QuoteActionState> {
  if (!(await requirePermission('sales.manage'))) {
    return { error: 'You are not allowed to manage quotations.' };
  }

  const customer = uuidSchema.safeParse(formData.get('customer_id'));
  const branch = uuidSchema.safeParse(formData.get('branch_id'));
  if (!customer.success || !branch.success) return { error: 'Choose a customer and branch.' };

  const productIds = formData.getAll('product_id');
  const uoms = formData.getAll('uom');
  const quantities = formData.getAll('qty_entered');
  const prices = formData.getAll('unit_price');
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

  const validUntil = String(formData.get('valid_until') ?? '').trim() || undefined;
  const notes = String(formData.get('notes') ?? '').trim() || undefined;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('create_quotation', {
    p_customer_id: optionalArg(customer.data),
    p_branch_id: optionalArg(branch.data),
    p_valid_until: optionalArg(validUntil),
    p_notes: optionalArg(notes),
    p_items: lines,
  });
  if (error) return { error: error.message };

  revalidatePath('/quotes');
  return { message: `Quotation ${data?.[0]?.quote_number ?? ''} created.` };
}

export async function convertQuotationAction(
  _prev: QuoteActionState,
  formData: FormData,
): Promise<QuoteActionState> {
  if (!(await requirePermission('sales.manage'))) {
    return { error: 'You are not allowed to convert quotations.' };
  }
  const id = uuidSchema.safeParse(formData.get('quotation_id'));
  if (!id.success) return { error: 'Invalid quotation.' };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('convert_quotation', {
    p_quotation_id: id.data,
  });
  if (error) return { error: error.message };

  revalidatePath('/quotes');
  revalidatePath(`/quotes/${id.data}`);
  revalidatePath('/sales');
  const result = data?.[0];
  return {
    message: `Sales order ${result?.so_number ?? ''} created${
      result?.order_status === 'held' ? ' (held for approval)' : ''
    }.`,
  };
}

export async function rejectQuotationAction(
  _prev: QuoteActionState,
  formData: FormData,
): Promise<QuoteActionState> {
  if (!(await requirePermission('sales.manage'))) {
    return { error: 'You are not allowed to update quotations.' };
  }
  const id = uuidSchema.safeParse(formData.get('quotation_id'));
  if (!id.success) return { error: 'Invalid quotation.' };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('reject_quotation', {
    p_quotation_id: id.data,
  });
  if (error) return { error: error.message };

  revalidatePath('/quotes');
  revalidatePath(`/quotes/${id.data}`);
  return { message: `Quotation ${data ?? ''} rejected.` };
}
