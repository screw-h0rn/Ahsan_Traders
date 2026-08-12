import { redirect } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, cn } from '@at/ui';
import { createClient } from '@/lib/supabase/server';
import { can, getStaffProfile } from '@/lib/auth';
import { InviteForm } from './invite-form';
import { StaffStatusButton } from './staff-status-button';

const ROLE_LABEL: Record<string, string> = {
  owner: 'Owner',
  manager: 'Manager',
  sales: 'Sales',
  warehouse: 'Warehouse',
  accountant: 'Accountant',
};

export default async function UsersPage() {
  const caller = await getStaffProfile();
  if (!caller) redirect('/login');
  // Permission-gated: anyone without users.view lands back on the dashboard.
  if (!can(caller, 'staff.view')) redirect('/dashboard');

  const supabase = await createClient();
  // RLS scopes this to the caller's tenant automatically.
  const { data: users } = await supabase
    .from('staff')
    .select('id, email, full_name, role, status, created_at')
    .order('created_at', { ascending: true });

  const isOwner = can(caller, 'staff.manage');

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Team</h1>
        <p className="text-slate-500">People with access to your company workspace.</p>
      </div>

      {isOwner && <InviteForm />}

      <Card>
        <CardHeader>
          <CardTitle>Members</CardTitle>
          <CardDescription>
            {users?.length ?? 0} user{(users?.length ?? 0) === 1 ? '' : 's'} in your company
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-5 py-3 font-medium">Name</th>
                <th className="px-5 py-3 font-medium">Email</th>
                <th className="px-5 py-3 font-medium">Role</th>
                <th className="px-5 py-3 font-medium">Status</th>
                {isOwner && <th className="px-5 py-3 font-medium">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {(users ?? []).map((u) => (
                <tr key={u.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-5 py-3 font-medium text-slate-900">
                    {u.full_name ?? '—'}
                    {u.id === caller.id && (
                      <span className="ml-2 text-xs text-slate-400">(you)</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-slate-600">{u.email}</td>
                  <td className="px-5 py-3">
                    <span className="rounded-md bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-700">
                      {ROLE_LABEL[u.role] ?? u.role}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={cn(
                        'rounded-md px-2 py-0.5 text-xs font-medium',
                        u.status === 'active'
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-slate-200 text-slate-600',
                      )}
                    >
                      {u.status}
                    </span>
                  </td>
                  {isOwner && (
                    <td className="px-5 py-3">
                      {u.id !== caller.id && u.role !== 'owner' ? (
                        <StaffStatusButton
                          staffId={u.id}
                          currentStatus={u.status as 'active' | 'inactive'}
                        />
                      ) : (
                        <span className="text-xs text-slate-300">—</span>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
