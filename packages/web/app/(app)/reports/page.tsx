import { redirect } from 'next/navigation';
import { can, getStaffProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { ReportsClient, type ReportOptionBranch, type ReportOptionCategory, type ReportOptionParty } from './reports-client';

export default async function ReportsPage() {
  const caller = await getStaffProfile();
  if (!caller) redirect('/login');
  if (!can(caller, 'reports.view')) redirect('/dashboard');

  const supabase = await createClient();
  const [
    { data: branchesData },
    { data: categoriesData },
    { data: customersData },
    { data: suppliersData },
    { data: tenant },
    { data: initialSales },
    { data: initialInventory },
  ] = await Promise.all([
    supabase.from('branches').select('id,name').order('name'),
    supabase.from('categories').select('id,name').order('name'),
    supabase.from('customers').select('id,name,phone').eq('status', 'active').order('name'),
    supabase.from('suppliers').select('id,name,phone').eq('status', 'active').order('name'),
    supabase.from('company_settings').select('currency').single(),
    supabase.rpc('report_sales_summary', {}),
    supabase.rpc('report_inventory_status', {}),
  ]);

  const currency = tenant?.currency ?? 'PKR';

  const branches: ReportOptionBranch[] = (branchesData ?? []).map((b) => ({
    id: b.id,
    name: b.name,
  }));

  const categories: ReportOptionCategory[] = (categoriesData ?? []).map((c) => ({
    id: c.id,
    name: c.name,
  }));

  const customers: ReportOptionParty[] = (customersData ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    phone: c.phone,
  }));

  const suppliers: ReportOptionParty[] = (suppliersData ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    phone: s.phone,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Core Business Reports</h1>
        <p className="text-slate-500">
          Real-time, role-gated financial &amp; operational reports with CSV export and print options.
        </p>
      </div>

      <ReportsClient
        branches={branches}
        categories={categories}
        customers={customers}
        suppliers={suppliers}
        currency={currency}
        initialSalesData={initialSales ?? []}
        initialInventoryData={initialInventory ?? []}
      />
    </div>
  );
}
