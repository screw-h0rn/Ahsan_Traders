import { NextResponse } from 'next/server';
import { can, getStaffProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { loadInvoiceData } from '@/lib/invoice-data';
import { invoiceFileName, renderInvoicePdf } from '@/lib/invoice-pdf';

// @react-pdf/renderer needs the Node runtime; it does not run on the edge.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /sales/:id/invoice/pdf
 *
 * Streams the print-ready invoice PDF. `?download=1` forces a save dialog;
 * without it the browser opens it inline, which is what the print flow uses.
 *
 * Data is read through the caller's RLS-scoped client, so a user can only ever
 * render an invoice belonging to their own tenant.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const caller = await getStaffProfile();
  if (!caller) return new NextResponse('Unauthorized', { status: 401 });
  if (!can(caller, 'sales.view')) return new NextResponse('Forbidden', { status: 403 });

  const supabase = await createClient();
  const data = await loadInvoiceData(supabase, id);
  if (!data) return new NextResponse('Invoice not found', { status: 404 });

  const pdf = await renderInvoicePdf(data);
  const disposition = new URL(request.url).searchParams.has('download')
    ? 'attachment'
    : 'inline';

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `${disposition}; filename="${invoiceFileName(data.invoiceNumber)}"`,
      'Cache-Control': 'no-store',
    },
  });
}
