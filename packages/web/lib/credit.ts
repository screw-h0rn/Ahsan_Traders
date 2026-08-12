import { formatMoney } from './format';

/**
 * How to read a customer's credit limit.
 *
 *   null  no limit set — they may owe any amount
 *   0     cash only — any outstanding balance blocks a new order
 *   n     capped at n
 *
 * This is the opposite of the old multi-tenant system, where 0 silently meant
 * "unlimited". That is why it is spelled out here rather than compared inline:
 * showing "No limit" for a cash-only customer would be a real commercial
 * mistake, not just a cosmetic one.
 */
export function creditLimitLabel(limit: number | null, currency: string): string {
  if (limit === null) return 'No limit set';
  if (limit === 0) return 'Cash only';
  return formatMoney(limit, currency);
}

/** Short form for a table cell. */
export function creditLimitShort(limit: number | null, currency: string): string {
  if (limit === null) return '—';
  if (limit === 0) return 'Cash only';
  return formatMoney(limit, currency);
}

/**
 * What they may still take on credit. Null when there is no limit.
 * Mirrors customer_available_credit() in the database.
 */
export function availableCredit(limit: number | null, balance: number): number | null {
  if (limit === null) return null;
  return Math.max(limit - balance, 0);
}

export function availableCreditLabel(
  limit: number | null,
  balance: number,
  currency: string,
): string {
  const available = availableCredit(limit, balance);
  if (available === null) return 'Unlimited';
  return formatMoney(available, currency);
}
