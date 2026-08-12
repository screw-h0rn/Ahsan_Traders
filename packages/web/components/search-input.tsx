import { Input } from '@at/ui';

/**
 * GET-form search box for server-filtered list pages. Submitting navigates to
 * `?q=…`, which the page reads from searchParams — no client JS required.
 */
export function SearchInput({
  placeholder,
  defaultValue,
}: {
  placeholder: string;
  defaultValue?: string;
}) {
  return (
    <form method="GET" className="relative w-full sm:max-w-xs">
      <span
        aria-hidden
        className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#6b7a74]"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.2-3.2" />
        </svg>
      </span>
      <Input
        type="search"
        name="q"
        placeholder={placeholder}
        defaultValue={defaultValue}
        className="pl-9"
        aria-label={placeholder}
      />
    </form>
  );
}
