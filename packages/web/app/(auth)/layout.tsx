import Link from 'next/link';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-8 flex flex-col items-center gap-1">
          <span className="mb-2 h-10 w-10 rounded-xl bg-[conic-gradient(from_210deg,#1a6b5a,#7fd6bd,#e88f6d,#1a6b5a)] shadow-lg" />
          <span className="font-serif text-3xl text-[#14211d]">Distribution Platform</span>
          <span className="text-xs text-[#6b7a74]">The operating system for your business</span>
        </Link>
        {children}
      </div>
    </div>
  );
}
