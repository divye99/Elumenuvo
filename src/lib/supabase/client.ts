import { createBrowserClient } from "@supabase/ssr";

/** Browser Supabase client for Elume auth (email/password sign-in for /app). */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
