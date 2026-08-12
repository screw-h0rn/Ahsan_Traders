import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { can, getStaffProfile } from '@/lib/auth';
import { SettingsForm } from './settings-form';
import { WhatsAppForm } from './whatsapp-form';

export default async function SettingsPage() {
  const caller = await getStaffProfile();
  if (!caller) redirect('/login');
  if (!can(caller, 'settings.manage')) redirect('/dashboard');

  const supabase = await createClient();
  const { data: tenant } = await supabase
    .from('company_settings')
    .select('name, address, phone, currency, tax_name, tax_rate')
    .single();

  if (!tenant) redirect('/dashboard');

  // Service-role read: integration_settings has no client grants (token safety).
  // Only a configured flag + the (non-secret) phone number id reach the page.
  const admin = createAdminClient();
  const { data: integration } = await admin
    .from('integration_settings')
    .select('whatsapp_phone_number_id, whatsapp_access_token')
    .eq('id', true)
    .maybeSingle();
  const whatsappConfigured = Boolean(
    integration?.whatsapp_phone_number_id && integration?.whatsapp_access_token,
  );

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Settings</h1>
        <p className="text-slate-500">Company profile, tax, and integrations.</p>
      </div>
      <SettingsForm tenant={tenant} />
      <WhatsAppForm
        configured={whatsappConfigured}
        phoneNumberId={integration?.whatsapp_phone_number_id ?? null}
      />
    </div>
  );
}
