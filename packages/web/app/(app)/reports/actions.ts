'use server';

import { optionalArg, type Database } from '@at/shared';
import { createClient } from '@/lib/supabase/server';
import { can, getStaffProfile } from '@/lib/auth';

type Fns = Database['public']['Functions'];
/** Row shapes come straight from the database, so they cannot drift. */
export type SalesSummaryRow = Fns['report_sales_summary']['Returns'][number];
export type InventoryStatusRow = Fns['report_inventory_status']['Returns'][number];
export type PartyStatementRow = Fns['report_party_statement']['Returns'][number];


export async function fetchSalesSummaryReport({
  startDate,
  endDate,
  customerId,
  branchId,
}: {
  startDate?: string;
  endDate?: string;
  customerId?: string;
  branchId?: string;
}) {
  const caller = await getStaffProfile();
  if (!caller || !can(caller, 'reports.view')) {
    return { error: 'Unauthorized', data: null };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('report_sales_summary', {
    p_start_date: startDate || undefined,
    p_end_date: endDate || undefined,
    p_customer_id: customerId || undefined,
    p_branch_id: branchId || undefined,
  });

  if (error) {
    return { error: error.message, data: null };
  }
  return { error: null, data: data ?? [] };
}

export type ProfitReportRow = Fns['report_profit']['Returns'][number];

export async function fetchProfitReport({
  startDate,
  endDate,
}: {
  startDate?: string;
  endDate?: string;
}) {
  const caller = await getStaffProfile();
  if (!caller || !can(caller, 'reports.view')) {
    return { error: 'Unauthorized', data: null };
  }

  const supabase = await createClient();
  // `get_profit_report` is not yet in the generated Database types — type the call locally.
  const { data, error } = await (supabase.rpc as unknown as (
    fn: string,
    args: Record<string, unknown>,
  ) => PromiseLike<{ data: ProfitReportRow[] | null; error: { message: string } | null }>)(
    'report_profit',
    {
      p_start_date: startDate || undefined,
      p_end_date: endDate || undefined,
    },
  );

  if (error) {
    return { error: error.message, data: null };
  }
  return { error: null, data: data ?? [] };
}

export async function fetchInventoryStatusReport({
  branchId,
  categoryId,
  lowStockOnly,
}: {
  branchId?: string;
  categoryId?: string;
  lowStockOnly?: boolean;
}) {
  const caller = await getStaffProfile();
  if (!caller || !can(caller, 'reports.view')) {
    return { error: 'Unauthorized', data: null };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('report_inventory_status', {
    p_branch_id: branchId || undefined,
    p_category_id: categoryId || undefined,
    p_low_stock_only: lowStockOnly || false,
  });

  if (error) {
    return { error: error.message, data: null };
  }
  return { error: null, data: data ?? [] };
}

export async function fetchPartyStatementReport({
  partyType,
  partyId,
  startDate,
  endDate,
}: {
  partyType: 'customer' | 'supplier';
  partyId: string;
  startDate?: string;
  endDate?: string;
}) {
  const caller = await getStaffProfile();
  if (!caller || !can(caller, 'reports.view')) {
    return { error: 'Unauthorized', data: null };
  }

  if (!partyId) {
    return { error: 'Please select a party.', data: null };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('report_party_statement', {
    p_party_type: partyType,
    p_party_id: optionalArg(partyId),
    p_start_date: startDate || undefined,
    p_end_date: endDate || undefined,
  });

  if (error) {
    return { error: error.message, data: null };
  }
  return { error: null, data: data ?? [] };
}
