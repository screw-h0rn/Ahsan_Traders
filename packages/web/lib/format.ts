/** Format a monetary amount, e.g. formatMoney(250000, 'PKR') → "PKR 250,000.00". */
export function formatMoney(amount: number, currency = 'PKR'): string {
  return `${currency} ${new Intl.NumberFormat('en-PK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)}`;
}

/** Format an ISO date as a short readable date, e.g. "8 Jul 2026". */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Format a document-line quantity in the unit it was sold/bought in.
 * Carton lines show the base-unit equivalent: "5 ctn (60 piece)".
 */
export function formatLineQuantity(line: {
  uom?: string | null;
  qty_entered?: number | null;
  quantity: number;
  unit?: string | null;
}): string {
  const unit = line.unit ?? 'unit';
  const entered = line.qty_entered ?? line.quantity;
  if (line.uom === 'carton') {
    return `${entered} ctn (${line.quantity} ${unit})`;
  }
  return `${entered} ${unit}`;
}

/** Product display name including the variant label, e.g. "Nimko — Rs 10". */
export function productLabel(name?: string | null, variantLabel?: string | null): string {
  if (!name) return '';
  return variantLabel ? `${name} — ${variantLabel}` : name;
}
