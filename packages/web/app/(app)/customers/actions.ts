'use server';

import { revalidatePath } from 'next/cache';
import { phoneNumberSchema, addressSchema, nameSchema, uuidSchema, z } from '@at/shared';
import { createClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/auth';

export type CustomerActionState = { error?: string; message?: string };

const customerSchema = z.object({
  name: nameSchema,
  phone: phoneNumberSchema.optional().or(z.literal('')),
  email: z.string().trim().email().optional().or(z.literal('')),
  address: addressSchema.optional().or(z.literal('')),
  opening_balance: z.coerce.number().finite().default(0),
  credit_limit: z.coerce
    .number()
    .finite()
    .min(0, 'Credit limit cannot be negative')
    .default(0),
  notes: z.string().trim().max(1000).optional().or(z.literal('')),
});

function parseCustomer(formData: FormData) {
  // FormData.get() returns null for absent fields; the schema accepts '' but not null.
  return customerSchema.safeParse({
    name: formData.get('name'),
    phone: formData.get('phone') ?? '',
    email: formData.get('email') ?? '',
    address: formData.get('address') ?? '',
    opening_balance: formData.get('opening_balance') || 0,
    credit_limit: formData.get('credit_limit') || 0,
    notes: formData.get('notes') ?? '',
  });
}

async function customerPhoneExists(
  supabase: Awaited<ReturnType<typeof createClient>>,
  phone: string,
  excludeId?: string,
) {
  if (!phone) return false;

  let query = supabase
    .from('customers')
    .select('id')
    .eq('phone', phone);

  if (excludeId) {
    query = query.neq('id', excludeId);
  }

const { data } = await query.limit(1).maybeSingle();

  return !!data;
}

export async function createCustomerAction(
  _prev: CustomerActionState,
  formData: FormData,
): Promise<CustomerActionState> {
  const caller = await requirePermission('customers.manage');
  if (!caller) return { error: 'You are not allowed to manage customers.' };

  const parsed = parseCustomer(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Check the form values.' };
  }

  const supabase = await createClient();
  // tenant_id defaults to current_tenant_id() in the database.
  if (
  parsed.data.phone &&
  (await customerPhoneExists(supabase, parsed.data.phone))
) {
  return {
    error: 'A customer with this phone number already exists.',
  };
}
  const { error } = await supabase.from('customers').insert({
    name: parsed.data.name,
    phone: parsed.data.phone || null,
    email: parsed.data.email || null,
    address: parsed.data.address || null,
    opening_balance: parsed.data.opening_balance,
    credit_limit: parsed.data.credit_limit,
    notes: parsed.data.notes || null,
  });
  if (error) return { error: error.message };

  revalidatePath('/customers');
  return { message: `Customer “${parsed.data.name}” added.` };
}

export async function updateCustomerAction(
  _prev: CustomerActionState,
  formData: FormData,
): Promise<CustomerActionState> {
  const caller = await requirePermission('customers.manage');
  if (!caller) return { error: 'You are not allowed to manage customers.' };

  const id = uuidSchema.safeParse(formData.get('customer_id'));
  if (!id.success) return { error: 'Invalid customer.' };

  const parsed = parseCustomer(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Check the form values.' };
  }

  const supabase = await createClient();
  if (
  parsed.data.phone &&
  (await customerPhoneExists(
    supabase,
    parsed.data.phone,
    id.data,
  ))
) {
  return {
    error: 'A customer with this phone number already exists.',
  };
}
  const { error } = await supabase
    .from('customers')
    .update({
      name: parsed.data.name,
      phone: parsed.data.phone || null,
      email: parsed.data.email || null,
      address: parsed.data.address || null,
      opening_balance: parsed.data.opening_balance,
      credit_limit: parsed.data.credit_limit,
      notes: parsed.data.notes || null,
    })
    .eq('id', id.data);
  if (error) return { error: error.message };

  revalidatePath('/customers');
  revalidatePath(`/customers/${id.data}`);
  return { message: 'Customer updated.' };
}

export async function setCustomerStatusAction(
  _prev: CustomerActionState,
  formData: FormData,
): Promise<CustomerActionState> {
  const caller = await requirePermission('customers.manage');
  if (!caller) return { error: 'You are not allowed to manage customers.' };

  const id = uuidSchema.safeParse(formData.get('customer_id'));
  const status = String(formData.get('status') ?? '');
  if (!id.success || !['active', 'archived'].includes(status)) {
    return { error: 'Invalid request.' };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from('customers')
    .update({ status: status as 'active' | 'archived' })
    .eq('id', id.data);
  if (error) return { error: error.message };

  revalidatePath('/customers');
  revalidatePath(`/customers/${id.data}`);
  return { message: status === 'archived' ? 'Customer archived.' : 'Customer restored.' };
}
