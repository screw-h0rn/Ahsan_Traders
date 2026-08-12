import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, cn } from '@at/ui';
import { can, getStaffProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { formatDate } from '@/lib/format';
import { ApproveNewCustomerForm, BlockLoginButton, LinkLoginForm } from './link-form';

export const dynamic = 'force-dynamic';

const STATUS_BADGE: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-800',
  pending: 'bg-amber-100 text-amber-800',
  blocked: 'bg-slate-200 text-slate-700',
};

const STATUS_LABEL: Record<string, string> = {
  active: 'Active',
  pending: 'Waiting to be linked',
  blocked: 'Access withdrawn',
};

export default async function CustomerLoginsPage() {
  const caller = await getStaffProfile();
  if (!caller) redirect('/login');
  if (!can(caller, 'customer_accounts.manage')) redirect('/dashboard');

  const supabase = await createClient();
  const [{ data: accounts }, { data: customers }] = await Promise.all([
    supabase
      .from('customer_accounts')
      .select(
        'id, phone, status, created_at, linked_at, requested_shop_name, requested_city, customers(id, name, phone)',
      )
      .order('created_at', { ascending: false }),
    supabase
      .from('customers')
      .select('id, name, phone')
      .eq('status', 'active')
      .order('name'),
  ]);

  const rows = accounts ?? [];
  const pending = rows.filter((row) => row.status === 'pending');
  const linkable = customers ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Customer logins</h1>
        <p className="text-slate-500">
          Shops that have signed up in the mobile app. A shop can browse the catalogue, place
          orders and see its own balance — nothing else.
        </p>
      </div>

      {pending.length > 0 ? (
        <Card className="border-amber-200 bg-amber-50/60">
          <CardHeader>
            <CardTitle className="text-amber-900">
              {pending.length} login{pending.length === 1 ? '' : 's'} waiting to be linked
            </CardTitle>
            <CardDescription className="text-amber-800">
              These people signed up with a phone number that does not match any customer on
              file. Until you approve them they can see nothing at all. Check what they entered
              against what you know before approving — if a shop you already know, link them to
              its existing record; if genuinely new, create a customer from their details.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>All logins</CardTitle>
          <CardDescription>
            A shop whose number already matches a customer is linked automatically at signup.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-slate-500">
              No shop has signed up in the app yet. Ask a customer to install it and register
              with the phone number you hold for them — they will be linked automatically.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-500">
                  <th className="px-5 py-3">Phone</th>
                  <th className="px-5 py-3">Claimed / linked shop</th>
                  <th className="px-5 py-3">Signed up</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b border-slate-100 align-middle">
                    <td className="px-5 py-3 font-medium text-slate-900">{row.phone ?? '—'}</td>
                    <td className="px-5 py-3">
                      {row.customers ? (
                        <Link
                          href={`/customers/${row.customers.id}`}
                          className="text-brand-700 hover:underline"
                        >
                          {row.customers.name}
                        </Link>
                      ) : row.requested_shop_name ? (
                        <div>
                          <p className="font-medium text-slate-900">{row.requested_shop_name}</p>
                          {row.requested_city ? (
                            <p className="text-xs text-slate-500">{row.requested_city}</p>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-slate-400">No details given</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-slate-500">{formatDate(row.created_at)}</td>
                    <td className="px-5 py-3">
                      <span
                        className={cn(
                          'rounded-md px-2 py-0.5 text-xs font-medium',
                          STATUS_BADGE[row.status] ?? 'bg-slate-200 text-slate-700',
                        )}
                      >
                        {STATUS_LABEL[row.status] ?? row.status}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex flex-col items-end gap-2">
                        {row.status === 'pending' ? (
                          <>
                            <ApproveNewCustomerForm
                              accountId={row.id}
                              defaultName={row.requested_shop_name}
                              defaultPhone={row.phone}
                              defaultAddress={row.requested_city}
                            />
                            <LinkLoginForm accountId={row.id} customers={linkable} />
                            <BlockLoginButton accountId={row.id} label="Reject" />
                          </>
                        ) : row.status === 'active' ? (
                          <BlockLoginButton accountId={row.id} />
                        ) : (
                          <LinkLoginForm accountId={row.id} customers={linkable} />
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
