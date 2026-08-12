'use client';

import { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Button, cn } from '@at/ui';
import { formatMoney, formatDate } from '@/lib/format';
import {
  fetchSalesSummaryReport,
  fetchInventoryStatusReport,
  fetchPartyStatementReport,
  fetchProfitReport,
  type ProfitReportRow,
  type SalesSummaryRow,
  type InventoryStatusRow,
  type PartyStatementRow,
} from './actions';

export type ReportOptionBranch = { id: string; name: string };
export type ReportOptionCategory = { id: string; name: string };
export type ReportOptionParty = { id: string; name: string; phone: string | null };

export function ReportsClient({
  branches,
  categories,
  customers,
  suppliers,
  currency,
  initialSalesData,
  initialInventoryData,
}: {
  branches: ReportOptionBranch[];
  categories: ReportOptionCategory[];
  customers: ReportOptionParty[];
  suppliers: ReportOptionParty[];
  currency: string;
  initialSalesData: SalesSummaryRow[];
  initialInventoryData: InventoryStatusRow[];
}) {
  const [activeTab, setActiveTab] = useState<'sales' | 'inventory' | 'statement' | 'profit'>('sales');

  // Sales filters & state
  const [salesStart, setSalesStart] = useState('');
  const [salesEnd, setSalesEnd] = useState('');
  const [salesCustomer, setSalesCustomer] = useState('');
  const [salesBranch, setSalesBranch] = useState('');
  const [salesData, setSalesData] = useState(initialSalesData);
  const [salesLoading, setSalesLoading] = useState(false);
  const [salesError, setSalesError] = useState<string | null>(null);

  // Inventory filters & state
  const [invBranch, setInvBranch] = useState('');
  const [invCategory, setInvCategory] = useState('');
  const [invLowStock, setInvLowStock] = useState(false);
  const [invData, setInvData] = useState(initialInventoryData);
  const [invLoading, setInvLoading] = useState(false);
  const [invError, setInvError] = useState<string | null>(null);

  // Statement filters & state
  const [stmtPartyType, setStmtPartyType] = useState<'customer' | 'supplier'>('customer');
  const [stmtPartyId, setStmtPartyId] = useState(() => customers[0]?.id || '');
  const [stmtStart, setStmtStart] = useState('');
  const [stmtEnd, setStmtEnd] = useState('');
  const [stmtData, setStmtData] = useState<PartyStatementRow[]>([]);
  const [stmtLoading, setStmtLoading] = useState(false);
  const [stmtError, setStmtError] = useState<string | null>(null);

  // Profit filters & state
  const [profitStart, setProfitStart] = useState('');
  const [profitEnd, setProfitEnd] = useState('');
  const [profitData, setProfitData] = useState<ProfitReportRow[]>([]);
  const [profitLoading, setProfitLoading] = useState(false);
  const [profitError, setProfitError] = useState<string | null>(null);

  // Loaders
  const loadSales = useCallback(async () => {
    setSalesLoading(true);
    setSalesError(null);
    const res = await fetchSalesSummaryReport({
      startDate: salesStart || undefined,
      endDate: salesEnd || undefined,
      customerId: salesCustomer || undefined,
      branchId: salesBranch || undefined,
    });
    setSalesLoading(false);
    if (res.error) setSalesError(res.error);
    else setSalesData(res.data || []);
  }, [salesStart, salesEnd, salesCustomer, salesBranch]);

  const loadInventory = useCallback(async () => {
    setInvLoading(true);
    setInvError(null);
    const res = await fetchInventoryStatusReport({
      branchId: invBranch || undefined,
      categoryId: invCategory || undefined,
      lowStockOnly: invLowStock,
    });
    setInvLoading(false);
    if (res.error) setInvError(res.error);
    else setInvData(res.data || []);
  }, [invBranch, invCategory, invLowStock]);

  const loadStatement = useCallback(
    async (targetPartyType = stmtPartyType, targetPartyId = stmtPartyId) => {
      if (!targetPartyId) {
        setStmtData([]);
        return;
      }
      setStmtLoading(true);
      setStmtError(null);
      const res = await fetchPartyStatementReport({
        partyType: targetPartyType,
        partyId: targetPartyId,
        startDate: stmtStart || undefined,
        endDate: stmtEnd || undefined,
      });
      setStmtLoading(false);
      if (res.error) setStmtError(res.error);
      else setStmtData(res.data || []);
    },
    [stmtPartyType, stmtPartyId, stmtStart, stmtEnd]
  );

  const loadProfit = useCallback(async () => {
    setProfitLoading(true);
    setProfitError(null);
    const res = await fetchProfitReport({
      startDate: profitStart || undefined,
      endDate: profitEnd || undefined,
    });
    setProfitLoading(false);
    if (res.error) setProfitError(res.error);
    else setProfitData(res.data || []);
  }, [profitStart, profitEnd]);

  // CSV Export utility
  const exportCSV = (filename: string, headers: string[], rows: (string | number)[][]) => {
    const csvContent = [
      headers.join(','),
      ...rows.map((row) =>
        row
          .map((cell) => {
            const str = String(cell ?? '');
            if (str.includes(',') || str.includes('"') || str.includes('\n')) {
              return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
          })
          .join(',')
      ),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // KPI Calculations
  const salesTotalRevenue = salesData.reduce((acc, row) => acc + Number(row.total), 0);
  const salesTotalTax = salesData.reduce((acc, row) => acc + Number(row.tax_amount), 0);
  const salesTotalNet = salesData.reduce((acc, row) => acc + Number(row.subtotal), 0);

  const invTotalCost = invData.reduce((acc, row) => acc + Number(row.cost_value), 0);
  const invTotalValue = invData.reduce((acc, row) => acc + Number(row.retail_value), 0);
  const invTotalUnits = invData.reduce((acc, row) => acc + Number(row.quantity), 0);
  const invLowStockCount = invData.filter((row) => row.is_low).length;

  const profitTotalRevenue = profitData.reduce((acc, row) => acc + Number(row.revenue), 0);
  const profitTotalCogs = profitData.reduce((acc, row) => acc + Number(row.cogs), 0);
  const profitGross = profitData.reduce((acc, row) => acc + Number(row.gross_profit), 0);
  const profitOverallMargin = profitTotalRevenue > 0 ? (profitGross / profitTotalRevenue) * 100 : 0;

  // Brought-forward: the first row's balance, less that row's own movement.
  const stmtOpening =
    stmtData.length > 0
      ? Number(stmtData[0].running_balance) - (Number(stmtData[0].debit) - Number(stmtData[0].credit))
      : 0;
  const stmtClosing = stmtData.length > 0 ? stmtData[stmtData.length - 1]?.running_balance || 0 : 0;
  const stmtTotalDebit = stmtData.reduce((acc, row) => acc + Number(row.debit), 0);
  const stmtTotalCredit = stmtData.reduce((acc, row) => acc + Number(row.credit), 0);

  return (
    <div className="flex flex-col gap-6">
      {/* Top Report Selector Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('sales')}
          className={cn(
            'rounded-lg px-4 py-2 text-sm font-semibold transition-colors',
            activeTab === 'sales'
              ? 'bg-[#1a6b5a] text-white shadow-sm'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          )}
        >
          Sales Summary Report
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('inventory')}
          className={cn(
            'rounded-lg px-4 py-2 text-sm font-semibold transition-colors',
            activeTab === 'inventory'
              ? 'bg-[#1a6b5a] text-white shadow-sm'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          )}
        >
          Inventory Valuation &amp; Stock Status
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveTab('statement');
            if (stmtData.length === 0 && stmtPartyId) {
              loadStatement();
            }
          }}
          className={cn(
            'rounded-lg px-4 py-2 text-sm font-semibold transition-colors',
            activeTab === 'statement'
              ? 'bg-[#1a6b5a] text-white shadow-sm'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          )}
        >
          Party Statement of Account
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveTab('profit');
            if (profitData.length === 0) {
              loadProfit();
            }
          }}
          className={cn(
            'rounded-lg px-4 py-2 text-sm font-semibold transition-colors',
            activeTab === 'profit'
              ? 'bg-[#1a6b5a] text-white shadow-sm'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          )}
        >
          Profit &amp; Margin Report
        </button>
      </div>

      {/* 1. SALES SUMMARY TAB */}
      {activeTab === 'sales' && (
        <div className="flex flex-col gap-6">
          <Card className="bg-slate-50/70">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Filter Sales Report</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-4 sm:items-end">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">Start Date</label>
                  <input
                    type="date"
                    value={salesStart}
                    onChange={(e) => setSalesStart(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">End Date</label>
                  <input
                    type="date"
                    value={salesEnd}
                    onChange={(e) => setSalesEnd(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">Customer</label>
                  <select
                    value={salesCustomer}
                    onChange={(e) => setSalesCustomer(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm"
                  >
                    <option value="">All Customers</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">Branch</label>
                  <select
                    value={salesBranch}
                    onChange={(e) => setSalesBranch(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm"
                  >
                    <option value="">All Branches</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <Button variant="outline" onClick={() => loadSales()} disabled={salesLoading}>
                  {salesLoading ? 'Refreshing...' : 'Apply Filters'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    exportCSV(
                      'sales_summary',
                      ['Invoice #', 'Date', 'Customer', 'Branch', 'Subtotal', 'Tax', 'Total', 'Status'],
                      salesData.map((r) => [
                        r.invoice_number,
                        r.invoice_date,
                        r.customer_name,
                        r.branch_name,
                        r.subtotal,
                        r.tax_amount,
                        r.total,
                        r.payment_status,
                      ])
                    );
                  }}
                  disabled={salesData.length === 0}
                >
                  Export CSV
                </Button>
                <Button variant="outline" onClick={() => window.print()} disabled={salesData.length === 0}>
                  Print / PDF
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* KPI Bar */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <Card className="border-l-4 border-l-emerald-600 bg-emerald-50/20">
              <CardHeader className="pb-1">
                <CardDescription className="text-xs uppercase text-emerald-800">Total Revenue</CardDescription>
                <CardTitle className="text-xl font-bold text-emerald-900">
                  {formatMoney(salesTotalRevenue, currency)}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card className="border-l-4 border-l-blue-600 bg-blue-50/20">
              <CardHeader className="pb-1">
                <CardDescription className="text-xs uppercase text-blue-800">Subtotal (Net)</CardDescription>
                <CardTitle className="text-xl font-bold text-blue-900">
                  {formatMoney(salesTotalNet, currency)}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card className="border-l-4 border-l-amber-600 bg-amber-50/20">
              <CardHeader className="pb-1">
                <CardDescription className="text-xs uppercase text-amber-800">Tax Collected</CardDescription>
                <CardTitle className="text-xl font-bold text-amber-900">
                  {formatMoney(salesTotalTax, currency)}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card className="border-l-4 border-l-slate-600 bg-slate-50/50">
              <CardHeader className="pb-1">
                <CardDescription className="text-xs uppercase text-slate-700">Invoices Posted</CardDescription>
                <CardTitle className="text-xl font-bold text-slate-900">{salesData.length}</CardTitle>
              </CardHeader>
            </Card>
          </div>

          {salesError && <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{salesError}</div>}

          {/* Table */}
          <Card>
            <CardHeader>
              <CardTitle>Sales Invoices Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {salesData.length === 0 ? (
                <p className="px-5 pb-5 text-sm text-slate-500">No invoices matching report criteria.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                        <th className="px-5 py-3 font-medium">Invoice #</th>
                        <th className="px-5 py-3 font-medium">Date</th>
                        <th className="px-5 py-3 font-medium">Customer</th>
                        <th className="px-5 py-3 font-medium">Branch</th>
                        <th className="px-5 py-3 font-medium text-right">Subtotal</th>
                        <th className="px-5 py-3 font-medium text-right">Tax</th>
                        <th className="px-5 py-3 font-medium text-right">Total</th>
                        <th className="px-5 py-3 font-medium text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {salesData.map((row) => (
                        <tr key={row.invoice_id} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="px-5 py-3 font-semibold text-slate-900">{row.invoice_number}</td>
                          <td className="px-5 py-3 text-slate-600">{formatDate(row.invoice_date)}</td>
                          <td className="px-5 py-3 text-slate-900">{row.customer_name}</td>
                          <td className="px-5 py-3 text-slate-600">{row.branch_name}</td>
                          <td className="px-5 py-3 text-right text-slate-600">
                            {formatMoney(row.subtotal, currency)}
                          </td>
                          <td className="px-5 py-3 text-right text-slate-600">
                            {formatMoney(row.tax_amount, currency)}
                          </td>
                          <td className="px-5 py-3 text-right font-semibold text-slate-900">
                            {formatMoney(row.total, currency)}
                          </td>
                          <td className="px-5 py-3 text-center">
                            <span
                              className={cn(
                                'rounded px-2 py-0.5 text-xs font-medium uppercase',
                                row.payment_status === 'issued' || row.payment_status === 'paid'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-slate-100 text-slate-800'
                              )}
                            >
                              {row.payment_status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* 2. INVENTORY STATUS TAB */}
      {activeTab === 'inventory' && (
        <div className="flex flex-col gap-6">
          <Card className="bg-slate-50/70">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Filter Inventory Valuation Report</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-4 sm:items-end">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">Branch</label>
                  <select
                    value={invBranch}
                    onChange={(e) => setInvBranch(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm"
                  >
                    <option value="">All Branches</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">Category</label>
                  <select
                    value={invCategory}
                    onChange={(e) => setInvCategory(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm"
                  >
                    <option value="">All Categories</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2 pb-1.5">
                  <input
                    type="checkbox"
                    id="lowStockOnly"
                    checked={invLowStock}
                    onChange={(e) => setInvLowStock(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-[#1a6b5a]"
                  />
                  <label htmlFor="lowStockOnly" className="text-sm font-medium text-slate-700">
                    Low Stock Only (≤ Reorder Threshold)
                  </label>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => loadInventory()} disabled={invLoading}>
                    {invLoading ? 'Refreshing...' : 'Apply Filters'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      exportCSV(
                        'inventory_status',
                        [
                          'SKU',
                          'Product Name',
                          'Category',
                          'Branch',
                          'Quantity',
                          'Unit',
                          'Purchase Price',
                          'Total Cost',
                          'Sale Price',
                          'Total Value',
                          'Low Stock',
                        ],
                        invData.map((r) => [
                          r.sku,
                          r.name,
                          r.category_name,
                          r.branch_name,
                          r.quantity,
                          r.purchase_price,
                          r.cost_value,
                          r.sale_price,
                          r.retail_value,
                          r.is_low ? 'YES' : 'NO',
                        ])
                      );
                    }}
                    disabled={invData.length === 0}
                  >
                    Export CSV
                  </Button>
                  <Button variant="outline" onClick={() => window.print()} disabled={invData.length === 0}>
                    Print / PDF
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* KPI Bar */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <Card className="border-l-4 border-l-emerald-600 bg-emerald-50/20">
              <CardHeader className="pb-1">
                <CardDescription className="text-xs uppercase text-emerald-800">Total Sale Value</CardDescription>
                <CardTitle className="text-xl font-bold text-emerald-900">
                  {formatMoney(invTotalValue, currency)}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card className="border-l-4 border-l-blue-600 bg-blue-50/20">
              <CardHeader className="pb-1">
                <CardDescription className="text-xs uppercase text-blue-800">Total Cost Value</CardDescription>
                <CardTitle className="text-xl font-bold text-blue-900">
                  {formatMoney(invTotalCost, currency)}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card className="border-l-4 border-l-slate-600 bg-slate-50/50">
              <CardHeader className="pb-1">
                <CardDescription className="text-xs uppercase text-slate-700">Total Stock Units</CardDescription>
                <CardTitle className="text-xl font-bold text-slate-900">{invTotalUnits}</CardTitle>
              </CardHeader>
            </Card>
            <Card
              className={cn(
                'border-l-4',
                invLowStockCount > 0
                  ? 'border-l-red-600 bg-red-50/30'
                  : 'border-l-emerald-600 bg-emerald-50/20'
              )}
            >
              <CardHeader className="pb-1">
                <CardDescription
                  className={cn(
                    'text-xs uppercase',
                    invLowStockCount > 0 ? 'text-red-800' : 'text-emerald-800'
                  )}
                >
                  Low Stock Alerts
                </CardDescription>
                <CardTitle
                  className={cn(
                    'text-xl font-bold',
                    invLowStockCount > 0 ? 'text-red-900' : 'text-emerald-900'
                  )}
                >
                  {invLowStockCount} item{invLowStockCount === 1 ? '' : 's'}
                </CardTitle>
              </CardHeader>
            </Card>
          </div>

          {invError && <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{invError}</div>}

          {/* Table */}
          <Card>
            <CardHeader>
              <CardTitle>Stock Levels &amp; Valuation per Branch</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {invData.length === 0 ? (
                <p className="px-5 pb-5 text-sm text-slate-500">No inventory rows matching filters.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                        <th className="px-5 py-3 font-medium">SKU / Product</th>
                        <th className="px-5 py-3 font-medium">Branch</th>
                        <th className="px-5 py-3 font-medium">Category</th>
                        <th className="px-5 py-3 font-medium text-right">Quantity</th>
                        <th className="px-5 py-3 font-medium text-right">Cost Price</th>
                        <th className="px-5 py-3 font-medium text-right">Total Cost</th>
                        <th className="px-5 py-3 font-medium text-right">Sale Price</th>
                        <th className="px-5 py-3 font-medium text-right">Total Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invData.map((row) => (
                        <tr
                          key={row.inventory_id}
                          className={cn(
                            'border-b border-slate-100 hover:bg-slate-50',
                            row.is_low && 'bg-red-50/40'
                          )}
                        >
                          <td className="px-5 py-3 font-medium text-slate-900">
                            <div>{row.name}</div>
                            <div className="text-xs text-slate-400">SKU: {row.sku}</div>
                          </td>
                          <td className="px-5 py-3 text-slate-600">{row.branch_name}</td>
                          <td className="px-5 py-3 text-slate-600">{row.category_name}</td>
                          <td className="px-5 py-3 text-right font-bold text-slate-900">
                            {row.quantity} 
                            {row.is_low && (
                              <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700">
                                Low (≤{row.reorder_threshold})
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-3 text-right text-slate-600">
                            {formatMoney(row.purchase_price, currency)}
                          </td>
                          <td className="px-5 py-3 text-right text-slate-600">
                            {formatMoney(row.cost_value, currency)}
                          </td>
                          <td className="px-5 py-3 text-right text-slate-600">
                            {formatMoney(row.sale_price, currency)}
                          </td>
                          <td className="px-5 py-3 text-right font-semibold text-emerald-800">
                            {formatMoney(row.retail_value, currency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* 3. STATEMENT OF ACCOUNT TAB */}
      {activeTab === 'statement' && (
        <div className="flex flex-col gap-6">
          <Card className="bg-slate-50/70">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Generate Party Statement of Account</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-5 sm:items-end">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">Party Type</label>
                  <select
                    value={stmtPartyType}
                    onChange={(e) => {
                      const newType = e.target.value as 'customer' | 'supplier';
                      setStmtPartyType(newType);
                      const list = newType === 'customer' ? customers : suppliers;
                      const firstId = list[0]?.id || '';
                      setStmtPartyId(firstId);
                      if (firstId) {
                        loadStatement(newType, firstId);
                      }
                    }}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium"
                  >
                    <option value="customer">Customer (AR)</option>
                    <option value="supplier">Supplier (AP)</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">Select Party</label>
                  <select
                    value={stmtPartyId}
                    onChange={(e) => {
                      const newId = e.target.value;
                      setStmtPartyId(newId);
                      if (newId) {
                        loadStatement(stmtPartyType, newId);
                      }
                    }}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm"
                  >
                    {(stmtPartyType === 'customer' ? customers : suppliers).map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} {p.phone ? `(${p.phone})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">Start Date</label>
                  <input
                    type="date"
                    value={stmtStart}
                    onChange={(e) => setStmtStart(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">End Date</label>
                  <input
                    type="date"
                    value={stmtEnd}
                    onChange={(e) => setStmtEnd(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => loadStatement()} disabled={stmtLoading || !stmtPartyId}>
                    {stmtLoading ? 'Loading...' : 'Generate Statement'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      exportCSV(
                        `${stmtPartyType}_statement`,
                        ['Date', 'Description', 'Reference #', 'Debit', 'Credit', 'Running Balance'],
                        stmtData.map((r) => [
                          formatDate(r.entry_date),
                          r.description,
                          r.reference,
                          r.debit,
                          r.credit,
                          r.running_balance,
                        ])
                      );
                    }}
                    disabled={stmtData.length === 0}
                  >
                    Export CSV
                  </Button>
                  <Button variant="outline" onClick={() => window.print()} disabled={stmtData.length === 0}>
                    Print / PDF
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Statement KPI Bar */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <Card className="border-l-4 border-l-slate-600 bg-slate-50/50">
              <CardHeader className="pb-1">
                <CardDescription className="text-xs uppercase text-slate-700">Opening (B/F)</CardDescription>
                <CardTitle className="text-xl font-bold text-slate-900">
                  {formatMoney(stmtOpening, currency)}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card className="border-l-4 border-l-emerald-600 bg-emerald-50/20">
              <CardHeader className="pb-1">
                <CardDescription className="text-xs uppercase text-emerald-800">
                  Total Debits {stmtPartyType === 'customer' ? '(Invoices)' : '(Payments)'}
                </CardDescription>
                <CardTitle className="text-xl font-bold text-emerald-900">
                  {formatMoney(stmtTotalDebit, currency)}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card className="border-l-4 border-l-blue-600 bg-blue-50/20">
              <CardHeader className="pb-1">
                <CardDescription className="text-xs uppercase text-blue-800">
                  Total Credits {stmtPartyType === 'customer' ? '(Receipts)' : '(GRNs)'}
                </CardDescription>
                <CardTitle className="text-xl font-bold text-blue-900">
                  {formatMoney(stmtTotalCredit, currency)}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card
              className={cn(
                'border-l-4',
                stmtClosing >= 0
                  ? 'border-l-emerald-600 bg-emerald-50/30'
                  : 'border-l-red-600 bg-red-50/30'
              )}
            >
              <CardHeader className="pb-1">
                <CardDescription className="text-xs uppercase text-slate-700">Closing Balance</CardDescription>
                <CardTitle
                  className={cn(
                    'text-xl font-bold',
                    stmtClosing >= 0 ? 'text-emerald-950' : 'text-red-950'
                  )}
                >
                  {formatMoney(stmtClosing, currency)}
                </CardTitle>
              </CardHeader>
            </Card>
          </div>

          {stmtError && <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{stmtError}</div>}

          {/* Statement Table */}
          <Card>
            <CardHeader>
              <CardTitle>
                Statement Ledger —{' '}
                {(stmtPartyType === 'customer' ? customers : suppliers).find((p) => p.id === stmtPartyId)
                  ?.name ?? 'Selected Party'}
              </CardTitle>
              <CardDescription>
                Reconciled ledger history with running balance. Verified immutable debit/credit entries.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {stmtData.length === 0 ? (
                <p className="px-5 pb-5 text-sm text-slate-500">No ledger entries matching statement period.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                        <th className="px-5 py-3 font-medium">Date / Time</th>
                        <th className="px-5 py-3 font-medium">Type</th>
                        <th className="px-5 py-3 font-medium">Reference #</th>
                        <th className="px-5 py-3 font-medium">Notes / Description</th>
                        <th className="px-5 py-3 font-medium text-right">Debit</th>
                        <th className="px-5 py-3 font-medium text-right">Credit</th>
                        <th className="px-5 py-3 font-medium text-right">Running Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stmtData.map((row, index) => (
                        <tr
                          key={`${row.entry_date}-${row.reference}-${index}`}
                          className={cn(
                            'border-b border-slate-100 hover:bg-slate-50',
                          )}
                        >
                          <td className="px-5 py-3 text-slate-600">{formatDate(row.entry_date)}</td>
                          <td className="px-5 py-3 text-slate-600">
                            <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium uppercase text-slate-700">
                              {row.description}
                            </span>
                          </td>
                          <td className="px-5 py-3 font-medium text-slate-900">{row.reference || '—'}</td>
                          <td className="px-5 py-3 text-right text-slate-600">
                            {row.debit > 0 ? formatMoney(row.debit, currency) : '—'}
                          </td>
                          <td className="px-5 py-3 text-right text-slate-600">
                            {row.credit > 0 ? formatMoney(row.credit, currency) : '—'}
                          </td>
                          <td className="px-5 py-3 text-right font-bold text-slate-900">
                            {formatMoney(row.running_balance, currency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* 4. PROFIT & MARGIN TAB */}
      {activeTab === 'profit' && (
        <div className="flex flex-col gap-6">
          <Card className="bg-slate-50/70">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Filter Profit Report</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-4 sm:items-end">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">Start Date</label>
                  <input
                    type="date"
                    value={profitStart}
                    onChange={(e) => setProfitStart(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700">End Date</label>
                  <input
                    type="date"
                    value={profitEnd}
                    onChange={(e) => setProfitEnd(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
                  />
                </div>
                <div className="sm:col-span-2 flex justify-end gap-2">
                  <Button variant="outline" onClick={() => loadProfit()} disabled={profitLoading}>
                    {profitLoading ? 'Refreshing...' : 'Apply Filters'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      exportCSV(
                        'profit_report',
                        ['SKU', 'Product Name', 'Qty Sold', 'Unit', 'Revenue', 'COGS', 'Gross Profit', 'Margin %'],
                        profitData.map((r) => [
                          r.sku,
                          r.name,
                          r.quantity_sold,
                          r.revenue,
                          r.cogs,
                          r.gross_profit,
                          r.margin_pct,
                        ])
                      );
                    }}
                    disabled={profitData.length === 0}
                  >
                    Export CSV
                  </Button>
                  <Button variant="outline" onClick={() => window.print()} disabled={profitData.length === 0}>
                    Print / PDF
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* KPI Bar */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <Card className="border-l-4 border-l-emerald-600 bg-emerald-50/20">
              <CardHeader className="pb-1">
                <CardDescription className="text-xs uppercase text-emerald-800">Total Revenue</CardDescription>
                <CardTitle className="text-xl font-bold text-emerald-900">
                  {formatMoney(profitTotalRevenue, currency)}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card className="border-l-4 border-l-amber-600 bg-amber-50/20">
              <CardHeader className="pb-1">
                <CardDescription className="text-xs uppercase text-amber-800">Total COGS</CardDescription>
                <CardTitle className="text-xl font-bold text-amber-900">
                  {formatMoney(profitTotalCogs, currency)}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card
              className={cn(
                'border-l-4',
                profitGross >= 0 ? 'border-l-emerald-600 bg-emerald-50/30' : 'border-l-red-600 bg-red-50/30'
              )}
            >
              <CardHeader className="pb-1">
                <CardDescription
                  className={cn('text-xs uppercase', profitGross >= 0 ? 'text-emerald-800' : 'text-red-800')}
                >
                  Gross Profit
                </CardDescription>
                <CardTitle
                  className={cn('text-xl font-bold', profitGross >= 0 ? 'text-emerald-950' : 'text-red-950')}
                >
                  {formatMoney(profitGross, currency)}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card className="border-l-4 border-l-blue-600 bg-blue-50/20">
              <CardHeader className="pb-1">
                <CardDescription className="text-xs uppercase text-blue-800">Overall Margin</CardDescription>
                <CardTitle className="text-xl font-bold text-blue-900">
                  {profitOverallMargin.toFixed(1)}%
                </CardTitle>
              </CardHeader>
            </Card>
          </div>

          {profitError && <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{profitError}</div>}

          {/* Table */}
          <Card>
            <CardHeader>
              <CardTitle>Profit &amp; Margin per Product</CardTitle>
              <CardDescription>
                Revenue, cost of goods sold and gross margin from posted sales invoices.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {profitData.length === 0 ? (
                <p className="px-5 pb-5 text-sm text-slate-500">
                  {profitLoading ? 'Loading profit data...' : 'No sales matching report criteria.'}
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                        <th className="px-5 py-3 font-medium">Product</th>
                        <th className="px-5 py-3 font-medium text-right">Qty Sold</th>
                        <th className="px-5 py-3 font-medium text-right">Revenue</th>
                        <th className="px-5 py-3 font-medium text-right">COGS</th>
                        <th className="px-5 py-3 font-medium text-right">Gross Profit</th>
                        <th className="px-5 py-3 font-medium text-right">Margin %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {profitData.map((row) => (
                        <tr key={row.product_id} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="px-5 py-3 font-medium text-slate-900">
                            <div>{row.name}</div>
                            <div className="text-xs text-slate-400">SKU: {row.sku}</div>
                          </td>
                          <td className="px-5 py-3 text-right font-bold text-slate-900">
                            {row.quantity_sold} 
                          </td>
                          <td className="px-5 py-3 text-right text-slate-600">
                            {formatMoney(row.revenue, currency)}
                          </td>
                          <td className="px-5 py-3 text-right text-slate-600">
                            {formatMoney(row.cogs, currency)}
                          </td>
                          <td
                            className={cn(
                              'px-5 py-3 text-right font-semibold',
                              Number(row.gross_profit) >= 0 ? 'text-emerald-800' : 'text-red-700'
                            )}
                          >
                            {formatMoney(row.gross_profit, currency)}
                          </td>
                          <td
                            className={cn(
                              'px-5 py-3 text-right font-semibold',
                              Number(row.margin_pct) >= 0 ? 'text-slate-900' : 'text-red-700'
                            )}
                          >
                            {Number(row.margin_pct).toFixed(1)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
