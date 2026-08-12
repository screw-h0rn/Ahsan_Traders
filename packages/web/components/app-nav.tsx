'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@at/ui';

export type AppNavItem = { href: string; label: string };
export type AppNavSection = { title: string; items: AppNavItem[] };

function isActive(pathname: string, href: string): boolean {
  return href === '/dashboard' ? pathname === href : pathname.startsWith(href);
}

export function AppNav({ sections }: { sections: AppNavSection[] }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-1 flex-col gap-7 overflow-y-auto pr-1 text-sm">
      {sections.map((section) => (
        <div key={section.title} className="flex flex-col gap-2">
          <p className="px-3 text-[11px] font-bold uppercase tracking-[0.18em] text-[#8a9b94]">
            {section.title}
          </p>
          <div className="flex flex-col gap-1">
            {section.items.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'group flex items-center justify-between rounded-2xl px-3.5 py-2.5 font-semibold transition-all',
                    active
                      ? 'bg-[#143e34] text-[#f2faf6] shadow-[0_14px_30px_-20px_rgba(20,62,52,0.9)]'
                      : 'text-[#4c5b55] hover:bg-white/75 hover:text-[#14211d]',
                  )}
                >
                  <span>{item.label}</span>
                  {active && <span className="h-2 w-2 rounded-full bg-[#7fd6bd]" />}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

export function MobileAppNav({ sections }: { sections: AppNavSection[] }) {
  const pathname = usePathname();
  return (
    <details className="group relative">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-full border border-white/75 bg-white/65 px-4 py-2 text-sm font-bold text-[#14211d] shadow-[0_10px_34px_-18px_rgba(40,60,55,0.35)] backdrop-blur-2xl marker:hidden">
        Menu
        <span className="transition group-open:rotate-180">⌄</span>
      </summary>
      <div className="absolute right-0 z-50 mt-3 w-[min(88vw,22rem)] rounded-[1.75rem] border border-white/75 bg-[#f7fbf8]/95 p-3 shadow-2xl backdrop-blur-2xl">
        <nav className="max-h-[70vh] overflow-y-auto pr-1">
          {sections.map((section) => (
            <div key={section.title} className="mb-4 last:mb-0">
              <p className="mb-1 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-[#8a9b94]">
                {section.title}
              </p>
              <div className="flex flex-col gap-1">
                {section.items.map((item) => {
                  const active = isActive(pathname, item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        'rounded-2xl px-3.5 py-2.5 text-sm font-semibold transition-colors',
                        active
                          ? 'bg-[#143e34] text-[#f2faf6]'
                          : 'text-[#4c5b55] hover:bg-white hover:text-[#14211d]',
                      )}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </div>
    </details>
  );
}
