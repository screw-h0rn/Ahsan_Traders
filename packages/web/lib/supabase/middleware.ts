import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from '@at/shared';
import { assertSupabaseEnv, publicEnv } from '../env';

type CookieToSet = { name: string; value: string; options: CookieOptions };

/** Paths reachable without an authenticated session. */
const PUBLIC_PATHS = ['/', '/login', '/forgot-password', '/reset-password'];
/** Auth pages an authenticated user should be redirected away from. */
const AUTH_PATHS = ['/login', '/forgot-password'];

function isPublic(pathname: string): boolean {
  // /api/* routes are NOT gated here — each one enforces its own access
  // control (e.g. customer-signup is deliberately reachable by a signed-out
  // shopkeeper; anything needing a staff session checks for one itself using
  // requirePermission(), same as a server action would).
  return (
    PUBLIC_PATHS.includes(pathname) || pathname.startsWith('/auth') || pathname.startsWith('/api/')
  );
}

/**
 * Refreshes the Supabase session on every request and enforces route access.
 * Must run in middleware so refreshed auth cookies reach both the browser and
 * any downstream Server Components.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  try {
    assertSupabaseEnv();
  } catch (error) {
    console.error('Supabase environment is not configured for this request.', error);
    return response;
  }

  const supabase = createServerClient<Database>(
    publicEnv.supabaseUrl,
    publicEnv.supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // getUser() validates the JWT against the auth server — do not trust getSession() for authz.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (!user && !isPublic(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return copyCookies(response, NextResponse.redirect(url));
  }

  // 2FA enforcement: a password-only (aal1) session on an account with a
  // verified TOTP factor may only reach the /mfa challenge page. Without this,
  // a stolen password would bypass 2FA entirely.
  if (user && pathname !== '/mfa' && !isPublic(pathname)) {
    const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aal?.nextLevel === 'aal2' && aal.nextLevel !== aal.currentLevel) {
      const url = request.nextUrl.clone();
      url.pathname = '/mfa';
      url.search = '';
      return copyCookies(response, NextResponse.redirect(url));
    }
  }

  if (user && AUTH_PATHS.includes(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    url.search = '';
    return copyCookies(response, NextResponse.redirect(url));
  }

  return response;
}

/** Carry the refreshed auth cookies onto a redirect response. */
function copyCookies(from: NextResponse, to: NextResponse): NextResponse {
  from.cookies.getAll().forEach((cookie) => to.cookies.set(cookie));
  return to;
}
