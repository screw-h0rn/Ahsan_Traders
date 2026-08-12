import { roleHasPermission, type Permission, type StaffRole } from '@at/shared';
import { createClient } from './supabase/server';

/**
 * The signed-in employee.
 *
 * This portal is for STAFF ONLY. Shops use the mobile app and have a row in
 * customer_accounts, not staff — so they resolve to null here and see the
 * "no access" screen rather than a half-working portal.
 */
export type StaffProfile = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  role: StaffRole;
  status: 'active' | 'inactive';
};

/**
 * Returns the caller's staff profile, or null when they are not signed in,
 * not an employee, or deactivated.
 *
 * A deactivated employee returns null because current_staff_role() ignores
 * inactive rows, so RLS hides their own record from them.
 */
export async function getStaffProfile(): Promise<StaffProfile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('staff')
    .select('id, full_name, email, phone, role, status')
    .eq('id', user.id)
    .maybeSingle();

  if (!data || data.status !== 'active') return null;
  return data as StaffProfile;
}

/** True when the profile grants the permission. Null-safe for signed-out callers. */
export function can(profile: StaffProfile | null, permission: Permission): boolean {
  if (!profile || profile.status !== 'active') return false;
  return roleHasPermission(profile.role, permission);
}

/**
 * Server-action guard. Returns the profile when it holds the permission,
 * otherwise null:
 *
 *   const caller = await requirePermission('sales.manage');
 *   if (!caller) return { error: 'Not allowed.' };
 *
 * This is a convenience, not the security boundary — every database function
 * re-checks the caller's role for itself.
 */
export async function requirePermission(permission: Permission): Promise<StaffProfile | null> {
  const profile = await getStaffProfile();
  return can(profile, permission) ? profile : null;
}
