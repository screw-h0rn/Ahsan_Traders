'use server';

import { revalidatePath } from 'next/cache';
import { phoneNumberSchema, addressSchema, nameSchema, uuidSchema, z } from '@at/shared';
import { createClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/auth';

export type SupplierActionState = { error?: string; message?: string };

const supplierSchema = z.object({
  name: nameSchema,
  phone: phoneNumberSchema.optional().or(z.literal('')),
  email: z.string().trim().email().optional().or(z.literal('')),
  address: addressSchema.optional().or(z.literal('')),
  opening_balance: z.coerce.number().finite().default(0),
  notes: z.string().trim().max(1000).optional().or(z.literal('')),
});

function parseSupplier(formData: FormData) {
  // FormData.get() returns null for absent fields; the schema accepts '' but not null.
  return supplierSchema.safeParse({
    name: formData.get('name'),
    phone: formData.get('phone') ?? '',
    email: formData.get('email') ?? '',
    address: formData.get('address') ?? '',
    opening_balance: formData.get('opening_balance') || 0,
    notes: formData.get('notes') ?? '',
  });
}

async function supplierPhoneExists(
  supabase: Awaited<ReturnType<typeof createClient>>,
  phone: string,
  excludeId?: string,
) {
  if (!phone) return false;

  let query = supabase
    .from('suppliers')
    .select('id')
    .eq('phone', phone);

  if (excludeId) {
    query = query.neq('id', excludeId);
  }

const { data } = await query.limit(1).maybeSingle();

  return !!data;
}


export async function createSupplierAction(
  _prev: SupplierActionState,
  formData: FormData,
): Promise<SupplierActionState> {
  const caller = await requirePermission('suppliers.manage');
  if (!caller) return { error: 'You are not allowed to manage suppliers.' };

  const parsed = parseSupplier(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Check the form values.' };
  }

  const supabase = await createClient();
  // tenant_id defaults to current_tenant_id() in the database.
  if (
  parsed.data.phone &&
  (await supplierPhoneExists(supabase, parsed.data.phone))
) {
  return {
    error: 'A supplier with this phone number already exists.',
  };
}
  const { error } = await supabase.from('suppliers').insert({
    name: parsed.data.name,
    phone: parsed.data.phone || null,
    email: parsed.data.email || null,
    address: parsed.data.address || null,
    opening_balance: parsed.data.opening_balance,
    notes: parsed.data.notes || null,
  });
  if (error) return { error: error.message };

  revalidatePath('/suppliers');
  return { message: `Supplier “${parsed.data.name}” added.` };
}

export async function updateSupplierAction(
  _prev: SupplierActionState,
  formData: FormData,
): Promise<SupplierActionState> {
  const caller = await requirePermission('suppliers.manage');
  if (!caller) return { error: 'You are not allowed to manage suppliers.' };

  const id = uuidSchema.safeParse(formData.get('supplier_id'));
  if (!id.success) return { error: 'Invalid supplier.' };

  const parsed = parseSupplier(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Check the form values.' };
  }

  const supabase = await createClient();
  if (
  parsed.data.phone &&
  (await supplierPhoneExists(
    supabase,
    parsed.data.phone,
    id.data,
  ))
) {
  return {
    error: 'A supplier with this phone number already exists.',
  };
}
  const { error } = await supabase
    .from('suppliers')
    .update({
      name: parsed.data.name,
      phone: parsed.data.phone || null,
      email: parsed.data.email || null,
      address: parsed.data.address || null,
      opening_balance: parsed.data.opening_balance,
      notes: parsed.data.notes || null,
    })
    .eq('id', id.data);
  if (error) return { error: error.message };

  revalidatePath('/suppliers');
  revalidatePath(`/suppliers/${id.data}`);
  return { message: 'Supplier updated.' };
}

export async function setSupplierStatusAction(
  _prev: SupplierActionState,
  formData: FormData,
): Promise<SupplierActionState> {
  const caller = await requirePermission('suppliers.manage');
  if (!caller) return { error: 'You are not allowed to manage suppliers.' };

  const id = uuidSchema.safeParse(formData.get('supplier_id'));
  const status = String(formData.get('status') ?? '');
  if (!id.success || !['active', 'archived'].includes(status)) {
    return { error: 'Invalid request.' };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('suppliers')
    .update({ status: status as 'active' | 'archived' })
    .eq('id', id.data);
  if (error) return { error: error.message };

  revalidatePath('/suppliers');
  revalidatePath(`/suppliers/${id.data}`);
  return { message: status === 'archived' ? 'Supplier archived.' : 'Supplier restored.' };
}
