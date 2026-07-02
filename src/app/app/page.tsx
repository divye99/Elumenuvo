import { Suspense } from "react";
import AppShell from "@/components/app/AppShell";
import { fetchProducts } from "@/lib/products";
import { getSiteContent } from "@/lib/content";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// The buyer workspace — open to everyone (sign-in optional). Signed-in users
// see their own identity in the topbar; guests get the demo persona.
export default async function Page() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [products, content] = await Promise.all([fetchProducts(), getSiteContent()]);
  return (
    <Suspense fallback={null}>
      <AppShell products={products} content={content} user={user ? { email: user.email ?? "" } : undefined} />
    </Suspense>
  );
}
