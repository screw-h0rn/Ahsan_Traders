'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, cn } from '@at/ui';
import { formatMoney } from '@/lib/format';

export type PartyBalanceItem = {
  party_id: string;
  party_name: string;
  party_phone: string | null;
  opening_balance: number;
  total_debit: number;
  total_credit: number;
  current_balance: number;
  credit_limit: number | null;
};

export function ArapTabs({
  customers,
  suppliers,
  currency,
}: {
  customers: PartyBalanceItem[];
  suppliers: PartyBalanceItem[];
  currency: string;
}) {
  const [tab, setTab] = useState<'ar' | 'ap'>('ar');
  const [search, setSearch] = useState('');

  const filteredCustomers = customers.filter(
    (c) =>
      c.party_name.toLowerCase().includes(search.toLowerCase()) ||
      (c.party_phone && c.party_phone.includes(search))
  );

  const filteredSuppliers = suppliers.filter(
    (s) =>
      s.party_name.toLowerCase().includes(search.toLowerCase()) ||
      (s.party_phone && s.party_phone.includes(search))
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex gap-2 border-b border-slate-200">
          <button
            type="button"
            onClick={() => setTab('ar')}
            className={cn(
              'border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors',
              tab === 'ar'
                ? 'border-[#1a6b5a] text-[#1a6b5a]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            )}
          >
            Accounts Receivable (AR)
            <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-normal text-slate-600">
              {customers.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setTab('ap')}
            className={cn(
              'border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors',
              tab === 'ap'
                ? 'border-[#1a6b5a] text-[#1a6b5a]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            )}
          >
            Accounts Payable (AP)
            <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-normal text-slate-600">
              {suppliers.length}
            </span>
          </button>
        </div>

        <div className="w-full sm:w-72">
          <input
            type="text"
            placeholder={`Search ${tab === 'ar' ? 'customers' : 'suppliers'}...`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-[#1a6b5a] focus:ring-1 focus:ring-[#1a6b5a]"
          />
        </div>
      </div>

      {tab === 'ar' ? (
        <Card>
          <CardHeader>
            <CardTitle>Accounts Receivable (Customer Balances)</CardTitle>
            <CardDescription>
              Money owed to you by customers. Derived in real-time from opening balances and ledger transactions.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {filteredCustomers.length === 0 ? (
              <p className="px-5 pb-5 text-sm text-slate-500">No customers matching query.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                      <th className="px-5 py-3 font-medium">Customer</th>
                      <th className="px-5 py-3 font-medium">Phone</th>
                      <th className="px-5 py-3 font-medium text-right">Credit Limit</th>
                      <th className="px-5 py-3 font-medium text-right">Opening</th>
                      <th className="px-5 py-3 font-medium text-right">Invoices (Dr)</th>
                      <th className="px-5 py-3 font-medium text-right">Receipts (Cr)</th>
                      <th className="px-5 py-3 font-medium text-right">Current Balance</th>
                      <th className="px-5 py-3 font-medium text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCustomers.map((c) => {
                      const isOverLimit =
                        c.credit_limit !== null &&
                        c.credit_limit > 0 &&
                        c.current_balance > c.credit_limit;
                      return (
                        <tr
                          key={c.party_id}
                          className="border-b border-slate-100 last:border-0 hover:bg-slate-50"
                        >
                          <td className="px-5 py-3 font-medium text-slate-900">
                            {c.party_name}
                            {isOverLimit && (
                              <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700">
                                Over limit
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-3 text-slate-600">{c.party_phone ?? '—'}</td>
                          <td className="px-5 py-3 text-right text-slate-600">
                            {c.credit_limit && c.credit_limit > 0
                              ? formatMoney(c.credit_limit, currency)
                              : 'No limit'}
                          </td>
                          <td className="px-5 py-3 text-right text-slate-600">
                            {formatMoney(c.opening_balance, currency)}
                          </td>
                          <td className="px-5 py-3 text-right text-slate-600">
                            {formatMoney(c.total_debit, currency)}
                          </td>
                          <td className="px-5 py-3 text-right text-slate-600">
                            {formatMoney(c.total_credit, currency)}
                          </td>
                          <td
                            className={cn(
                              'px-5 py-3 text-right font-bold',
                              c.current_balance > 0 ? 'text-emerald-700' : 'text-slate-900'
                            )}
                          >
                            {formatMoney(c.current_balance, currency)}
                          </td>
                          <td className="px-5 py-3 text-right">
                            <Link
                              href={`/customers/${c.party_id}`}
                              className="font-semibold text-[#1a6b5a] hover:underline"
                            >
                              Ledger →
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Accounts Payable (Supplier Balances)</CardTitle>
            <CardDescription>
              Money you owe to suppliers. Derived in real-time from opening balances and ledger transactions.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {filteredSuppliers.length === 0 ? (
              <p className="px-5 pb-5 text-sm text-slate-500">No suppliers matching query.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                      <th className="px-5 py-3 font-medium">Supplier</th>
                      <th className="px-5 py-3 font-medium">Phone</th>
                      <th className="px-5 py-3 font-medium text-right">Opening</th>
                      <th className="px-5 py-3 font-medium text-right">Payments (Dr)</th>
                      <th className="px-5 py-3 font-medium text-right">GRNs (Cr)</th>
                      <th className="px-5 py-3 font-medium text-right">Current Balance</th>
                      <th className="px-5 py-3 font-medium text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSuppliers.map((s) => (
                      <tr
                        key={s.party_id}
                        className="border-b border-slate-100 last:border-0 hover:bg-slate-50"
                      >
                        <td className="px-5 py-3 font-medium text-slate-900">{s.party_name}</td>
                        <td className="px-5 py-3 text-slate-600">{s.party_phone ?? '—'}</td>
                        <td className="px-5 py-3 text-right text-slate-600">
                          {formatMoney(s.opening_balance, currency)}
                        </td>
                        <td className="px-5 py-3 text-right text-slate-600">
                          {formatMoney(s.total_debit, currency)}
                        </td>
                        <td className="px-5 py-3 text-right text-slate-600">
                          {formatMoney(s.total_credit, currency)}
                        </td>
                        <td
                          className={cn(
                            'px-5 py-3 text-right font-bold',
                            s.current_balance > 0 ? 'text-amber-700' : 'text-slate-900'
                          )}
                        >
                          {formatMoney(s.current_balance, currency)}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <Link
                            href={`/suppliers/${s.party_id}`}
                            className="font-semibold text-[#1a6b5a] hover:underline"
                          >
                            Ledger →
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
