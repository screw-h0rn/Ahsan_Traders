import { createClient } from '@/lib/supabase/server';
import { getStaffProfile } from '@/lib/auth';
import { DashboardClient, type DashboardKPIs, type LowStockItem, type RecentInvoice, type RecentPayment } from './dashboard-client';

export default async function DashboardPage() {
  const supabase = await createClient();
  const today = new Date().toISOString().split('T')[0];
  const monthStart = `${today.slice(0, 7)}-01`;
  const nextMonthStart = new Date(
    Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() + 1, 1)
  )
    .toISOString()
    .split('T')[0];

  // Gross profit for the current calendar month: Σ(line_total − quantity × unit_cost)
  // over items of posted invoices dated within the month.
  const fetchMonthGrossProfit = async (): Promise<number> => {
    const { data: monthInvoices } = await supabase
      .from('sales_invoices')
      .select('id')
      .eq('status', 'posted')
      .gte('invoice_date', monthStart)
      .lt('invoice_date', nextMonthStart);

    const invoiceIds = (monthInvoices ?? []).map((inv) => inv.id);
    if (invoiceIds.length === 0) return 0;

    const { data: items } = await supabase
      .from('sales_invoice_items')
      .select('quantity,line_total,unit_cost')
      .in('sales_invoice_id', invoiceIds);

    return (items ?? []).reduce(
      (sum, item) =>
        sum + (Number(item.line_total || 0) - Number(item.quantity || 0) * Number(item.unit_cost || 0)),
      0
    );
  };

  const [
    profile,
    { data: tenant },
    { data: customersBalances },
    { data: suppliersBalances },
    { data: recentInvoices },
    { data: recentPayments },
    { data: allPayments },
    { data: inventoryStatus },
    { data: todayInvoices },
    monthGrossProfit,
  ] = await Promise.all([
    getStaffProfile(),
    supabase.from('company_settings').select('name,currency').single(),
    supabase.rpc('report_party_balances', { p_party_type: 'customer' }),
    supabase.rpc('report_party_balances', { p_party_type: 'supplier' }),
    supabase
      .from('sales_invoices')
      .select('id,invoice_number,invoice_date,total,status,customers(name)')
      .order('invoice_date', { ascending: false })
      .limit(5),
    supabase
      .from('payments')
      .select('id,payment_number,payment_date,direction,amount,method,party_type,party_id')
      .order('payment_date', { ascending: false })
      .limit(5),
    supabase.from('payments').select('direction,amount'),
    supabase.rpc('report_inventory_status', {}),
    supabase.rpc('report_sales_summary', { p_start_date: today, p_end_date: today }),
    fetchMonthGrossProfit(),
  ]);

  const currency = tenant?.currency ?? 'PKR';
  const profileName = profile?.full_name ?? profile?.email ?? 'User';
  const tenantName = tenant?.name ?? 'Your company';
  const tenantStatus = 'active';

  // Build Party Lookup Map for recent payments
  const partyNameMap = new Map<string, string>();
  (customersBalances ?? []).forEach((c: Record<string, unknown>) => {
    if (c.party_id && c.name) partyNameMap.set(String(c.party_id), String(c.name));
  });
  (suppliersBalances ?? []).forEach((s: Record<string, unknown>) => {
    if (s.party_id && s.name) partyNameMap.set(String(s.party_id), String(s.name));
  });

  // Calculate Core KPIs
  const todaySalesRevenue = (todayInvoices ?? []).reduce(
    (sum: number, inv: Record<string, unknown>) => sum + Number(inv.total || 0),
    0
  );
  const todaySalesCount = (todayInvoices ?? []).length;

  const receivables = (customersBalances ?? []).reduce(
    (sum: number, c: Record<string, unknown>) => sum + Number(c.balance || 0),
    0
  );
  const arCount = (customersBalances ?? []).filter(
    (c: Record<string, unknown>) => Number(c.balance || 0) > 0
  ).length;

  const payables = (suppliersBalances ?? []).reduce(
    (sum: number, s: Record<string, unknown>) => sum + Number(s.balance || 0),
    0
  );
  const apCount = (suppliersBalances ?? []).filter(
    (s: Record<string, unknown>) => Number(s.balance || 0) > 0
  ).length;

  const cashIn = (allPayments ?? [])
    .filter((p: Record<string, unknown>) => p.direction === 'in')
    .reduce((sum: number, p: Record<string, unknown>) => sum + Number(p.amount || 0), 0);
  const cashOut = (allPayments ?? [])
    .filter((p: Record<string, unknown>) => p.direction === 'out')
    .reduce((sum: number, p: Record<string, unknown>) => sum + Number(p.amount || 0), 0);
  const cashPosition = cashIn - cashOut;

  const lowStockItemsRaw = (inventoryStatus ?? []).filter(
    (item: Record<string, unknown>) => Boolean(item.is_low)
  );
  const lowStockCount = lowStockItemsRaw.length;

  const totalStockValue = (inventoryStatus ?? []).reduce(
    (sum: number, item: Record<string, unknown>) => sum + Number(item.retail_value || 0),
    0
  );

  const kpis: DashboardKPIs = {
    todaySalesRevenue,
    todaySalesCount,
    monthGrossProfit,
    receivables,
    arCount,
    payables,
    apCount,
    cashPosition,
    cashIn,
    cashOut,
    lowStockCount,
    totalStockValue,
  };

  type InvoiceRow = {
    id: string;
    invoice_number: string;
    invoice_date: string;
    total: number;
    status: string;
    customers?: { name?: string } | null;
  };

  type PaymentRow = {
    id: string;
    payment_number: string;
    payment_date: string;
    direction: string;
    amount: number;
    method: string;
    party_id: string;
  };

  const formattedRecentInvoices: RecentInvoice[] = (recentInvoices ?? []).map((inv: InvoiceRow) => ({
    id: String(inv.id),
    invoice_number: String(inv.invoice_number),
    invoice_date: String(inv.invoice_date),
    total: Number(inv.total || 0),
    status: String(inv.status || 'draft'),
    customer_name: inv.customers?.name ? String(inv.customers.name) : 'Unknown Customer',
  }));

  const formattedRecentPayments: RecentPayment[] = (recentPayments ?? []).map((p: PaymentRow) => ({
    id: String(p.id),
    payment_number: String(p.payment_number),
    payment_date: String(p.payment_date),
    direction: String(p.direction),
    amount: Number(p.amount || 0),
    method: String(p.method || 'cash'),
    party_name: partyNameMap.get(String(p.party_id)) || 'Unknown Party',
  }));

  const formattedLowStockItems: LowStockItem[] = lowStockItemsRaw.map((item: Record<string, unknown>) => ({
    inventory_id: String(item.inventory_id),
    product_name: String(item.name),
    sku: String(item.sku),
    branch_name: String(item.branch_name),
    quantity: Number(item.quantity || 0),
    unit: String(item.unit || 'units'),
    reorder_threshold: Number(item.reorder_threshold || 0),
  }));

  return (
    <DashboardClient
      profileName={profileName}
      tenantName={tenantName}
      tenantStatus={tenantStatus}
      currency={currency}
      kpis={kpis}
      recentInvoices={formattedRecentInvoices}
      recentPayments={formattedRecentPayments}
      lowStockItems={formattedLowStockItems}
    />
  );
}
