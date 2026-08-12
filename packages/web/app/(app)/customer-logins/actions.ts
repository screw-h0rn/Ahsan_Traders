'use server';

import { revalidatePath } from 'next/cache';
import { optionalArg, uuidSchema } from '@at/shared';
import { requirePermission } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export type CustomerLoginActionState = { error?: string; message?: string };

/**
 * Attach a pending app signup to a customer on file.
 *
 * A shop that signs up with a phone number we already hold is linked
 * automatically. This is for everyone else: a new number, a second branch of an
 * existing shop, or a number that was typed differently. Until it is linked the
 * account can see nothing at all.
 */
export async function linkCustomerLoginAction(
  _prev: CustomerLoginActionState,
  formData: FormData,
): Promise<CustomerLoginActionState> {
  if (!(await requirePermission('customer_accounts.manage'))) {
    return { error: 'You are not allowed to manage customer logins.' };
  }

  const accountId = uuidSchema.safeParse(formData.get('account_id'));
  const customerId = uuidSchema.safeParse(formData.get('customer_id'));
  if (!accountId.success) return { error: 'Invalid login.' };
  if (!customerId.success) return { error: 'Choose which customer this login belongs to.' };

  const supabase = await createClient();
  const { error } = await supabase.rpc('link_customer_account', {
    p_account_id: accountId.data,
    p_customer_id: customerId.data,
  });
  if (error) return { error: error.message };

  revalidatePath('/customer-logins');
  return { message: 'Login linked. They can now order from the app.' };
}

/**
 * Approve a brand-new shopkeeper by creating a customer record and linking it
 * in one step. Values default to what they typed at signup but the owner can
 * override any of them — the fields are pre-filled for convenience, not
 * trusted as-is; a signup form is untrusted input.
 *
 * Leaving credit limit blank is deliberately CASH ONLY (0), not unlimited —
 * unlimited credit must be an explicit choice, never an accidental default
 * for a shop nobody has dealt with before.
 */
export async function approveNewCustomerAction(
  _prev: CustomerLoginActionState,
  formData: FormData,
): Promise<CustomerLoginActionState> {
  if (!(await requirePermission('customer_accounts.manage'))) {
    return { error: 'You are not allowed to manage customer logins.' };
  }

  const accountId = uuidSchema.safeParse(formData.get('account_id'));
  if (!accountId.success) return { error: 'Invalid login.' };

  const name = String(formData.get('name') ?? '').trim();
  if (!name) return { error: 'Enter a shop or customer name.' };
  const phone = String(formData.get('phone') ?? '').trim() || null;
  const address = String(formData.get('address') ?? '').trim() || null;
  const creditLimitRaw = String(formData.get('credit_limit') ?? '').trim();
  const creditLimit = creditLimitRaw === '' ? 0 : Number(creditLimitRaw);
  if (Number.isNaN(creditLimit) || creditLimit < 0) {
    return { error: 'Credit limit must be zero or a positive number.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc('approve_customer_signup', {
    p_account_id: accountId.data,
    p_name: name,
    p_phone: optionalArg(phone),
    p_address: optionalArg(address),
    p_credit_limit: creditLimit,
  });
  if (error) return { error: error.message };

  revalidatePath('/customer-logins');
  revalidatePath('/customers');
  return { message: `${name} created and approved — they can now order from the app.` };
}

/** Withdraw a shop's app access. Nothing is deleted; they simply cannot sign in usefully. */
export async function blockCustomerLoginAction(
  _prev: CustomerLoginActionState,
  formData: FormData,
): Promise<CustomerLoginActionState> {
  if (!(await requirePermission('customer_accounts.manage'))) {
    return { error: 'You are not allowed to manage customer logins.' };
  }

  const accountId = uuidSchema.safeParse(formData.get('account_id'));
  if (!accountId.success) return { error: 'Invalid login.' };

  const supabase = await createClient();
  const { error } = await supabase.rpc('block_customer_account', {
    p_account_id: accountId.data,
  });
  if (error) return { error: error.message };

  revalidatePath('/customer-logins');
  return { message: 'Access withdrawn.' };
}
