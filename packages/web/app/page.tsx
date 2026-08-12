import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getStaffProfile } from '@/lib/auth';

// Reads the auth session (to bounce signed-in users to /dashboard), so it can
// never be statically prerendered — that breaks env-less CI builds.
export const dynamic = 'force-dynamic';

export default async function Home() {
  const profile = await getStaffProfile();
  if (profile) {
    redirect('/dashboard');
  }

  return (
    <div className="min-h-screen bg-[#0a1a14] text-[#e8f5f0] antialiased selection:bg-[#7fd6bd]/30 selection:text-[#7fd6bd]">
      {/* Background Glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="anim-float absolute -left-40 -top-40 h-[600px] w-[600px] rounded-full bg-[radial-gradient(circle_at_center,#1a6b5a_0,transparent_70%)] opacity-25 blur-3xl" />
        <div className="anim-float absolute -right-40 top-1/3 h-[500px] w-[500px] rounded-full bg-[radial-gradient(circle_at_center,#e88f6d_0,transparent_70%)] opacity-15 blur-3xl [animation-delay:4.5s]" />
      </div>

      {/* Top Navbar */}
      <header className="relative z-10 border-b border-white/10 bg-[#0a1a14]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[conic-gradient(from_210deg,#1a6b5a,#7fd6bd,#e88f6d,#1a6b5a)] shadow-lg shadow-[#1a6b5a]/30" />
            <div className="flex flex-col">
              <span className="font-serif text-2xl font-bold tracking-tight text-white">
                Distribution Platform
              </span>
              <span className="text-[10px] font-medium tracking-wider text-[#7fd6bd] uppercase">
                Enterprise SaaS
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="rounded-full border border-white/20 bg-white/5 px-5 py-2 text-sm font-semibold text-white backdrop-blur-md transition hover:bg-white/10"
            >
              Sign In
            </Link>
            <Link
              href="/login"
              className="rounded-full bg-gradient-to-r from-[#1a6b5a] to-[#7fd6bd] px-5 py-2 text-sm font-semibold text-[#0a1a14] shadow-lg shadow-[#7fd6bd]/20 transition hover:brightness-110"
            >
              Start Free Trial
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="relative z-10 mx-auto max-w-7xl px-6 pt-16 pb-24">
        <div className="flex flex-col items-center text-center">
          <div className="anim-fade-up inline-flex items-center gap-2 rounded-full border border-[#7fd6bd]/30 bg-[#142a22]/80 px-4 py-1.5 text-xs font-medium text-[#7fd6bd] shadow-inner">
            <span className="h-2 w-2 rounded-full bg-[#e88f6d] animate-pulse" />
            Phase 1 MVP Complete · Web & Mobile Field Sales Ready
          </div>

          <h1 className="anim-fade-up anim-d1 mt-8 max-w-4xl font-serif text-5xl font-extrabold tracking-tight text-white sm:text-6xl lg:text-7xl">
            The Operating System for{' '}
            <span className="bg-gradient-to-r from-[#7fd6bd] via-[#a8e6cf] to-[#e88f6d] bg-clip-text text-transparent">
              High-Speed Distribution
            </span>
          </h1>

          <p className="anim-fade-up anim-d2 mt-6 max-w-2xl text-lg text-[#9fbfb3] sm:text-xl">
            Streamline your wholesale business across Pakistan. Manage suppliers, multi-branch
            inventory, instant GST invoicing, party balances, and field sales in real time.
          </p>

          <div className="anim-fade-up anim-d3 mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/login"
              className="flex h-14 items-center justify-center rounded-2xl bg-[#1a6b5a] px-8 text-base font-bold text-white shadow-xl shadow-[#1a6b5a]/40 transition hover:-translate-y-0.5 hover:bg-[#20836e]"
            >
              Sign In to Portal →
            </Link>
            <Link
              href="/login"
              className="flex h-14 items-center justify-center rounded-2xl border border-white/20 bg-white/5 px-8 text-base font-bold text-white backdrop-blur-xl transition hover:-translate-y-0.5 hover:bg-white/10"
            >
              Register New Tenant
            </Link>
          </div>
        </div>

        {/* Role-based access showcase */}
        <div className="anim-fade-up anim-d4 mt-16 rounded-3xl border border-[#7fd6bd]/20 bg-[#142a22]/60 p-8 shadow-2xl backdrop-blur-2xl transition hover:border-[#7fd6bd]/40">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-xl">
              <span className="text-xs font-bold tracking-widest text-[#e88f6d] uppercase">
                ⚡ Built for Teams
              </span>
              <h2 className="mt-1 font-serif text-2xl font-bold text-white">
                Five Roles, One Isolated Workspace
              </h2>
              <p className="mt-2 text-sm text-[#9fbfb3]">
                Every tenant is isolated by database row-level security. Owners see
                everything; managers, sales reps, warehouse staff, and accountants each
                get exactly the screens and actions their role allows — enforced in the
                database, not just the UI.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-[#0a1a14]/80 p-4">
                <span className="rounded-md bg-[#1a6b5a]/40 px-2 py-0.5 text-[11px] font-bold text-[#7fd6bd] uppercase">
                  Owner &amp; Manager
                </span>
                <p className="mt-3 text-xs leading-relaxed text-[#9fbfb3]">
                  Dashboards, purchasing, invoicing, payments, reports, team and company
                  settings — full command of the operation.
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-[#0a1a14]/80 p-4">
                <span className="rounded-md bg-[#e88f6d]/30 px-2 py-0.5 text-[11px] font-bold text-[#e88f6d] uppercase">
                  Field &amp; Back Office
                </span>
                <p className="mt-3 text-xs leading-relaxed text-[#9fbfb3]">
                  Sales reps book orders (even offline, on mobile), warehouse staff move
                  stock, accountants run the ledger — nothing more, nothing less.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Bento Grid Features */}
        <div className="mt-16 grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="anim-fade-up anim-d5 rounded-3xl border border-white/10 bg-[#142a22]/40 p-8 transition duration-300 hover:-translate-y-1 hover:border-[#7fd6bd]/40 hover:bg-[#142a22]/60">
            <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#1a6b5a]/30 text-2xl">
              📦
            </div>
            <h3 className="font-serif text-xl font-bold text-white">Real-Time Inventory</h3>
            <p className="mt-2 text-sm text-[#9fbfb3]">
              Multi-branch stock tracking with automated low-stock thresholds. Every adjustment is
              recorded with immutable stock movement trails.
            </p>
          </div>

          <div className="anim-fade-up anim-d5 rounded-3xl border border-white/10 bg-[#142a22]/40 p-8 transition duration-300 hover:-translate-y-1 hover:border-[#7fd6bd]/40 hover:bg-[#142a22]/60">
            <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#e88f6d]/20 text-2xl">
              💵
            </div>
            <h3 className="font-serif text-xl font-bold text-white">AR/AP & Running Ledger</h3>
            <p className="mt-2 text-sm text-[#9fbfb3]">
              Automated customer receivables and supplier payables calculated from immutable
              append-only ledgers and credit limit checks.
            </p>
          </div>

          <div className="anim-fade-up anim-d5 rounded-3xl border border-white/10 bg-[#142a22]/40 p-8 transition duration-300 hover:-translate-y-1 hover:border-[#7fd6bd]/40 hover:bg-[#142a22]/60">
            <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#7fd6bd]/20 text-2xl">
              📱
            </div>
            <h3 className="font-serif text-xl font-bold text-white">Offline Field Sales App</h3>
            <p className="mt-2 text-sm text-[#9fbfb3]">
              Dedicated React Native (Expo) mobile app for field reps. Book orders and capture
              payments offline with automatic background sync.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 bg-[#0a1a14] py-8 text-center text-xs text-[#6b8a7e]">
        <p>Distribution Platform © 2026 · Built for Pakistan SMB Distributors</p>
      </footer>
    </div>
  );
}
