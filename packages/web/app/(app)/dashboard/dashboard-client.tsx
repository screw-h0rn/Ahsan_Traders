'use client';

import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, cn } from '@at/ui';
import { formatMoney, formatDate } from '@/lib/format';

export type DashboardKPIs = {
  todaySalesRevenue: number;
  todaySalesCount: number;
  monthGrossProfit: number;
  receivables: number;
  arCount: number;
  payables: number;
  apCount: number;
  cashPosition: number;
  cashIn: number;
  cashOut: number;
  lowStockCount: number;
  totalStockValue: number;
};

export type RecentInvoice = {
  id: string;
  invoice_number: string;
  invoice_date: string;
  total: number;
  status: string;
  customer_name: string;
};

export type RecentPayment = {
  id: string;
  payment_number: string;
  payment_date: string;
  direction: string;
  amount: number;
  method: string;
  party_name: string;
};

export type LowStockItem = {
  inventory_id: string;
  product_name: string;
  sku: string;
  branch_name: string;
  quantity: number;
  unit: string;
  reorder_threshold: number;
};

export function DashboardClient({
  profileName,
  tenantName,
  tenantStatus,
  currency,
  kpis,
  recentInvoices,
  recentPayments,
  lowStockItems,
}: {
  profileName: string;
  tenantName: string;
  tenantStatus: string;
  currency: string;
  kpis: DashboardKPIs;
  recentInvoices: RecentInvoice[];
  recentPayments: RecentPayment[];
  lowStockItems: LowStockItem[];
}) {
  return (
    <div className="flex flex-col gap-8 pb-12">
      {/* 1. Hero Header & Quick Actions */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#143e34] via-[#1a6b5a] to-[#208a73] p-8 text-white shadow-xl">
        <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-16 right-1/3 h-48 w-48 rounded-full bg-emerald-400/15 blur-2xl" />

        <div className="relative z-10 flex flex-col justify-between gap-6 md:flex-row md:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-emerald-200 backdrop-blur-md">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              {tenantStatus} workspace
            </div>
            <h1 className="mt-3 font-serif text-3xl font-bold tracking-tight text-white md:text-4xl">
              Welcome back, {profileName.split(' ')[0] || profileName}.
            </h1>
            <p className="mt-1 text-sm text-emerald-100/90 md:text-base">
              {tenantName} · Executive Distribution Command Center
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Link
              href="/purchases"
              className="rounded-xl bg-white/15 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-white/25 hover:shadow-md active:scale-95 backdrop-blur-md"
            >
              + Purchase Order
            </Link>
            <Link
              href="/sales"
              className="rounded-xl bg-white/15 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-white/25 hover:shadow-md active:scale-95 backdrop-blur-md"
            >
              + Sales Order
            </Link>
            <Link
              href="/payments"
              className="rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-[#143e34] shadow-lg transition hover:bg-emerald-50 hover:shadow-xl active:scale-95"
            >
              Record Payment →
            </Link>
          </div>
        </div>
      </div>

      {/* 2. Core KPI Widgets (6 Required Widgets linked to reports) */}
      <div>
        <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-slate-500">
          Core Financial &amp; Operational KPIs (Click widget to open report)
        </h2>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {/* Widget 1: Today's Sales -> /reports */}
          <Link href="/reports" className="group block focus:outline-none">
            <Card className="h-full border-l-4 border-l-[#1a6b5a] bg-gradient-to-br from-white to-slate-50/60 shadow-sm transition-all duration-300 group-hover:-translate-y-1 group-hover:border-l-6 group-hover:shadow-md">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardDescription className="text-xs font-bold uppercase tracking-wider text-slate-500 group-hover:text-[#1a6b5a]">
                    Today&apos;s Sales
                  </CardDescription>
                  <span className="text-xs text-slate-400 group-hover:translate-x-0.5 transition-transform">↗</span>
                </div>
                <CardTitle className="font-serif text-2xl font-bold text-slate-900 sm:text-3xl">
                  {formatMoney(kpis.todaySalesRevenue, currency)}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-xs font-medium text-slate-600">
                  {kpis.todaySalesCount} invoice{kpis.todaySalesCount === 1 ? '' : 's'} posted today
                </p>
                <div className="mt-2 flex items-center gap-1 text-[11px] font-semibold text-[#1a6b5a]">
                  <span>Sales Summary Report</span>
                  <span>→</span>
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* Widget 2: Gross Profit (month) -> /reports */}
          <Link href="/reports" className="group block focus:outline-none">
            <Card
              className={cn(
                'h-full border-l-4 shadow-sm transition-all duration-300 group-hover:-translate-y-1 group-hover:border-l-6 group-hover:shadow-md',
                kpis.monthGrossProfit >= 0
                  ? 'border-l-indigo-600 bg-gradient-to-br from-white to-indigo-50/20'
                  : 'border-l-red-600 bg-gradient-to-br from-white to-red-50/20'
              )}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardDescription
                    className={cn(
                      'text-xs font-bold uppercase tracking-wider',
                      kpis.monthGrossProfit >= 0
                        ? 'text-indigo-800 group-hover:text-indigo-900'
                        : 'text-red-800 group-hover:text-red-900'
                    )}
                  >
                    Gross Profit (Month)
                  </CardDescription>
                  <span className="text-xs text-slate-400 group-hover:translate-x-0.5 transition-transform">↗</span>
                </div>
                <CardTitle
                  className={cn(
                    'font-serif text-2xl font-bold sm:text-3xl',
                    kpis.monthGrossProfit >= 0 ? 'text-indigo-950' : 'text-red-950'
                  )}
                >
                  {formatMoney(kpis.monthGrossProfit, currency)}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-xs font-medium text-slate-600">
                  Revenue − COGS on posted invoices this month
                </p>
                <div
                  className={cn(
                    'mt-2 flex items-center gap-1 text-[11px] font-semibold',
                    kpis.monthGrossProfit >= 0 ? 'text-indigo-700' : 'text-red-700'
                  )}
                >
                  <span>Profit &amp; Margin Report</span>
                  <span>→</span>
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* Widget 3: Receivables (AR) -> /arap */}
          <Link href="/arap" className="group block focus:outline-none">
            <Card className="h-full border-l-4 border-l-emerald-600 bg-gradient-to-br from-white to-emerald-50/20 shadow-sm transition-all duration-300 group-hover:-translate-y-1 group-hover:border-l-6 group-hover:shadow-md">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardDescription className="text-xs font-bold uppercase tracking-wider text-emerald-800 group-hover:text-emerald-900">
                    Receivables (AR)
                  </CardDescription>
                  <span className="text-xs text-slate-400 group-hover:translate-x-0.5 transition-transform">↗</span>
                </div>
                <CardTitle className="font-serif text-2xl font-bold text-emerald-950 sm:text-3xl">
                  {formatMoney(kpis.receivables, currency)}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-xs font-medium text-slate-600">
                  Owed by {kpis.arCount} customer{kpis.arCount === 1 ? '' : 's'}
                </p>
                <div className="mt-2 flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                  <span>AR/AP Aging Report</span>
                  <span>→</span>
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* Widget 4: Payables (AP) -> /arap */}
          <Link href="/arap" className="group block focus:outline-none">
            <Card className="h-full border-l-4 border-l-amber-600 bg-gradient-to-br from-white to-amber-50/20 shadow-sm transition-all duration-300 group-hover:-translate-y-1 group-hover:border-l-6 group-hover:shadow-md">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardDescription className="text-xs font-bold uppercase tracking-wider text-amber-800 group-hover:text-amber-900">
                    Payables (AP)
                  </CardDescription>
                  <span className="text-xs text-slate-400 group-hover:translate-x-0.5 transition-transform">↗</span>
                </div>
                <CardTitle className="font-serif text-2xl font-bold text-amber-950 sm:text-3xl">
                  {formatMoney(kpis.payables, currency)}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-xs font-medium text-slate-600">
                  Owed to {kpis.apCount} supplier{kpis.apCount === 1 ? '' : 's'}
                </p>
                <div className="mt-2 flex items-center gap-1 text-[11px] font-semibold text-amber-700">
                  <span>Supplier Balance Report</span>
                  <span>→</span>
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* Widget 5: Cash Position -> /payments */}
          <Link href="/payments" className="group block focus:outline-none">
            <Card
              className={cn(
                'h-full border-l-4 shadow-sm transition-all duration-300 group-hover:-translate-y-1 group-hover:border-l-6 group-hover:shadow-md',
                kpis.cashPosition >= 0
                  ? 'border-l-blue-600 bg-gradient-to-br from-white to-blue-50/20'
                  : 'border-l-red-600 bg-gradient-to-br from-white to-red-50/20'
              )}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardDescription
                    className={cn(
                      'text-xs font-bold uppercase tracking-wider',
                      kpis.cashPosition >= 0 ? 'text-blue-800 group-hover:text-blue-900' : 'text-red-800 group-hover:text-red-900'
                    )}
                  >
                    Net Cash Position
                  </CardDescription>
                  <span className="text-xs text-slate-400 group-hover:translate-x-0.5 transition-transform">↗</span>
                </div>
                <CardTitle
                  className={cn(
                    'font-serif text-2xl font-bold sm:text-3xl',
                    kpis.cashPosition >= 0 ? 'text-blue-950' : 'text-red-950'
                  )}
                >
                  {formatMoney(kpis.cashPosition, currency)}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-xs font-medium text-slate-600">
                  In: {formatMoney(kpis.cashIn, currency)} · Out: {formatMoney(kpis.cashOut, currency)}
                </p>
                <div
                  className={cn(
                    'mt-2 flex items-center gap-1 text-[11px] font-semibold',
                    kpis.cashPosition >= 0 ? 'text-blue-700' : 'text-red-700'
                  )}
                >
                  <span>Payments &amp; Cash Log</span>
                  <span>→</span>
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* Widget 6: Low-stock Alerts -> /reports */}
          <Link href="/reports" className="group block focus:outline-none">
            <Card
              className={cn(
                'h-full border-l-4 shadow-sm transition-all duration-300 group-hover:-translate-y-1 group-hover:border-l-6 group-hover:shadow-md',
                kpis.lowStockCount > 0
                  ? 'border-l-red-600 bg-gradient-to-br from-white to-red-50/30'
                  : 'border-l-emerald-600 bg-gradient-to-br from-white to-emerald-50/20'
              )}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardDescription
                    className={cn(
                      'text-xs font-bold uppercase tracking-wider',
                      kpis.lowStockCount > 0 ? 'text-red-800 group-hover:text-red-900' : 'text-emerald-800 group-hover:text-emerald-900'
                    )}
                  >
                    Low-Stock Alerts
                  </CardDescription>
                  <span className="text-xs text-slate-400 group-hover:translate-x-0.5 transition-transform">↗</span>
                </div>
                <CardTitle
                  className={cn(
                    'font-serif text-2xl font-bold sm:text-3xl',
                    kpis.lowStockCount > 0 ? 'text-red-950' : 'text-emerald-950'
                  )}
                >
                  {kpis.lowStockCount} item{kpis.lowStockCount === 1 ? '' : 's'}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-xs font-medium text-slate-600">
                  Total Catalog Valuation: {formatMoney(kpis.totalStockValue, currency)}
                </p>
                <div
                  className={cn(
                    'mt-2 flex items-center gap-1 text-[11px] font-semibold',
                    kpis.lowStockCount > 0 ? 'text-red-700' : 'text-emerald-700'
                  )}
                >
                  <span>Inventory Status Report</span>
                  <span>→</span>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>

      {/* 3. Operational Sections: Recent Invoices & Low Stock Priority */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Recent Invoices */}
        <Card className="flex flex-col justify-between border-slate-200/80 shadow-sm">
          <div>
            <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <CardTitle className="text-base font-bold text-slate-900">Recent Sales Invoices</CardTitle>
                <CardDescription className="text-xs">Latest customer billing activity</CardDescription>
              </div>
              <Link href="/sales" className="text-xs font-semibold text-[#1a6b5a] hover:underline">
                View all sales →
              </Link>
            </CardHeader>
            <CardContent className="p-0">
              {recentInvoices.length === 0 ? (
                <p className="p-6 text-sm text-slate-500">No invoices posted yet.</p>
              ) : (
                <div className="divide-y divide-slate-100 text-sm">
                  {recentInvoices.map((inv) => (
                    <div key={inv.id} className="flex items-center justify-between px-6 py-3.5 hover:bg-slate-50/80 transition-colors">
                      <div className="flex flex-col">
                        <span className="font-semibold text-slate-900">{inv.invoice_number}</span>
                        <span className="text-xs text-slate-500">
                          {inv.customer_name} · {formatDate(inv.invoice_date)}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-slate-900">{formatMoney(inv.total, currency)}</span>
                        <span
                          className={cn(
                            'rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase',
                            inv.status === 'issued' || inv.status === 'paid'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-100 text-slate-700'
                          )}
                        >
                          {inv.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </div>
          <div className="border-t border-slate-100 bg-slate-50/50 p-3 text-center">
            <Link href="/reports" className="text-xs font-semibold text-slate-600 hover:text-[#1a6b5a]">
              Generate detailed Sales Summary Report →
            </Link>
          </div>
        </Card>

        {/* Low Stock Critical Items */}
        <Card className="flex flex-col justify-between border-slate-200/80 shadow-sm">
          <div>
            <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <CardTitle className="text-base font-bold text-slate-900">Critical Stock Alerts</CardTitle>
                <CardDescription className="text-xs">Items at or below reorder threshold</CardDescription>
              </div>
              <Link href="/inventory" className="text-xs font-semibold text-[#1a6b5a] hover:underline">
                View inventory →
              </Link>
            </CardHeader>
            <CardContent className="p-0">
              {lowStockItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 text-center">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 font-bold text-lg">
                    ✓
                  </span>
                  <p className="mt-2 font-semibold text-slate-800">All stock levels healthy</p>
                  <p className="text-xs text-slate-500">No items currently below reorder threshold.</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 text-sm">
                  {lowStockItems.slice(0, 5).map((item) => (
                    <div key={item.inventory_id} className="flex items-center justify-between px-6 py-3.5 hover:bg-red-50/30 transition-colors">
                      <div className="flex flex-col">
                        <span className="font-semibold text-slate-900">{item.product_name}</span>
                        <span className="text-xs text-slate-500">
                          SKU: {item.sku} · {item.branch_name}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <span className="block font-bold text-red-700">
                            {item.quantity} {item.unit}
                          </span>
                          <span className="text-[11px] text-slate-400">
                            Min: {item.reorder_threshold}
                          </span>
                        </div>
                        <Link
                          href="/purchases"
                          className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 hover:bg-red-100 transition-colors"
                        >
                          Reorder
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </div>
          <div className="border-t border-slate-100 bg-slate-50/50 p-3 text-center">
            <Link href="/reports" className="text-xs font-semibold text-slate-600 hover:text-[#1a6b5a]">
              Generate Inventory Valuation &amp; Stock Report →
            </Link>
          </div>
        </Card>
      </div>

      {/* 4. Recent Payment & Cash Flow Activity */}
      <Card className="border-slate-200/80 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <CardTitle className="text-base font-bold text-slate-900">Recent Payment &amp; Cash Flow Activity</CardTitle>
            <CardDescription className="text-xs">Latest receipts from customers and disbursements to suppliers</CardDescription>
          </div>
          <Link href="/payments" className="text-xs font-semibold text-[#1a6b5a] hover:underline">
            View cash ledger →
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          {recentPayments.length === 0 ? (
            <p className="p-6 text-sm text-slate-500">No payment transactions recorded yet.</p>
          ) : (
            <div className="divide-y divide-slate-100 text-sm">
              {recentPayments.map((pay) => (
                <div key={pay.id} className="flex items-center justify-between px-6 py-3.5 hover:bg-slate-50/80 transition-colors">
                  <div className="flex items-center gap-3">
                    <span
                      className={cn(
                        'flex h-8 w-8 items-center justify-center rounded-full font-bold text-xs',
                        pay.direction === 'in' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                      )}
                    >
                      {pay.direction === 'in' ? '↓' : '↑'}
                    </span>
                    <div className="flex flex-col">
                      <span className="font-semibold text-slate-900">
                        {pay.party_name}
                      </span>
                      <span className="text-xs text-slate-500">
                        {pay.payment_number} · {formatDate(pay.payment_date)} · {pay.method.toUpperCase()}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span
                      className={cn(
                        'font-bold text-base',
                        pay.direction === 'in' ? 'text-emerald-700' : 'text-slate-900'
                      )}
                    >
                      {pay.direction === 'in' ? '+' : '-'}
                      {formatMoney(pay.amount, currency)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
        <div className="border-t border-slate-100 bg-slate-50/50 p-3 text-center">
          <Link href="/reports" className="text-xs font-semibold text-slate-600 hover:text-[#1a6b5a]">
            Generate Party Statement of Account Report →
          </Link>
        </div>
      </Card>
    </div>
  );
}
