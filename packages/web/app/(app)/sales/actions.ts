'use server';


import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { uuidSchema, z, optionalArg } from '@at/shared';
import { requirePermission } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export type SalesActionState = { error?: string; message?: string };

const lineSchema = z.object({
  product_id: uuidSchema,
  uom: z.enum(['unit', 'carton']),
  qty_entered:  
  z.coerce
  .number()
  .int('Quantity must be a whole number')
  .min(1, 'Quantity must be at least 1'),
  unit_price: z.coerce.number().min(0),
});

export async function createSalesOrderAction(
  _prev: SalesActionState,
  formData: FormData,
): Promise<SalesActionState> {
  if (!(await requirePermission('sales.manage'))) {
    return { error: 'You are not allowed to manage sales.' };
  }

  const customer = uuidSchema.safeParse(formData.get('customer_id'));
  const branch = uuidSchema.safeParse(formData.get('branch_id'));
  const productIds = formData.getAll('product_id');
  const uoms = formData.getAll('uom');
  const quantities = formData.getAll('qty_entered');
  const prices = formData.getAll('unit_price');
  if (!customer.success || !branch.success) {
    return { error: 'Choose a customer and branch.' };
  }
  if (
    !productIds.length ||
    productIds.length !== quantities.length ||
    productIds.length !== prices.length ||
    productIds.length !== uoms.length
  ) {
    return { error: 'Add at least one complete line.' };
  }

  const lines = [];
  const seen = new Set<string>();
  for (let index = 0; index < productIds.length; index += 1) {
    if (!productIds[index]) return { error: 'Choose a product on every line.' };
    const parsed = lineSchema.safeParse({
      product_id: productIds[index],
      uom: uoms[index],
      qty_entered: quantities[index],
      unit_price: prices[index],
    });
    if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Check line values.' };
    const lineKey = `${parsed.data.product_id}:${parsed.data.uom}`;
    if (seen.has(lineKey)) {
      return { error: 'Use each product only once per unit type.' };
    }
    seen.add(lineKey);
    lines.push(parsed.data);
  }

  const notes = String(formData.get('notes') ?? '').trim() || undefined;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('create_sales_order', {
    p_customer_id: optionalArg(customer.data),
    p_branch_id: optionalArg(branch.data),
    p_notes: optionalArg(notes),
    p_items: lines,
  });
  if (error) return { error: error.message };

  revalidatePath('/sales');
  return { message: `Sales order ${data?.[0]?.so_number ?? ''} created.` };
}

/**
 * Move an awaiting-approval or held order into 'pending' so it can be invoiced.
 * The RPC re-checks stock (an order that cannot be fulfilled is refused) but
 * allows a credit-limit hold to be overridden — that is the owner's call.
 */
export async function approveSalesOrderAction(
  _prev: SalesActionState,
  formData: FormData,
): Promise<SalesActionState> {
  if (!(await requirePermission('sales.manage'))) {
    return { error: 'You are not allowed to approve sales orders.' };
  }

  const orderId = uuidSchema.safeParse(formData.get('sales_order_id'));
  if (!orderId.success) return { error: 'Invalid sales order.' };

  const supabase = await createClient();
  const { error } = await supabase.rpc('approve_sales_order', { p_sales_order_id: orderId.data });
  if (error) return { error: error.message };

  revalidatePath('/sales');
  revalidatePath(`/sales/${orderId.data}`);
  return { message: 'Order accepted — it is now pending and ready to invoice.' };
}

/** Cancel any order that has not been invoiced yet. Confirmed orders are refused. */
export async function cancelSalesOrderAction(
  _prev: SalesActionState,
  formData: FormData,
): Promise<SalesActionState> {
  if (!(await requirePermission('sales.manage'))) {
    return { error: 'You are not allowed to cancel sales orders.' };
  }

  const orderId = uuidSchema.safeParse(formData.get('sales_order_id'));
  if (!orderId.success) return { error: 'Invalid sales order.' };
  const reason = String(formData.get('reason') ?? '').trim() || undefined;

  const supabase = await createClient();
  const { error } = await supabase.rpc('cancel_sales_order', {
    p_sales_order_id: orderId.data,
    p_reason: optionalArg(reason),
  });
  if (error) return { error: error.message };

  revalidatePath('/sales');
  revalidatePath(`/sales/${orderId.data}`);
  return { message: 'Order cancelled.' };
}

