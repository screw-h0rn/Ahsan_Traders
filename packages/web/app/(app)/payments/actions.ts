'use server';

import { revalidatePath } from 'next/cache';
import { uuidSchema, z, optionalArg } from '@at/shared';
import { requirePermission } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export type PaymentActionState = { error?: string; message?: string };

export type OpenDocument = {
  document_id: string;
  document_number: string;
  document_date: string;
  total: number;
  amount_paid: number;
  outstanding: number;
};

const paymentSchema = z.object({
  kind: z.enum(['customer_receipt', 'supplier_payment']),
  party_id: z.string().uuid(),
  amount: z.coerce.number().positive(),
  method: z.enum(['cash', 'bank_transfer', 'cheque', 'other']),
  payment_date: z.string().min(1),
  notes: z.string().max(1000).optional().nullable(),
});

const allocationSchema = z.array(
  z.object({
    document_id: z.string().uuid(),
    amount: z.number().positive(),
  }),
);

export async function recordPaymentAction(
  _prev: PaymentActionState,
  formData: FormData,
): Promise<PaymentActionState> {
  if (!(await requirePermission('finance.manage'))) {
    return { error: 'You are not allowed to record payments.' };
  }

  const parsed = paymentSchema.safeParse({
    kind: formData.get('kind'),
    party_id: formData.get('party_id'),
    amount: formData.get('amount'),
    method: formData.get('method'),
    payment_date: formData.get('payment_date'),
    notes: String(formData.get('notes') ?? '').trim() || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Check the form values.' };

  const { kind, party_id, amount, method, payment_date, notes } = parsed.data;
  const party_type = kind === 'customer_receipt' ? 'customer' : 'supplier';
  const direction = kind === 'customer_receipt' ? 'in' : 'out';

  // Optional manual allocation: JSON array [{document_id, amount}] from the form.
  // Absent/empty → the RPC auto-allocates oldest-first.
  let allocations: { invoice_id?: string; goods_receipt_id?: string; amount: number }[] | null =
    null;
  const rawAllocations = String(formData.get('allocations') ?? '').trim();
  if (rawAllocations) {
    let decoded: unknown;
    try {
      decoded = JSON.parse(rawAllocations);
    } catch {
      return { error: 'Invalid allocation data.' };
    }
    const parsedAllocations = allocationSchema.safeParse(decoded);
    if (!parsedAllocations.success) return { error: 'Invalid allocation data.' };
    const totalAllocated = parsedAllocations.data.reduce((sum, a) => sum + a.amount, 0);
    if (totalAllocated > amount + 0.005) {
      return { error: 'Allocations exceed the payment amount.' };
    }
    allocations = parsedAllocations.data.map((a) =>
      party_type === 'customer'
        ? { invoice_id: a.document_id, amount: a.amount }
        : { goods_receipt_id: a.document_id, amount: a.amount },
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('record_payment', {
    p_party_type: party_type,
    p_party_id: optionalArg(party_id),
    p_direction: direction,
    p_amount: amount,
    p_method: method,
    p_payment_date: optionalArg(payment_date),
    p_notes: notes ?? undefined,
    p_allocations: optionalArg(allocations),
  });

  if (error) return { error: error.message };

  revalidatePath('/payments');
  revalidatePath('/customers');
  revalidatePath('/suppliers');
  revalidatePath('/sales');
  revalidatePath('/purchases');

  const number = data?.[0]?.payment_number ?? '';
  const allocated = data?.[0]?.allocated_amount ?? 0;
  return {
    message: `Payment ${number} recorded${allocated > 0 ? ` — ${allocated} allocated to open documents` : ''}.`,
  };
}

/** Open (not fully paid) invoices/GRNs for a party — feeds the allocation UI. */
export async function getOpenDocumentsAction(
  kind: 'customer_receipt' | 'supplier_payment',
  partyId: string,
): Promise<{ documents?: OpenDocument[]; error?: string }> {
  if (!(await requirePermission('finance.manage'))) {
    return { error: 'Not allowed.' };
  }
  const id = uuidSchema.safeParse(partyId);
  if (!id.success) return { error: 'Invalid party.' };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('open_documents', {
    p_party_type: kind === 'customer_receipt' ? 'customer' : 'supplier',
    p_party_id: optionalArg(id.data),
  });
  if (error) return { error: error.message };
  return { documents: (data ?? []) as OpenDocument[] };
}

/** One-click payment from the invoice page: allocates straight to that invoice. */
export async function recordInvoicePaymentAction(
  _prev: PaymentActionState,
  formData: FormData,
): Promise<PaymentActionState> {
  if (!(await requirePermission('finance.manage'))) {
    return { error: 'You are not allowed to record payments.' };
  }

  const invoiceId = uuidSchema.safeParse(formData.get('invoice_id'));
  if (!invoiceId.success) return { error: 'Invalid invoice.' };

  const schema = z.object({
    amount: z.coerce.number().positive(),
    method: z.enum(['cash', 'bank_transfer', 'cheque', 'other']),
    payment_date: z.string().min(1),
    notes: z.string().max(1000).optional().nullable(),
  });
  const parsed = schema.safeParse({
    amount: formData.get('amount'),
    method: formData.get('method'),
    payment_date: formData.get('payment_date'),
    notes: String(formData.get('notes') ?? '').trim() || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Check the form values.' };

  const supabase = await createClient();
  const { data: invoice, error: invoiceError } = await supabase
    .from('sales_invoices')
    .select('id,customer_id,total,amount_paid')
    .eq('id', invoiceId.data)
    .maybeSingle();
  if (invoiceError || !invoice) return { error: 'Invoice not found.' };

  const outstanding = Math.round((invoice.total - invoice.amount_paid) * 100) / 100;
  if (parsed.data.amount > outstanding) {
    return { error: `Amount exceeds the outstanding balance (${outstanding}).` };
  }

  const { data, error } = await supabase.rpc('record_payment', {
    p_party_type: 'customer',
    p_party_id: optionalArg(invoice.customer_id),
    p_direction: 'in',
    p_amount: parsed.data.amount,
    p_method: parsed.data.method,
    p_payment_date: optionalArg(parsed.data.payment_date),
    p_notes: parsed.data.notes ?? undefined,
    p_allocations: [{ invoice_id: invoice.id, amount: parsed.data.amount }],
  });
  if (error) return { error: error.message };

  const salesOrderId = String(formData.get('sales_order_id') ?? '');
  revalidatePath('/payments');
  revalidatePath('/customers');
  if (salesOrderId) {
    revalidatePath(`/sales/${salesOrderId}`);
    revalidatePath(`/sales/${salesOrderId}/invoice`);
  }
  return { message: `Payment ${data?.[0]?.payment_number ?? ''} recorded against this invoice.` };
}
