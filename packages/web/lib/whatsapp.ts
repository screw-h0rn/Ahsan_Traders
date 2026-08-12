/**
 * WhatsApp helpers shared by the share-link (Tier 1) and Cloud API (Tier 2)
 * flows. Phone normalization assumes Pakistan (+92) for local numbers, the
 * platform's primary market: "0300-1234567" → "923001234567".
 */

export function normalizeWhatsAppPhone(raw: string): string | null {
  const digits = raw.replace(/[^\d+]/g, '');
  if (!digits) return null;
  if (digits.startsWith('+')) return digits.slice(1);
  if (digits.startsWith('00')) return digits.slice(2);
  if (digits.startsWith('0')) return `92${digits.slice(1)}`;
  return digits;
}

export function buildWaMeUrl(phone: string, message: string): string | null {
  const normalized = normalizeWhatsAppPhone(phone);
  if (!normalized) return null;
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}

export type InvoiceMessageInput = {
  businessName: string;
  customerName: string;
  invoiceNumber: string;
  invoiceDate: string;
  currency: string;
  lines: { label: string; quantity: string; total: string }[];
  subtotal: string;
  taxLabel: string | null;
  total: string;
  outstanding: string | null;
};

export function buildInvoiceMessage(input: InvoiceMessageInput): string {
  const parts = [
    `*${input.businessName}*`,
    `Invoice ${input.invoiceNumber} — ${input.invoiceDate}`,
    `Customer: ${input.customerName}`,
    '',
    ...input.lines.map((line) => `• ${line.label} — ${line.quantity} = ${line.total}`),
    '',
    `Subtotal: ${input.subtotal}`,
  ];
  if (input.taxLabel) parts.push(input.taxLabel);
  parts.push(`*Total: ${input.total}*`);
  if (input.outstanding) parts.push(`Balance due: ${input.outstanding}`);
  parts.push('', 'Thank you for your business!');
  return parts.join('\n');
}

export function buildReceiptMessage(input: {
  businessName: string;
  customerName: string;
  paymentNumber: string;
  paymentDate: string;
  amount: string;
  method: string;
}): string {
  return [
    `*${input.businessName}*`,
    `Payment receipt ${input.paymentNumber} — ${input.paymentDate}`,
    `Received from: ${input.customerName}`,
    `Amount: *${input.amount}* (${input.method.replace('_', ' ')})`,
    '',
    'Thank you!',
  ].join('\n');
}

const GRAPH = 'https://graph.facebook.com/v20.0';

async function graphError(response: Response): Promise<string> {
  const payload = (await response.json().catch(() => null)) as {
    error?: { message?: string };
  } | null;
  return payload?.error?.message ?? `WhatsApp API returned HTTP ${response.status}.`;
}

/**
 * Upload a file to the tenant's WhatsApp media store and return its media id.
 *
 * Uploading is preferable to sending a public `link`: the PDF never has to be
 * exposed on a publicly reachable URL, so an invoice cannot leak to anyone who
 * guesses the address. Meta keeps the media for 30 days, which is far longer
 * than the few seconds we need before referencing it in a message.
 */
export async function uploadWhatsAppMedia(options: {
  phoneNumberId: string;
  accessToken: string;
  file: Uint8Array;
  fileName: string;
  mimeType: string;
}): Promise<{ ok: true; mediaId: string } | { ok: false; error: string }> {
  try {
    const form = new FormData();
    form.append('messaging_product', 'whatsapp');
    form.append('type', options.mimeType);
    form.append(
      'file',
      new Blob([new Uint8Array(options.file)], { type: options.mimeType }),
      options.fileName,
    );

    const response = await fetch(`${GRAPH}/${options.phoneNumberId}/media`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${options.accessToken}` },
      body: form,
    });
    if (!response.ok) return { ok: false, error: await graphError(response) };

    const payload = (await response.json()) as { id?: string };
    if (!payload.id) return { ok: false, error: 'WhatsApp did not return a media id.' };
    return { ok: true, mediaId: payload.id };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Network error.' };
  }
}

/**
 * Send a previously uploaded document (the invoice PDF) with a short caption.
 *
 * `filename` is what the customer sees in their chat and what WhatsApp uses
 * when they save or forward it, so it carries the invoice number.
 */
export async function sendWhatsAppCloudDocument(options: {
  phoneNumberId: string;
  accessToken: string;
  toPhone: string;
  mediaId: string;
  fileName: string;
  caption: string;
}): Promise<{ ok: boolean; error?: string }> {
  const to = normalizeWhatsAppPhone(options.toPhone);
  if (!to) return { ok: false, error: 'Customer phone number is missing or invalid.' };

  try {
    const response = await fetch(`${GRAPH}/${options.phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${options.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'document',
        document: {
          id: options.mediaId,
          filename: options.fileName,
          caption: options.caption,
        },
      }),
    });
    if (!response.ok) return { ok: false, error: await graphError(response) };
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Network error.' };
  }
}

/** Short caption that accompanies the PDF attachment. */
export function buildInvoiceCaption(input: {
  businessName: string;
  invoiceNumber: string;
  total: string;
  outstanding: string | null;
}): string {
  const parts = [
    `*${input.businessName}*`,
    `Invoice ${input.invoiceNumber} is attached.`,
    `Total: *${input.total}*`,
  ];
  if (input.outstanding) parts.push(`Balance due: ${input.outstanding}`);
  parts.push('Thank you for your business!');
  return parts.join('\n');
}

/**
 * Send a free-form text message through the WhatsApp Cloud API (server-side
 * only — requires the tenant's own phone_number_id + access token).
 *
 * Meta constraint: business-initiated conversations outside a 24-hour customer
 * service window require a pre-approved template; a free-form send outside the
 * window fails with an error we surface and log.
 */
export async function sendWhatsAppCloudMessage(options: {
  phoneNumberId: string;
  accessToken: string;
  toPhone: string;
  body: string;
}): Promise<{ ok: boolean; error?: string }> {
  const to = normalizeWhatsAppPhone(options.toPhone);
  if (!to) return { ok: false, error: 'Customer phone number is missing or invalid.' };

  try {
    const response = await fetch(
      `https://graph.facebook.com/v20.0/${options.phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${options.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to,
          type: 'text',
          text: { preview_url: false, body: options.body },
        }),
      },
    );
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as {
        error?: { message?: string };
      } | null;
      return {
        ok: false,
        error: payload?.error?.message ?? `WhatsApp API returned HTTP ${response.status}.`,
      };
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Network error.' };
  }
}
