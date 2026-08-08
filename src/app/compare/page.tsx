import type { Metadata } from "next";
import Link from "next/link";
import StoreChrome from "@/components/storefront/StoreChrome";
import { listCompareGroupPages, COMPARE_PAGE_CATEGORIES } from "@/lib/compare/pages";
import { fmt } from "@/lib/format";
import { gstBreakdown } from "@/lib/pricing";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Compare electrical brands side by side - switches, MCBs, fans, lights",
  description:
    "Spec-verified, like-for-like comparisons across Havells, Legrand, Norisys, GM, Goldmedal, Anchor and more - same key specifications, live prices, side by side.",
  alternates: { canonical: "https://elumenuvo.com/compare" },
};

export default async function CompareIndex() {
  const groups = await listCompareGroupPages();
  const byCat = new Map<string, typeof groups>();
  for (const g of groups) (byCat.get(g.category) ?? byCat.set(g.category, []).get(g.category)!).push(g);

  return (
    <StoreChrome>
      <main style={{ maxWidth: 1120, margin: "0 auto", padding: "30px 24px 70px" }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.5px", margin: "0 0 6px" }}>Compare brands, like for like</h1>
        <p style={{ fontSize: 14, color: "#56627A", margin: "0 0 26px", maxWidth: 760 }}>
          Every comparison below is spec-verified: products appear together only when their key
          specifications match exactly (never just the looks). Prices are live from our catalogue.
        </p>
        {COMPARE_PAGE_CATEGORIES.filter((c) => byCat.has(c)).map((cat) => (
          <section key={cat} style={{ marginBottom: 30 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 12px" }}>{cat}</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
              {byCat.get(cat)!.map((g) => {
                const cheapest = g.members[0];
                const gb = gstBreakdown(cheapest.price, cheapest.cat, cheapest.gstRate);
                return (
                  <Link key={g.slug} href={`/compare/${g.slug}`} style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 14, padding: "14px 16px", display: "block" }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#19202E", textTransform: "capitalize" }}>{g.title}</div>
                    <div style={{ fontSize: 12, color: "#56627A", marginTop: 4 }}>{g.brands.join(" vs ")}</div>
                    <div style={{ fontSize: 12, color: "#8A93A6", marginTop: 6 }}>
                      {g.members.length} products · from <b style={{ color: "#19202E" }}>{fmt(gb.base)}</b> +GST
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
        {groups.length === 0 && <p style={{ color: "#8A93A6" }}>Comparisons are being prepared.</p>}
      </main>
    </StoreChrome>
  );
}
