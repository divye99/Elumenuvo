import { Suspense } from "react";
import { redirect } from "next/navigation";
import AppShell from "@/components/app/AppShell";
import { fetchProducts } from "@/lib/products";
import { getSiteContent } from "@/lib/content";
import { getProfile } from "@/lib/profile";

export const dynamic = "force-dynamic";

// The buyer workspace — sign-in required (real user base). New accounts must
// pick an account type in onboarding first.
export default async function Page() {
  const profile = await getProfile();
  if (!profile) redirect("/signin");
  if (!profile.account_type) redirect("/onboarding");

  const [products, content] = await Promise.all([fetchProducts(), getSiteContent()]);
  return (
    <Suspense fallback={null}>
      <AppShell
        products={products}
        content={content}
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
