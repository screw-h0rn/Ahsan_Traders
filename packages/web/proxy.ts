import type { NextRequest } from 'next/server';
import { updateSession } from './lib/supabase/middleware';

// Next.js 16 "proxy" convention (formerly middleware). Runs before rendering to
// refresh the Supabase session and gate protected routes.
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static, _next/image (build assets)
     * - favicon and common static file extensions
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
