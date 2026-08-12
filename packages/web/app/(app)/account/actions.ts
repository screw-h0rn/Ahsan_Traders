'use server';

import { revalidatePath } from 'next/cache';
import { nameSchema } from '@at/shared';
import { createClient } from '@/lib/supabase/server';
import { getStaffProfile } from '@/lib/auth';

export type AccountActionState = {
  error?: string;
  message?: string;
  /** Set by enrollMfaAction so the page can render the QR + verify step. */
  enroll?: { factorId: string; qrSvg: string; secret: string };
};

const MIN_PASSWORD = 8;

export async function updateProfileAction(
  _prev: AccountActionState,
  formData: FormData,
): Promise<AccountActionState> {
  const caller = await getStaffProfile();
  if (!caller) return { error: 'Not signed in.' };

  const name = nameSchema.safeParse(formData.get('full_name'));
  if (!name.success) return { error: 'Enter your name.' };

  const supabase = await createClient();
  // Column-level grants limit authenticated updates on users to full_name only.
  const { error } = await supabase
    .from('staff')
    .update({ full_name: name.data })
    .eq('id', caller.id);
  if (error) return { error: error.message };

  revalidatePath('/account');
  revalidatePath('/', 'layout');
  return { message: 'Profile updated.' };
}

export async function changePasswordAction(
  _prev: AccountActionState,
  formData: FormData,
): Promise<AccountActionState> {
  const caller = await getStaffProfile();
  if (!caller?.email) return { error: 'Not signed in.' };

  const current = String(formData.get('current_password') ?? '');
  const next = String(formData.get('new_password') ?? '');
  const confirm = String(formData.get('confirm_password') ?? '');

  if (!current) return { error: 'Enter your current password.' };
  if (next.length < MIN_PASSWORD) {
    return { error: `New password must be at least ${MIN_PASSWORD} characters.` };
  }
  if (next !== confirm) return { error: 'New passwords do not match.' };
  if (next === current) return { error: 'Choose a password you have not used just now.' };

  const supabase = await createClient();

  // Re-authenticate before allowing the change — a stolen session alone must
  // not be enough to take over the account.
  const { error: reauthError } = await supabase.auth.signInWithPassword({
    email: caller.email,
    password: current,
  });
  if (reauthError) return { error: 'Current password is incorrect.' };

  const { error } = await supabase.auth.updateUser({ password: next });
  if (error) return { error: error.message };

  return { message: 'Password changed.' };
}

export async function enrollMfaAction(
  _prev: AccountActionState,
  _formData: FormData,
): Promise<AccountActionState> {
  void _prev;
  void _formData;

  const supabase = await createClient();

  // Remove any stale unverified factor from an abandoned enrolment first —
  // Supabase allows only a limited number of factors per user.
  const { data: factors } = await supabase.auth.mfa.listFactors();
  for (const factor of factors?.all ?? []) {
    if (factor.status === 'unverified') {
      await supabase.auth.mfa.unenroll({ factorId: factor.id });
    }
  }

  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: 'totp',
    friendlyName: `Authenticator (${new Date().toISOString().slice(0, 10)})`,
  });
  if (error) return { error: error.message };

  return {
    enroll: {
      factorId: data.id,
      qrSvg: data.totp.qr_code,
      secret: data.totp.secret,
    },
  };
}

export async function verifyMfaEnrollmentAction(
  _prev: AccountActionState,
  formData: FormData,
): Promise<AccountActionState> {
  const factorId = String(formData.get('factor_id') ?? '');
  const code = String(formData.get('code') ?? '').replace(/\s/g, '');
  if (!factorId) return { error: 'Start enrolment again.' };
  if (!/^\d{6}$/.test(code)) return { error: 'Enter the 6-digit code from your app.' };

  const supabase = await createClient();
  const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
    factorId,
  });
  if (challengeError) return { error: challengeError.message };

  const { error } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challenge.id,
    code,
  });
  if (error) return { error: 'That code is not valid — check your app and try again.' };

  revalidatePath('/account');
  return { message: 'Two-factor authentication is now enabled. 🎉' };
}

export async function unenrollMfaAction(
  _prev: AccountActionState,
  formData: FormData,
): Promise<AccountActionState> {
  const factorId = String(formData.get('factor_id') ?? '');
  if (!factorId) return { error: 'Invalid factor.' };

  const supabase = await createClient();
  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  if (error) {
    return {
      error:
        'Could not remove the factor. Sign out, sign back in with your code, and try again.',
    };
  }

  revalidatePath('/account');
  return { message: 'Two-factor authentication disabled.' };
}
