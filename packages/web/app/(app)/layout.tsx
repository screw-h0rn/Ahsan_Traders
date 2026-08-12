import Link from 'next/link';
import { can, getStaffProfile } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { SignOutButton } from '@/components/sign-out-button';
import { AppNav, MobileAppNav, type AppNavSection } from '@/components/app-nav';

// Every page in this group renders authed, per-tenant data — force dynamic so
// no page is ever statically prerendered (which breaks env-less CI builds).
export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await getStaffProfile();

  // Authenticated, but no readable app profile. Causes: the account was
  // deactivated (current_tenant_id() returns NULL, so RLS hides the row), or
  // public.users has no row bound to this auth id.
  //
  // This MUST render, never redirect. Redirecting to /login sends the user
  // into an infinite loop, because middleware bounces an authenticated
  // session away from /login straight back to /dashboard.
  if (!profile) return <NoWorkspace />;

  const canManageTeam = can(profile, 'staff.view');
  const supabase = await createClient();
  const [{ data: company }] = await Promise.all([
    supabase.from('company_settings').select('name').single(),
  ]);
  const navSections: AppNavSection[] = [
    {
      title: 'Main',
      items: [
        { href: '/dashboard', label: 'Dashboard' },
        ...(can(profile, 'sales.view')
          ? [
              { href: '/sales', label: 'Sales Orders' },
              { href: '/quotes', label: 'Quotations' },
            ]
          : []),
        ...(can(profile, 'purchases.view')
          ? [{ href: '/purchases', label: 'Purchases' }]
          : []),
        ...(can(profile, 'inventory.view')
          ? [
              { href: '/inventory', label: 'Inventory' },
              { href: '/transfers', label: 'Stock Transfers' },
            ]
          : []),
      ],
    },
    {
      title: 'Directory',
      items: [
        ...(can(profile, 'customers.view') ? [{ href: '/customers', label: 'Customers' }] : []),
        ...(can(profile, 'customer_accounts.manage')
          ? [{ href: '/customer-logins', label: 'Customer Logins' }]
          : []),
        ...(can(profile, 'suppliers.view') ? [{ href: '/suppliers', label: 'Suppliers' }] : []),
        ...(can(profile, 'catalog.view')
          ? [
              { href: '/products', label: 'Products' },
              { href: '/categories', label: 'Categories' },
            ]
          : []),
        ...(can(profile, 'branches.manage') ? [{ href: '/branches', label: 'Branches' }] : []),
      ],
    },
    {
      title: 'Finance',
      items: [
        ...(can(profile, 'finance.view')
          ? [
              { href: '/payments', label: 'Payments' },
              { href: '/arap', label: 'AR / AP' },
            ]
          : []),
        ...(can(profile, 'reports.view') ? [{ href: '/reports', label: 'Reports' }] : []),
      ],
    },
    {
      title: 'Admin',
      items: [
        ...(canManageTeam ? [{ href: '/staff', label: 'Team' }] : []),
        ...(can(profile, 'settings.manage') ? [{ href: '/settings', label: 'Settings' }] : []),
        { href: '/account', label: 'My Account' },
      ],
    },
  ].filter((section) => section.items.length > 0);
  const displayName = profile.full_name ?? profile.email ?? 'User';
  const initials = displayName
    .split(/\s|@/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

  return (
    <div className="flex min-h-full">
      <aside className="sticky top-0 hidden h-screen w-72 shrink-0 flex-col border-r border-white/70 bg-white/45 px-4 py-5 shadow-[20px_0_70px_-55px_rgba(40,60,55,0.55)] backdrop-blur-2xl lg:flex">
        <Link
          href="/dashboard"
          className="mb-8 flex min-w-0 items-center gap-3 rounded-[1.4rem] border border-white/75 bg-white/55 p-3 shadow-[0_14px_36px_-24px_rgba(40,60,55,0.45)]"
        >
          <span className="h-10 w-10 shrink-0 rounded-[14px] bg-[conic-gradient(from_210deg,#1a6b5a,#7fd6bd,#e88f6d,#1a6b5a)]" />
          <span className="min-w-0">
            <span className="block truncate text-sm font-bold text-[#14211d]">
              {company?.name ?? 'Distribution Platform'}
            </span>
            <span className="block text-xs font-medium text-[#6b7a74]">Operations portal</span>
          </span>
        </Link>

        <AppNav sections={navSections} />

        <div className="mt-6 rounded-[1.4rem] border border-white/75 bg-white/55 p-3">
          <div className="mb-3 flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-white/85 bg-gradient-to-br from-[#e88f6d] to-[#d96f66] text-sm font-bold text-white shadow-lg">
              {initials}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-[#14211d]">{displayName}</p>
              <p className="truncate text-xs text-[#6b7a74]">{profile.email}</p>
            </div>
          </div>
          <SignOutButton className="w-full justify-center" />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 border-b border-white/65 bg-[#f4faf6]/75 px-4 py-3 backdrop-blur-2xl lg:hidden">
          <div className="flex items-center justify-between gap-3">
            <Link
              href="/dashboard"
              className="flex min-w-0 items-center gap-2 font-bold text-[#14211d]"
            >
              <span className="h-9 w-9 shrink-0 rounded-[12px] bg-[conic-gradient(from_210deg,#1a6b5a,#7fd6bd,#e88f6d,#1a6b5a)]" />
              <span className="truncate">{company?.name ?? 'Distribution Platform'}</span>
            </Link>
            <MobileAppNav sections={navSections} />
          </div>
        </header>

        <main className="w-full flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}

/**
 * Terminal state for a signed-in account that resolves to no workspace.
 * Renders (never redirects) so the session can be ended cleanly instead of
 * ping-ponging between the layout and the auth middleware.
 */
function NoWorkspace() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-[1.6rem] border border-white/75 bg-white/60 p-7 text-center shadow-[0_24px_70px_-40px_rgba(40,60,55,0.5)] backdrop-blur-2xl">
        <span className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-[16px] bg-gradient-to-br from-[#e88f6d] to-[#d96f66] text-xl font-bold text-white">
          !
        </span>
        <h1 className="text-lg font-bold text-[#14211d]">This account has no workspace</h1>
        <p className="mt-2 text-sm leading-relaxed text-[#6b7a74]">
          You are signed in, but this login is not linked to an active company workspace. That
          usually means the account was deactivated by an owner, or it was never finished being
          set up.
        </p>
        <p className="mt-3 text-sm text-[#6b7a74]">
          Ask an owner of your company to reactivate or re-invite you, then sign in again.
        </p>
        <div className="mt-6 flex justify-center">
          <SignOutButton className="justify-center" />
        </div>
      </div>
    </div>
  );
}
