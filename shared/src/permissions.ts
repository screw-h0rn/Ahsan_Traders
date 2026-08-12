/**
 * What each role may do.
 *
 * This drives the navigation and the server-action guards. It is a
 * CONVENIENCE, not the security boundary: every database function re-checks
 * the caller's role itself, so a bug here cannot grant anyone real access.
 *
 * Keep it in step with the role checks in backend/supabase/migrations — if the
 * two disagree, the database wins and the user sees a confusing error.
 *
 * Convention: '<area>.view' to read, '<area>.manage' to change.
 */
import type { StaffRole } from './types/index';

export const PERMISSIONS = [
  'staff.view',
  'staff.manage',
  'settings.manage',
  'suppliers.view',
  'suppliers.manage',
  'customers.view',
  'customers.manage',
  'customer_accounts.manage', // approve / block shop logins for the mobile app
  'catalog.view',
  'catalog.manage',
  'inventory.view',
  'inventory.adjust',
  'branches.manage',
  'purchases.view',
  'purchases.manage',
  'sales.view',
  'sales.manage',
  'sales.approve', // release a held order, accept an app order
  'finance.view',
  'finance.manage',
  'reports.view',
  'audit.view',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const ROLE_PERMISSIONS: Record<StaffRole, readonly Permission[]> = {
  owner: PERMISSIONS,

  manager: [
    'staff.view',
    'suppliers.view',
    'suppliers.manage',
    'customers.view',
    'customers.manage',
    'customer_accounts.manage',
    'catalog.view',
    'catalog.manage',
    'inventory.view',
    'inventory.adjust',
    'branches.manage',
    'purchases.view',
    'purchases.manage',
    'sales.view',
    'sales.manage',
    'sales.approve',
    'finance.view',
    'reports.view',
    'audit.view',
  ],

  // Sells, but never sees what stock costs the business.
  sales: [
    'customers.view',
    'customers.manage',
    'catalog.view',
    'inventory.view',
    'sales.view',
    'sales.manage',
  ],

  warehouse: [
    'catalog.view',
    'inventory.view',
    'inventory.adjust',
    'purchases.view',
    'purchases.manage',
    'suppliers.view',
  ],

  accountant: [
    'suppliers.view',
    'customers.view',
    'purchases.view',
    'sales.view',
    'finance.view',
    'finance.manage',
    'reports.view',
  ],
} as const;

/** True when `role` grants `permission`. */
export function roleHasPermission(role: StaffRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}
