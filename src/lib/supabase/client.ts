"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Browser Supabase client (@supabase/ssr). The session lives in cookies so
 * the proxy auth gate and any server code can read it. Only the two
 * non-secret NEXT_PUBLIC_SUPABASE_* values ever reach this file — RLS is the
 * security boundary (your security setup).
 */

export function supabaseEnv(): { url: string; key: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase is not configured — set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
    );
  }
  return { url, key };
}

let browserClient: SupabaseClient | null = null;

/** Singleton browser client — one auth state for the whole tab. */
export function createClient(): SupabaseClient {
  if (browserClient) return browserClient;
  const { url, key } = supabaseEnv();
  browserClient = createBrowserClient(url, key);
  return browserClient;
}
