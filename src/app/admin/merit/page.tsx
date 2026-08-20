import { requireAdmin } from "@/lib/admin/auth";
import { fetchProducts } from "@/lib/products";
import { loadSearchSignals } from "@/lib/search-signals";
import { loadMerit } from "@/lib/merit";
import MeritPanel, { type MeritRow } from "./MeritPanel";

/** /admin/merit: the transparency + intervention surface for the EMS engine.
 *  Shows exactly the score the storefront's featured ordering uses, pillar
 *  by pillar, plus cooldown/exploration state and manual controls. */
export const dynamic = "force-dynamic";

export default async function MeritPage() {
  await requireAdmin();
  const [products, signals] = await Promise.all([fetchProducts(), loadSearchSignals()]);
  const merit = await loadMerit(products, signals.pickTotals);

  if (!merit) {
    return (
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 8px" }}>Merit engine</h1>
        <p style={{ fontSize: 14, color: "#56627A" }}>
          Could not load merit inputs. Check that migration 0122 (merit_overrides + explore_log) has been run and the service role key is set.
        </p>
      </div>
    );
  }

  const cooldown = new Set(merit.cooldownIds);
  const rows: MeritRow[] = products
    .map((p) => {
      const parts = merit.parts[p.id];
      return {
        id: p.id,
        name: p.name,
        brand: p.brand,
        cat: p.cat,
        ems: merit.ems[p.id] ?? 0,
        velocity: parts?.velocity ?? 0,
        pickRate: parts?.pickRate ?? 0,
        cartRate: parts?.cartRate ?? 0,
        buyRate: parts?.buyRate ?? 0,
        review: parts?.review ?? 0,
        value: parts?.value ?? 0,
        promoter: parts?.promoter ?? 0,
        override: parts?.override ?? 0,
        suppressed: parts?.suppressed ?? false,
        cooldown: cooldown.has(p.id),
        exploreShows: merit.exploreShows[p.id] ?? 0,
      };
    })
    .sort((a, b) => b.ems - a.ems);

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 4px" }}>Merit engine</h1>
      <p style={{ fontSize: 13.5, color: "#56627A", margin: "0 0 18px", maxWidth: 760 }}>
        The Elume Merit Score behind featured ordering: Demand 60% (velocity, pick, cart, 30-day buy) + Quality 30% (reviews) + Value 10% (savings vs MRP, market-beating), plus the Brand Promoter term. Every rate is Bayesian-smoothed against its category average, so new products start at par. The maths lives in the wiki.
      </p>
      <MeritPanel
        rows={rows}
        promoterBrands={merit.config.promoterBrands}
        milestoneCr={merit.config.milestoneCr}
        paidGmv={merit.paidGmv}
        milestoneReached={merit.milestoneReached}
        promoterExploreEdge={merit.config.promoterExploreEdge}
        catStats={merit.catStats}
      />
    </div>
  );
}
