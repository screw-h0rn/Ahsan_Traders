/**
 * Centralized access to environment variables.
 *
 * NEXT_PUBLIC_* values are inlined at build time and safe for the browser.
 * We intentionally do NOT throw at module load (that would break `next build`
 * in CI where no .env is present) — validation happens lazily when a Supabase
 * client is actually created at runtime.
 */

export const publicEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
};

/** Throws a helpful error at runtime if the public Supabase env is missing. */
export function assertSupabaseEnv(): void {
  if (!publicEnv.supabaseUrl || !publicEnv.supabaseAnonKey) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY. ' +
        'Copy web/.env.example to web/.env.local and fill in your Supabase keys.',
    );
  }
}

/** Server-only. Throws if missing or if accessed in a client bundle. */
export function getServiceRoleKey(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY (server-only).');
  return key;
}
