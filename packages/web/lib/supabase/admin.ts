import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@at/shared';
import { getServiceRoleKey, publicEnv } from '../env';

/**
 * SERVER-ONLY admin client using the service-role key. Bypasses RLS — use it
 * only inside server actions/route handlers, and always after an explicit
 * permission check on the caller. Never import from a client component.
 */
export function createAdminClient() {
  return createSupabaseClient<Database>(publicEnv.supabaseUrl, getServiceRoleKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
