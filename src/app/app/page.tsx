import { Suspense } from "react";
import { redirect } from "next/navigation";
import AppShell from "@/components/app/AppShell";
import { fetchProducts } from "@/lib/products";
import { getSiteContent } from "@/lib/content";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// The buyer app — gated behind sign-in (soft launch for existing users).
export default async function Page() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signin");

  const [products, content] = await Promise.all([fetchProducts(), getSiteContent()]);
  return (
    <Suspense fallback={null}>
      <AppShell products={products} content={content} user={{ email: user.email ?? "" }} />
    </Suspense>
  );
}
