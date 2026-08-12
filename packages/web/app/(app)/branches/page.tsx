import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, cn } from '@at/ui';
import { createClient } from '@/lib/supabase/server';
import { can, getStaffProfile } from '@/lib/auth';
import { BranchForm } from './branch-form';

export default async function BranchesPage() {
  const caller = await getStaffProfile();
  if (!caller) redirect('/login');
  if (!can(caller, 'branches.manage')) redirect('/dashboard');

  const supabase = await createClient();
  const [{ data: branches }, { data: stockRows }] = await Promise.all([
    supabase
      .from('branches')
      .select('id, name, type, status, created_at')
      .order('created_at', { ascending: true }),
    supabase.from('inventory').select('branch_id, quantity'),
  ]);

  const list = branches ?? [];
  const skuCountByBranch = new Map<string, number>();
  for (const row of stockRows ?? []) {
    if (Number(row.quantity) > 0) {
      skuCountByBranch.set(row.branch_id, (skuCountByBranch.get(row.branch_id) ?? 0) + 1);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Branches</h1>
        <p className="text-slate-500">
          The locations your business operates from — each holds its own stock.
        </p>
      </div>

      <BranchForm />

      <Card>
        <CardHeader>
          <CardTitle>All locations</CardTitle>
          <CardDescription>
            {list.length} location{list.length === 1 ? '' : 's'}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-5 py-3 font-medium">Name</th>
                <th className="px-5 py-3 font-medium">Type</th>
                <th className="px-5 py-3 font-medium text-right">Stocked products</th>
                <th className="px-5 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {list.map((b) => (
                <tr key={b.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                  <td className="px-5 py-3">
                    <Link
                      href={`/branches/${b.id}`}
                      className="font-medium text-brand-700 hover:underline"
                    >
                      {b.name}
                    </Link>
                  </td>
                  <td className="px-5 py-3 capitalize text-slate-600">{b.type}</td>
                  <td className="px-5 py-3 text-right text-slate-600">
                    {skuCountByBranch.get(b.id) ?? 0}
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={cn(
                        'rounded-md px-2 py-0.5 text-xs font-medium',
                        b.status === 'active'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-slate-200 text-slate-600',
                      )}
                    >
                      {b.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
