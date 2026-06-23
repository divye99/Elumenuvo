import { createClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client — bypasses RLS for admin writes.
 * SERVER-ONLY: never import this into a client component. Reads the secret
 * SUPABASE_SERVICE_ROLE_KEY (never NEXT_PUBLIC).
 */
export function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}
