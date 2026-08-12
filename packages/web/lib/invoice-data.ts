import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@at/shared';
import { formatDate, formatLineQuantity, formatMoney, productLabel } from './format';

/**
 * Everything needed to render an invoice, in one shape, loaded once.
 *
 * The on-screen invoice, the PDF and the WhatsApp message all have to agree
 * down to the paisa, so they all read through this loader rather than each
 * building their own query.
 */
export type InvoiceLine = {
  label: string;
  sku: string | null;
  quantity: string;
  unitPrice: string;
  unitSuffix: string;
  lineTotal: string;
};

export type InvoiceData = {
  invoiceId: string;
  business: { name: string; address: string | null; phone: string | null };
  customer: { name: string; phone: string | null; address: string | null };
  invoiceNumber: string;
  invoiceDate: string;
  orderNumber: string;
  branchName: string | null;
  currency: string;
  taxName: string;
  taxRate: number;
  lines: InvoiceLine[];
  subtotal: string;
  taxAmount: string;
  total: string;
  amountPaid: string;
  outstanding: string;
  outstandingRaw: number;
  paymentStatus: string;
  notes: string | null;
};

/**
 * Returns null when the order has no posted invoice.
 *
 * Accepts either the RLS-scoped server client or the service-role admin
 * client; both are typed against the same schema.
 */
export async function loadInvoiceData(
  supabase: SupabaseClient<Database>,
  salesOrderId: string,
): Promise<InvoiceData | null> {
  const [{ data: order }, { data: invoice }, { data: tenant }] = await Promise.all([
    supabase
      .from('sales_orders')
      .select('id,so_number,customers(name,phone,address),branches(name)')
      .eq('id', salesOrderId)
      .maybeSingle(),
    supabase
      .from('sales_invoices')
      .select(
        'id,invoice_number,invoice_date,subtotal,tax_rate,tax_amount,total,notes,amount_paid,payment_status',
      )
      .eq('sales_order_id', salesOrderId)
      .maybeSingle(),
    supabase.from('company_settings').select('name,address,phone,currency,tax_name').single(),
  ]);

  if (!order || !invoice) return null;

  // PostgREST returns an embedded to-one relation as an object, but an untyped
  // client widens it to an array. Normalise both shapes.
  const one = <T,>(relation: T | T[] | null | undefined): T | null =>
    Array.isArray(relation) ? (relation[0] ?? null) : (relation ?? null);

  const customer = one<{ name: string; phone: string | null; address: string | null }>(
    order.customers,
  );
  const branch = one<{ name: string }>(order.branches);

  const { data: items } = await supabase
    .from('sales_invoice_items')
    .select('id,quantity,uom,qty_entered,unit_price,line_total,products(name,sku,unit,variant_label)')
    .eq('sales_invoice_id', invoice.id)
    .order('id');

  const currency = tenant?.currency ?? 'PKR';
  const outstandingRaw = Math.round((invoice.total - invoice.amount_paid) * 100) / 100;

  return {
    invoiceId: invoice.id,
    business: {
      name: tenant?.name ?? 'Distribution Platform',
      address: tenant?.address ?? null,
      phone: tenant?.phone ?? null,
    },
    customer: {
      name: customer?.name ?? 'Customer',
      phone: customer?.phone ?? null,
      address: customer?.address ?? null,
    },
    invoiceNumber: invoice.invoice_number,
    invoiceDate: formatDate(invoice.invoice_date),
    orderNumber: order.so_number,
    branchName: branch?.name ?? null,
    currency,
    taxName: tenant?.tax_name ?? 'GST',
    taxRate: invoice.tax_rate,
    lines: (items ?? []).map((item) => {
      const product = one<{
        name: string;
        sku: string | null;
        unit: string | null;
        variant_label: string | null;
      }>(item.products);
      return {
        label: productLabel(product?.name, product?.variant_label),
        sku: product?.sku ?? null,
        quantity: formatLineQuantity({
          uom: item.uom,
          qty_entered: item.qty_entered,
          quantity: item.quantity,
          unit: product?.unit,
        }),
        unitPrice: formatMoney(item.unit_price, currency),
        unitSuffix: item.uom === 'carton' ? 'ctn' : (product?.unit ?? 'unit'),
        lineTotal: formatMoney(item.line_total, currency),
      };
    }),
    subtotal: formatMoney(invoice.subtotal, currency),
    taxAmount: formatMoney(invoice.tax_amount, currency),
    total: formatMoney(invoice.total, currency),
    amountPaid: formatMoney(invoice.amount_paid, currency),
    outstanding: formatMoney(outstandingRaw, currency),
    outstandingRaw,
    paymentStatus: invoice.payment_status,
    notes: invoice.notes ?? null,
  };
}
