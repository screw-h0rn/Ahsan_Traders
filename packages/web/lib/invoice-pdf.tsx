import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from '@react-pdf/renderer';
import type { InvoiceData } from './invoice-data';

/**
 * Print-ready A4 invoice.
 *
 * Built with real PDF primitives rather than a screenshot of the web page, so
 * the output is vector text: it stays sharp at any zoom, is selectable and
 * searchable, and prints crisply on a physical printer. Long invoices paginate
 * with the table header repeated and "Page n of m" on every sheet.
 *
 * Only the built-in Helvetica family is used — no font files to ship, no
 * network fetch at render time (which would fail on a cold serverless start).
 */

const BORDER = '#d8dedb';
const MUTED = '#6b7a74';
const INK = '#14211d';
const ACCENT = '#1a6b5a';

const styles = StyleSheet.create({
  // NOTE: do not set `lineHeight` here. A Page-level lineHeight makes
  // @react-pdf/renderer drop absolutely-positioned `fixed` children (the page
  // footer silently disappears), so leading is applied per text style instead.
  page: {
    paddingTop: 40,
    paddingBottom: 64,
    paddingHorizontal: 44,
    fontSize: 9.5,
    fontFamily: 'Helvetica',
    color: INK,
  },

  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  businessName: { fontSize: 17, fontFamily: 'Helvetica-Bold', color: ACCENT },
  businessMeta: { color: MUTED, marginTop: 2, maxWidth: 240, lineHeight: 1.4 },
  invoiceTitle: {
    fontSize: 22,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'right',
    letterSpacing: 1,
    // The default line box is tighter than the glyph height at this size, so
    // the number below it would otherwise overlap the baseline.
    lineHeight: 1.2,
    marginBottom: 4,
  },
  invoiceNumber: { textAlign: 'right', fontFamily: 'Helvetica-Bold' },
  invoiceMeta: { textAlign: 'right', color: MUTED },

  rule: { borderBottomWidth: 1.5, borderBottomColor: ACCENT, marginTop: 14, marginBottom: 14 },

  parties: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 18 },
  partyBlock: { width: '48%' },
  partyLabel: {
    fontSize: 7.5,
    fontFamily: 'Helvetica-Bold',
    color: MUTED,
    letterSpacing: 0.8,
    marginBottom: 3,
  },
  partyName: { fontFamily: 'Helvetica-Bold', fontSize: 11 },
  partyMeta: { color: MUTED, lineHeight: 1.4 },

  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#eef4f1',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: BORDER,
    paddingVertical: 6,
    paddingHorizontal: 6,
  },
  headerCell: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: MUTED, letterSpacing: 0.6 },
  row: {
    flexDirection: 'row',
    borderBottomWidth: 0.5,
    borderColor: BORDER,
    paddingVertical: 6,
    paddingHorizontal: 6,
  },

  colItem: { width: '46%' },
  colQty: { width: '18%', textAlign: 'right' },
  colRate: { width: '18%', textAlign: 'right' },
  colTotal: { width: '18%', textAlign: 'right' },

  itemName: { fontFamily: 'Helvetica-Bold' },
  itemSku: { color: MUTED, fontSize: 8 },
  rateSuffix: { color: MUTED, fontSize: 8 },

  totals: { marginTop: 16, marginLeft: 'auto', width: '46%' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2.5 },
  grandRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderColor: BORDER,
    marginTop: 4,
    paddingTop: 6,
  },
  grandLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold' },
  grandValue: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: ACCENT },
  dueRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 0.5,
    borderColor: BORDER,
  },
  dueLabel: { fontFamily: 'Helvetica-Bold' },

  stamp: {
    marginTop: 18,
    alignSelf: 'flex-start',
    borderWidth: 1.2,
    borderRadius: 3,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  stampText: { fontFamily: 'Helvetica-Bold', fontSize: 10, letterSpacing: 1 },

  notesLabel: { marginTop: 20, fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: MUTED, letterSpacing: 0.8 },
  notes: { color: MUTED, marginTop: 2, lineHeight: 1.45 },

  // Absolute coordinates on a Page are relative to its content box, i.e.
  // already inside paddingHorizontal — so left/right are 0, not the margin.
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 44,
    right: 44,
    borderTopWidth: 0.5,
    borderColor: BORDER,
    paddingTop: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footerText: { fontSize: 7.5, color: MUTED },
});

const PAYMENT_COLOUR: Record<string, string> = {
  paid: '#1a7f5a',
  partial: '#b5761f',
  unpaid: '#b3423a',
};

