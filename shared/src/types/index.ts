/**
 * Shared domain types for Ahsan Traders.
 *
 * These describe the business, not the database plumbing. Generated Supabase
 * types live in ./database.ts.
 */

/** Employee roles. Stored as a CHECK constraint on public.staff.role. */
export const STAFF_ROLES = {
  OWNER: 'owner',
  MANAGER: 'manager',
  SALES: 'sales',
  WAREHOUSE: 'warehouse',
  ACCOUNTANT: 'accountant',
} as const;

export type StaffRole = (typeof STAFF_ROLES)[keyof typeof STAFF_ROLES];

export const STAFF_ROLE_LABELS: Record<StaffRole, string> = {
  owner: 'Owner',
  manager: 'Manager',
  sales: 'Sales',
  warehouse: 'Warehouse',
  accountant: 'Accountant',
};

/** Roles an owner may hand out. Nobody can be invited as a second owner. */
export const INVITABLE_ROLES: readonly StaffRole[] = ['manager', 'sales', 'warehouse', 'accountant'];

/**
 * A shop's login into the mobile app.
 *
 *   pending  signed up, but not yet matched to a customer record — sees nothing
 *   active   linked and able to order
 *   blocked  access withdrawn
 */
export type CustomerAccountStatus = 'pending' | 'active' | 'blocked';

/**
 * Sales-order lifecycle. An order is CONFIRMED only once it has actually been
 * acted on: invoiced, stock deducted, customer debited. Until then it is
 * PENDING.
 */
export type OrderStatus =
  | 'awaiting_approval'
  | 'pending'
  | 'held'
  | 'confirmed'
  | 'cancelled';

/** Where an order came from. */
export type OrderSource = 'staff' | 'customer_app' | 'field_app' | 'quotation';

/** A party in the ledger is either a customer or a supplier. */
export type PartyType = 'customer' | 'supplier';

export type PaymentDirection = 'in' | 'out';
export type PaymentMethod = 'cash' | 'bank_transfer' | 'cheque' | 'card' | 'other';

/** What a line was entered in. Stock is always counted in base units. */
export type Uom = 'unit' | 'carton';

/** Actions the field app can queue while offline. */
export type MobileSyncActionType = 'BOOK_ORDER' | 'CAPTURE_PAYMENT';
