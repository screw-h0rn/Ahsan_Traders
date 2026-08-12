'use server';

/**
 * Authentication.
 *
 * There is deliberately NO public sign-up. This is one business: the first
 * account bootstraps as owner, and everyone after that arrives by invitation
 * from the Team page. A stranger who somehow creates an auth account lands
 * with no staff row and therefore sees nothing.
 */

import { redirect } from 'next/navigation';
import { emailSchema } from '@at/shared';
import { createClient } from '@/lib/supabase/server';
import { getSiteUrl } from '@/lib/site-url';

export type AuthState = { error?: string; message?: string };

const MIN_PASSWORD = 8;

function isRedirectError(error: unknown): boolean {
  return error instanceof Error && 'digest' in error && error.digest === 'NEXT_REDIRECT';
}

function getAuthErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return 'Authentication service is unavailable right now.';
}

export async function signInAction(_prev: AuthState, formData: FormData): Promise<AuthState> {
  // 1. Create a variable to hold the destination path
  let redirectPath: string | null = null;

  try {
    const email = emailSchema.safeParse(formData.get('email'));
    const password = String(formData.get('password') ?? '');

    if (!email.success) return { error: 'Enter a valid email address.' };
    if (!password) return { error: 'Enter your password.' };

    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: email.data,
      password,
    });

    if (error) return { error: error.message };

    // Users with a verified TOTP factor must present a code before the session
    // is allowed past the proxy (which enforces aal2 on every request).
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    
    // 2. Set the path instead of calling redirect() here
    if (aal?.nextLevel === 'aal2' && aal.nextLevel !== aal.currentLevel) {
      redirectPath = '/mfa';
    } else {
      redirectPath = '/dashboard';
    }
  } catch (error) {
    console.error('Sign in failed', error);
    return { error: getAuthErrorMessage(error) };
  }

  // 3. Execute the redirect entirely OUTSIDE the try...catch block
  if (redirectPath) {
    redirect(redirectPath);
  }
  
  return { error: 'An unexpected error occurred during redirection.' };
}

export async function verifyMfaChallengeAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  try {
    const code = String(formData.get('code') ?? '').replace(/\s/g, '');
    if (!/^\d{6}$/.test(code)) return { error: 'Enter the 6-digit code from your app.' };

    const supabase = await createClient();
    const { data: factorData } = await supabase.auth.mfa.listFactors();
    const factor = factorData?.all?.find((f) => f.status === 'verified');
    if (!factor) return { error: 'No authenticator is enrolled on this account.' };

    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
      factorId: factor.id,
    });
    if (challengeError) return { error: challengeError.message };

    const { error } = await supabase.auth.mfa.verify({
      factorId: factor.id,
      challengeId: challenge.id,
      code,
    });
    if (error) return { error: 'That code is not valid — check your app and try again.' };

    redirect('/dashboard');
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error('MFA verification failed', error);
    return { error: getAuthErrorMessage(error) };
  }
}

export async function signOutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}

export async function forgotPasswordAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  try {
    const email = emailSchema.safeParse(formData.get('email'));
    if (!email.success) return { error: 'Enter a valid email address.' };

    const supabase = await createClient();
    const siteUrl = await getSiteUrl();

    const { error } = await supabase.auth.resetPasswordForEmail(email.data, {
      redirectTo: `${siteUrl}/auth/confirm?next=/reset-password`,
    });

    if (error) return { error: error.message };
    return { message: 'If that email exists, a password reset link is on its way.' };
  } catch (error) {
    console.error('Forgot password failed', error);
    return { error: getAuthErrorMessage(error) };
  }
}

export async function resetPasswordAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  try {
    const password = String(formData.get('password') ?? '');
    if (password.length < MIN_PASSWORD)
      return { error: `Password must be at least ${MIN_PASSWORD} characters.` };

    const supabase = await createClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return { error: error.message };

    redirect('/dashboard');
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error('Reset password failed', error);
    return { error: getAuthErrorMessage(error) };
  }
}