function InvoiceDocument({ data }: { data: InvoiceData }) {
  const stampColour = PAYMENT_COLOUR[data.paymentStatus] ?? MUTED;

  return (
    <Document
      title={`Invoice ${data.invoiceNumber}`}
      author={data.business.name}
      subject={`Invoice ${data.invoiceNumber} for ${data.customer.name}`}
    >
      <Page size="A4" style={styles.page} wrap>
        <View style={styles.header} fixed>
          <View>
            <Text style={styles.businessName}>{data.business.name}</Text>
            {data.business.address ? (
              <Text style={styles.businessMeta}>{data.business.address}</Text>
            ) : null}
            {data.business.phone ? (
              <Text style={styles.businessMeta}>{data.business.phone}</Text>
            ) : null}
          </View>
          <View>
            <Text style={styles.invoiceTitle}>INVOICE</Text>
            <Text style={styles.invoiceNumber}>{data.invoiceNumber}</Text>
            <Text style={styles.invoiceMeta}>{data.invoiceDate}</Text>
          </View>
        </View>

        <View style={styles.rule} fixed />

        <View style={styles.parties}>
          <View style={styles.partyBlock}>
            <Text style={styles.partyLabel}>BILL TO</Text>
            <Text style={styles.partyName}>{data.customer.name}</Text>
            {data.customer.phone ? (
              <Text style={styles.partyMeta}>{data.customer.phone}</Text>
            ) : null}
            {data.customer.address ? (
              <Text style={styles.partyMeta}>{data.customer.address}</Text>
            ) : null}
          </View>
          <View style={styles.partyBlock}>
            <Text style={styles.partyLabel}>DETAILS</Text>
            <Text style={styles.partyMeta}>Sales order: {data.orderNumber}</Text>
            {data.branchName ? (
              <Text style={styles.partyMeta}>Branch: {data.branchName}</Text>
            ) : null}
            <Text style={styles.partyMeta}>Currency: {data.currency}</Text>
          </View>
        </View>

        {/* repeated on every page when the table breaks */}
        <View style={styles.tableHeader} fixed>
          <Text style={[styles.headerCell, styles.colItem]}>DESCRIPTION</Text>
          <Text style={[styles.headerCell, styles.colQty]}>QTY</Text>
          <Text style={[styles.headerCell, styles.colRate]}>RATE</Text>
          <Text style={[styles.headerCell, styles.colTotal]}>AMOUNT</Text>
        </View>

        {data.lines.map((line, index) => (
          <View key={index} style={styles.row} wrap={false}>
            <View style={styles.colItem}>
              <Text style={styles.itemName}>{line.label}</Text>
              {line.sku ? <Text style={styles.itemSku}>{line.sku}</Text> : null}
            </View>
            <Text style={styles.colQty}>{line.quantity}</Text>
            <View style={styles.colRate}>
              <Text>{line.unitPrice}</Text>
              <Text style={styles.rateSuffix}>per {line.unitSuffix}</Text>
            </View>
            <Text style={styles.colTotal}>{line.lineTotal}</Text>
          </View>
        ))}

        <View style={styles.totals} wrap={false}>
          <View style={styles.totalRow}>
            <Text>Subtotal</Text>
            <Text>{data.subtotal}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text>
              {data.taxName} ({data.taxRate}%)
            </Text>
            <Text>{data.taxAmount}</Text>
          </View>
          <View style={styles.grandRow}>
            <Text style={styles.grandLabel}>Total</Text>
            <Text style={styles.grandValue}>{data.total}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text>Paid</Text>
            <Text>{data.amountPaid}</Text>
          </View>
          <View style={styles.dueRow}>
            <Text style={styles.dueLabel}>Balance due</Text>
            <Text style={styles.dueLabel}>{data.outstanding}</Text>
          </View>
        </View>

        <View style={[styles.stamp, { borderColor: stampColour }]} wrap={false}>
          <Text style={[styles.stampText, { color: stampColour }]}>
            {data.paymentStatus.toUpperCase()}
          </Text>
        </View>

        {data.notes ? (
          <View wrap={false}>
            <Text style={styles.notesLabel}>NOTES</Text>
            <Text style={styles.notes}>{data.notes}</Text>
          </View>
        ) : null}

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            {data.invoiceNumber} · {data.business.name}
          </Text>
          <Text
            style={styles.footerText}
            render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  );
}

/** Render the invoice to a PDF buffer (Node runtime only). */
export async function renderInvoicePdf(data: InvoiceData): Promise<Buffer> {
  return renderToBuffer(<InvoiceDocument data={data} />);
}

/** `INV-1A2B3C4D.pdf` — safe on every filesystem and in a WhatsApp filename. */
export function invoiceFileName(invoiceNumber: string): string {
  return `${invoiceNumber.replace(/[^A-Za-z0-9._-]/g, '-')}.pdf`;
}
