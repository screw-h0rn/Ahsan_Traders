'use server';

import { revalidatePath } from 'next/cache';
import { nameSchema, z } from '@at/shared';
import { createClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/auth';

export type SettingsActionState = { error?: string; message?: string };

const settingsSchema = z.object({
  name: nameSchema,
  address: z.string().trim().max(500).optional().or(z.literal('')),
  phone: z.string().trim().max(20).optional().or(z.literal('')),
  currency: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/, 'Use a 3-letter currency code (e.g. PKR).'),
  tax_name: z.string().trim().min(1, 'Required').max(30),
  tax_rate: z.coerce
    .number()
    .min(0, 'Cannot be negative')
    .max(100, 'Cannot exceed 100%'),
});

export async function updateSettingsAction(
  _prev: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const caller = await requirePermission('settings.manage');
  if (!caller) return { error: 'You are not allowed to change settings.' };

  const parsed = settingsSchema.safeParse({
    name: formData.get('name'),
    address: formData.get('address'),
    phone: formData.get('phone'),
    currency: formData.get('currency'),
    tax_name: formData.get('tax_name'),
    tax_rate: formData.get('tax_rate'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Check the form values.' };
  }

  const supabase = await createClient();
  // RLS + column grants enforce owner-only writes at the DB layer too.
  const { error } = await supabase
    .from('company_settings')
    .update({
      name: parsed.data.name,
      address: parsed.data.address || null,
      phone: parsed.data.phone || null,
      currency: parsed.data.currency,
      tax_name: parsed.data.tax_name,
      tax_rate: parsed.data.tax_rate,
    })
    .eq('id', true);

  if (error) return { error: error.message };

  revalidatePath('/settings');
  revalidatePath('/dashboard');
  return { message: 'Settings saved.' };
}

const whatsappSchema = z.object({
  phone_number_id: z.string().trim().max(50).optional().or(z.literal('')),
  access_token: z.string().trim().max(500).optional().or(z.literal('')),
});

/**
 * Saves the tenant's WhatsApp Cloud API credentials. Uses the service-role
 * client because integration_settings has no client grants (the token must
 * never be readable from the browser).
 */
export async function updateWhatsAppIntegrationAction(
  _prev: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const caller = await requirePermission('settings.manage');
  if (!caller) return { error: 'You are not allowed to change settings.' };

  const parsed = whatsappSchema.safeParse({
    phone_number_id: formData.get('phone_number_id'),
    access_token: formData.get('access_token'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Check the form values.' };
  }

  const { createAdminClient } = await import('@/lib/supabase/admin');
  const admin = createAdminClient();

  const clearing = !parsed.data.phone_number_id && !parsed.data.access_token;
  if (clearing) {
    const { error } = await admin
      .from('integration_settings')
      .delete()
      .eq('id', true);
    if (error) return { error: error.message };
    revalidatePath('/settings');
    return { message: 'WhatsApp integration disconnected.' };
  }

  if (!parsed.data.phone_number_id || !parsed.data.access_token) {
    return { error: 'Provide both the Phone Number ID and the access token.' };
  }

  const { error } = await admin.from('integration_settings').upsert({
    id: true,
    whatsapp_phone_number_id: parsed.data.phone_number_id,
    whatsapp_access_token: parsed.data.access_token,
    updated_at: new Date().toISOString(),
    updated_by: caller.id,
  });
  if (error) return { error: error.message };

  revalidatePath('/settings');
  return { message: 'WhatsApp integration saved.' };
}