export async function createSalesInvoiceAction(
  _prev: SalesActionState,
  formData: FormData,
): Promise<SalesActionState> {
  if (!(await requirePermission('sales.manage'))) {
    return { error: 'You are not allowed to create invoices.' };
  }

  const salesOrderId = uuidSchema.safeParse(formData.get('sales_order_id'));
  if (!salesOrderId.success) return { error: 'Invalid sales order.' };

  const invoiceDate = String(formData.get('invoice_date') ?? '').trim() || undefined;
  const notes = String(formData.get('notes') ?? '').trim() || undefined;
  const supabase = await createClient();
  const { error } = await supabase.rpc('create_sales_invoice', {
    p_sales_order_id: salesOrderId.data,
    p_invoice_date: optionalArg(invoiceDate),
    p_notes: optionalArg(notes),
  });
  if (error) return { error: error.message };

  revalidatePath('/sales');
  revalidatePath(`/sales/${salesOrderId.data}`);
  revalidatePath(`/sales/${salesOrderId.data}/invoice`);
  redirect(`/sales/${salesOrderId.data}/invoice`);
}
export type WhatsAppSendResult = { error?: string; message?: string };

/**
 * Tier-2 WhatsApp: send the invoice to the customer as a PDF **document**
 * (not a text summary) via the tenant's own Cloud API credentials, configured
 * in Settings → WhatsApp. Every attempt is recorded in message_log.
 *
 * The exact same PDF the portal renders and prints is uploaded to WhatsApp's
 * media store and sent as an attachment with a short caption, so the customer
 * receives a document they can save, forward, or print.
 */
export async function sendInvoiceWhatsAppAction(
  salesOrderId: string,
): Promise<WhatsAppSendResult> {
  const caller = await requirePermission('sales.manage');
  if (!caller) return { error: 'You are not allowed to send invoices.' };

  const orderId = uuidSchema.safeParse(salesOrderId);
  if (!orderId.success) return { error: 'Invalid sales order.' };

  const supabase = await createClient();
  const { data: order } = await supabase
    .from('sales_orders')
    .select('id,customer_id,customers(phone)')
    .eq('id', orderId.data)
    .maybeSingle();
  if (!order) return { error: 'Sales order not found.' };

  const phone = order.customers?.phone;
  if (!phone) return { error: 'This customer has no phone number on file.' };

  const { loadInvoiceData } = await import('@/lib/invoice-data');
  const invoice = await loadInvoiceData(supabase, orderId.data);
  if (!invoice) return { error: 'This order has not been invoiced yet.' };

  const { createAdminClient } = await import('@/lib/supabase/admin');
  const admin = createAdminClient();
  const { data: integration } = await admin
    .from('integration_settings')
    .select('whatsapp_phone_number_id,whatsapp_access_token')
    .eq('id', true)
    .maybeSingle();
  if (!integration?.whatsapp_phone_number_id || !integration?.whatsapp_access_token) {
    return {
      error:
        'WhatsApp Cloud API is not configured. The owner can connect it in Settings → WhatsApp. Until then, use "Download PDF" and attach it in WhatsApp yourself.',
    };
  }

  const { buildInvoiceCaption, sendWhatsAppCloudDocument, uploadWhatsAppMedia } = await import(
    '@/lib/whatsapp'
  );
  const { invoiceFileName, renderInvoicePdf } = await import('@/lib/invoice-pdf');

  const fileName = invoiceFileName(invoice.invoiceNumber);
  const pdf = await renderInvoicePdf(invoice);

  const upload = await uploadWhatsAppMedia({
    phoneNumberId: integration.whatsapp_phone_number_id,
    accessToken: integration.whatsapp_access_token,
    file: new Uint8Array(pdf),
    fileName,
    mimeType: 'application/pdf',
  });

  const result = upload.ok
    ? await sendWhatsAppCloudDocument({
        phoneNumberId: integration.whatsapp_phone_number_id,
        accessToken: integration.whatsapp_access_token,
        toPhone: phone,
        mediaId: upload.mediaId,
        fileName,
        caption: buildInvoiceCaption({
          businessName: invoice.business.name,
          invoiceNumber: invoice.invoiceNumber,
          total: invoice.total,
          outstanding: invoice.outstandingRaw > 0 ? invoice.outstanding : null,
        }),
      })
    : { ok: false as const, error: `Could not upload the PDF: ${upload.error}` };

  await admin.from('message_log').insert({
    party_type: 'customer',
    party_id: order.customer_id,
    channel: 'whatsapp_api',
    message_type: 'invoice',
    reference_type: 'sales_invoice',
    reference_id: invoice.invoiceId,
    to_phone: phone,
    status: result.ok ? 'sent' : 'failed',
    error: result.ok ? null : (result.error ?? 'Unknown error'),
    created_by: caller.id,
  });

  if (!result.ok) return { error: `WhatsApp send failed: ${result.error}` };
  return { message: `Invoice PDF sent to ${phone} on WhatsApp.` };
}
