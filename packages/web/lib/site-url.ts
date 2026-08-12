import { headers } from 'next/headers';

/**
 * Resolve the site's origin (e.g. http://localhost:3000) for building absolute
 * redirect URLs in auth emails. Prefers an explicit env var, falls back to the
 * request headers.
 */
export async function getSiteUrl(): Promise<string> {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/$/, '');

  const h = await headers();
  const host =
    h.get('x-forwarded-host') ??
    h.get('host') ??
    process.env.NEXT_PUBLIC_VERCEL_URL ??
    'localhost:3000';
  const protocol =
    h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  return `${protocol}://${host}`;
}
