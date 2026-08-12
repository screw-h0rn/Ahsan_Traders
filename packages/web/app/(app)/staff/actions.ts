'use server';

import { revalidatePath } from 'next/cache';
import { emailSchema, nameSchema, INVITABLE_ROLES, type StaffRole } from '@at/shared';
import { createAdminClient } from '@/lib/supabase/admin';
import { requirePermission } from '@/lib/auth';
import { getSiteUrl } from '@/lib/site-url';

export type StaffActionState = { error?: string; message?: string };

/** Effectively permanent, used to hard-block a deactivated employee at login. */
const PERMANENT_BAN = '876000h'; // ~100 years
const NO_BAN = 'none';

/**
 * Invite an employee. Owner only.
 *
 * The `staff_invite` flag in the signup metadata is what tells
 * handle_new_user() to create a staff row — without it the account is created
 * with no profile and can see nothing. The role travels in the same metadata,
 * and the database refuses to honour 'owner' there, so this cannot be used to
 * mint a second owner even if the form were tampered with.
 *
 * Primary path is a Supabase invite email. If sending fails (free-tier SMTP
 * limits are a common cause) the account is created directly and the person
 * uses "Forgot password" to set their own password.
 */
export async function inviteStaffAction(
  _prev: StaffActionState,
  formData: FormData,
): Promise<StaffActionState> {
  const caller = await requirePermission('staff.manage');
  if (!caller) return { error: 'You are not allowed to invite people.' };

  const email = emailSchema.safeParse(formData.get('email'));
  const fullName = nameSchema.safeParse(formData.get('full_name'));
  const roleRaw = String(formData.get('role') ?? '');

  if (!email.success) return { error: 'Enter a valid email address.' };
  if (!fullName.success) return { error: 'Enter the person’s name.' };
  if (!INVITABLE_ROLES.includes(roleRaw as StaffRole)) {
    return { error: 'Choose a valid role.' };
  }

  const admin = createAdminClient();
  const siteUrl = await getSiteUrl();
  const metadata = {
    staff_invite: 'true',
    role: roleRaw,
    full_name: fullName.data,
  };

  const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(email.data, {
    data: metadata,
    redirectTo: `${siteUrl}/auth/confirm?next=/reset-password`,
  });

  if (!inviteError) {
    revalidatePath('/staff');
    return { message: `Invite sent to ${email.data}.` };
  }

  if (inviteError.message.toLowerCase().includes('already')) {
    return { error: 'Someone with that email address already has an account.' };
  }

  const { error: createError } = await admin.auth.admin.createUser({
    email: email.data,
    email_confirm: true,
    user_metadata: metadata,
  });
  if (createError) return { error: createError.message };

  revalidatePath('/staff');
  return {
    message: `${email.data} added. The invite email could not be sent, so ask them to use “Forgot password” to set their password.`,
  };
}

/**
 * Deactivate or reactivate an employee. Owner only.
 *
 * Two things happen together: the staff row is flipped, which makes
 * current_staff_role() return NULL and therefore denies every row through RLS;
 * and the auth account is banned, which stops them signing in at all.
 */
export async function setStaffStatusAction(
  _prev: StaffActionState,
  formData: FormData,
): Promise<StaffActionState> {
  const caller = await requirePermission('staff.manage');
  if (!caller) return { error: 'You are not allowed to manage people.' };

  const targetId = String(formData.get('staff_id') ?? '');
  const nextStatus = String(formData.get('status') ?? '');
  if (!targetId || !['active', 'inactive'].includes(nextStatus)) {
    return { error: 'Invalid request.' };
  }
  if (targetId === caller.id) {
    return { error: 'You cannot deactivate your own account.' };
  }

  const admin = createAdminClient();

  const { data: target } = await admin
    .from('staff')
    .select('id, role, full_name')
    .eq('id', targetId)
    .maybeSingle();

  if (!target) return { error: 'That person was not found.' };
  if (target.role === 'owner') {
    return { error: 'The owner account cannot be deactivated.' };
  }

  const { error: updateError } = await admin
    .from('staff')
    .update({ status: nextStatus })
    .eq('id', targetId);
  if (updateError) return { error: updateError.message };

  const { error: banError } = await admin.auth.admin.updateUserById(targetId, {
    ban_duration: nextStatus === 'inactive' ? PERMANENT_BAN : NO_BAN,
  });
  if (banError) {
    return { error: `Status saved, but blocking their login failed: ${banError.message}` };
  }

  revalidatePath('/staff');
  return {
    message:
      nextStatus === 'inactive'
        ? `${target.full_name} deactivated — they can no longer sign in.`
        : `${target.full_name} reactivated.`,
  };
}

/** Change someone's role. Owner only; the owner's own role is fixed. */
export async function setStaffRoleAction(
  _prev: StaffActionState,
  formData: FormData,
): Promise<StaffActionState> {
  const caller = await requirePermission('staff.manage');
  if (!caller) return { error: 'You are not allowed to manage people.' };

  const targetId = String(formData.get('staff_id') ?? '');
  const role = String(formData.get('role') ?? '');
  if (!targetId || !INVITABLE_ROLES.includes(role as StaffRole)) {
    return { error: 'Choose a valid role.' };
  }
  if (targetId === caller.id) {
    return { error: 'You cannot change your own role.' };
  }

  const admin = createAdminClient();
  const { data: target } = await admin
    .from('staff')
    .select('id, role')
    .eq('id', targetId)
    .maybeSingle();

  if (!target) return { error: 'That person was not found.' };
  if (target.role === 'owner') return { error: 'The owner’s role cannot be changed.' };

  const { error } = await admin.from('staff').update({ role }).eq('id', targetId);
  if (error) return { error: error.message };

  revalidatePath('/staff');
  return { message: 'Role updated.' };
}
