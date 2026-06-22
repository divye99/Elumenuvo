import { createBrowserClient } from "@supabase/ssr";

/* Browser Supabase client. Env vars are public (anon/publishable key),
   safe to ship to the client; row access is protected by RLS. */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

if (typeof window !== "undefined" && (!supabaseUrl || !supabaseAnonKey)) {
  // eslint-disable-next-line no-console
  console.error(
    "[Supabase] Missing env vars.",
    "NEXT_PUBLIC_SUPABASE_URL:",
    supabaseUrl ? "set" : "MISSING",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY:",
    supabaseAnonKey ? "set" : "MISSING",
  );
}

export function createClient() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "SUPABASE_NOT_CONFIGURED: Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
