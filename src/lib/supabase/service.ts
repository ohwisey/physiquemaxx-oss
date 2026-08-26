import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client — SERVER ONLY. The "server-only" import makes
 * any client-reachable import of this module a build error, so the secret can
 * never be bundled. The key comes exclusively from the SUPABASE_SECRET_KEY
 * env var (the established Vercel convention for this infra); it must never
 * appear in NEXT_PUBLIC_* vars, logs, or commits.
 *
 * This client bypasses RLS. Callers MUST have already authorized the request
 * against the cookie-bound user client before touching it, and must fail
 * closed (analysis_persistence_not_configured) when the key is absent.
 */

/** True when the service-role path can operate in this environment. */
export function serviceRoleConfigured(): boolean {
  return Boolean(process.env.SUPABASE_SECRET_KEY && process.env.NEXT_PUBLIC_SUPABASE_URL);
}

/**
 * Fresh service client per request; throws (fail closed) when unconfigured —
 * callers surface that as the analysis_persistence_not_configured error.
 */
export function createServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secretKey) {
    throw new Error("analysis_persistence_not_configured");
  }
  return createSupabaseClient(url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
