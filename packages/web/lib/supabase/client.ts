'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@at/shared';
import { assertSupabaseEnv, publicEnv } from '../env';

/**
 * Supabase client for use in browser/client components.
 * Uses the anon key; all access is constrained by Row-Level Security.
 */
export function createClient() {
  assertSupabaseEnv();
  return createBrowserClient<Database>(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey);
}
