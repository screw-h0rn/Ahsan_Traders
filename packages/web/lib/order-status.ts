/**
 * Sales-order status presentation — one source of truth for the list, the
 * detail page and anything else that shows an order.
 *
 * Lifecycle (see 20260802140000_order_status_language.sql). An order is
 * CONFIRMED only once it has actually been acted on — invoice raised, stock
 * deducted, customer debited. Until then it is PENDING.
 *
 *   awaiting_approval -> pending -> confirmed
 *                     \-> held  -/
 *                      \-> cancelled
 */
export type OrderStatus =
  | 'awaiting_approval'
  | 'pending'
  | 'held'
  | 'confirmed'
  | 'cancelled';

type StatusPresentation = { label: string; badge: string; hint: string };

const STATUS: Record<OrderStatus, StatusPresentation> = {
  awaiting_approval: {
    label: 'Awaiting approval',
    badge: 'bg-sky-100 text-sky-800',
    hint: 'A customer placed this order online. Accept it to make it ready to invoice.',
  },
  pending: {
    label: 'Pending',
    badge: 'bg-amber-100 text-amber-800',
    hint: 'Ready to invoice. Stock has not been deducted yet — generating the invoice will deduct it.',
  },
  held: {
    label: 'On hold',
    badge: 'bg-rose-100 text-rose-800',
    hint: 'Blocked by a stock or credit check. Approve to override, or cancel the order.',
  },
  confirmed: {
    label: 'Confirmed',
    badge: 'bg-emerald-100 text-emerald-800',
    hint: 'Invoiced. Stock has been deducted and the customer has been debited.',
  },
  cancelled: {
    label: 'Cancelled',
    badge: 'bg-slate-200 text-slate-700',
    hint: 'This order was cancelled.',
  },
};

const FALLBACK: StatusPresentation = {
  label: 'Unknown',
  badge: 'bg-slate-200 text-slate-700',
  hint: '',
};

export function orderStatus(status: string | null | undefined): StatusPresentation {
  return STATUS[status as OrderStatus] ?? { ...FALLBACK, label: status ?? 'Unknown' };
}

/** Orders an owner/manager can still approve or cancel. */
export function isActionable(status: string | null | undefined): boolean {
  return status === 'awaiting_approval' || status === 'held';
}

/** Orders that can be invoiced (which is what deducts stock). */
export function isInvoiceable(status: string | null | undefined): boolean {
  return status === 'pending';
}
