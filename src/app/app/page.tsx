import { Suspense } from "react";
import { redirect } from "next/navigation";
import AppShell from "@/components/app/AppShell";
import { fetchProductsLite } from "@/lib/products";
import { getSiteContent } from "@/lib/content";
import { getProfile } from "@/lib/profile";
import { getLiveWorkspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

// The buyer workspace — sign-in required (real user base). New accounts must
// pick an account type in onboarding first.
export default async function Page() {
  const profile = await getProfile();
  if (!profile) redirect("/signin");
  if (!profile.account_type) redirect("/onboarding");

  const [products, content, live] = await Promise.all([
    fetchProductsLite(),
    getSiteContent(),
    getLiveWorkspace(profile.id, profile.email ?? null),
  ]);
  return (
    <Suspense fallback={null}>
      <AppShell
        products={products}
        content={content}
        live={live}
        user={{
          email: profile.email,
          name: profile.full_name ?? undefined,
          org: profile.company ?? undefined,
          accountType: profile.account_type,
          gstin: profile.gstin ?? undefined,
        }}
      />
    </Suspense>
  );
}
