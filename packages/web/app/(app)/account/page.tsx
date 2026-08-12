import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getStaffProfile } from '@/lib/auth';
import { ProfileForm } from './profile-form';
import { PasswordForm } from './password-form';
import { MfaManager, type MfaFactor } from './mfa-manager';

export default async function AccountPage() {
  const caller = await getStaffProfile();
  if (!caller) redirect('/login');

  const supabase = await createClient();
  const { data: factorData } = await supabase.auth.mfa.listFactors();
  const factors: MfaFactor[] = (factorData?.all ?? []).map((f) => ({
    id: f.id,
    friendly_name: f.friendly_name ?? null,
    status: f.status,
    created_at: f.created_at,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">My account</h1>
        <p className="text-slate-500">Your profile, password, and sign-in security.</p>
      </div>

      <ProfileForm fullName={caller.full_name ?? ''} email={caller.email ?? ''} />
      <PasswordForm />
      <MfaManager factors={factors} />
    </div>
  );
}
