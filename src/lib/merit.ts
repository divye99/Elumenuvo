import { adminClient } from "@/lib/supabase/admin";
import { unstable_cache } from "next/cache";
import type { Product } from "@/lib/data";

/**
 * Elume Merit Score (EMS) - the fair Layer-2 ranking engine (owner spec,
 * Aug 2026). Replaces raw lifetime totals, which compounded early exposure
 * into a rich-get-richer loop (the "Havells wall").
 *
 * Every rate is BAYESIAN-SMOOTHED: score = (x + m*mu) / (n + m), where mu is
 * the CATEGORY average and m is the prior strength. A product with no data
 * scores exactly the category average - the poor start at par and move on
 * their own performance, never on tenure or exposure volume.
 *
 * Pillars (owner-approved; weights revised 50/30/20 -> 60/30/10, Aug 2026):
 *   DEMAND (60): view velocity/day-live + pick rate + cart rate + 30d buy
 *     rate. Buy rate deliberately carries the LEAST demand weight until the
 *     platform crosses the sales milestone (Rs 10 Cr paid GMV), after which
 *     it automatically becomes the HEAVIEST - smoothing keeps it harmless
 *     while sparse either way.
 *   QUALITY (30): smoothed review stars only. Dispatch/stock reliability are
 *     deliberately EXCLUDED - those are our operations, not brand merit.
 *   VALUE (10): discount depth vs MRP + position vs tracked market price.
 *   BRAND PROMOTER (small): a modest additive for brands we formally
 *     promote (owner naming: "we are Rajdhani's Brand Promoter") - the
 *     lowest-weighted term by design.
 *
 * Interventions (merit_overrides): additive boost, hard suppression, and
 * exploration cooldowns (always temporary timestamps). All visible and
 * editable in /admin/merit.
 */

export type MeritParts = {
  velocity: number;
  pickRate: number;
  cartRate: number;
  buyRate: number;
  review: number;
  value: number;
  promoter: number;
  override: number;
  suppressed: boolean;
};
export type MeritEntry = { ems: number; parts: MeritParts };
export type MeritConfig = {
  promoterBrands: string[];
  milestoneCr: number; // purchase weight flips at this paid GMV
  /** Brand Promoter edge in the exploration-slot lottery: every eligible
   *  product holds 1 ticket, promoter products hold (1 + edge) tickets.
   *  0.2 = a meaningful 20% advantage that scales as the promoter network
   *  grows (owner rule: an edge, never a claim - a flat 7/10 pool split
   *  was rejected as arbitrary). */
  promoterExploreEdge: number;
};

export const DEFAULT_MERIT_CONFIG: MeritConfig = {
  // We are Rajdhani's Brand Promoter today; add Wipro/CMI etc. in
  // /admin/merit as those relationships land.
  promoterBrands: ["Rajdhani"],
  milestoneCr: 10,
  promoterExploreEdge: 0.2,
};

const CONFIG_KEY = "merit_config";
const PAID_STATES = ["placed", "confirmed", "packed", "shipped", "partially_shipped", "out_for_delivery", "delivered"];

/* Prior strengths: how much evidence before we trust a product's own rate
 * over its category average. */
const M_VIEWS = 25;   // for pick/cart/buy rates (denominator: views)
const M_DAYS = 14;    // for velocity (denominator: days live)
const M_REVIEWS = 5;  // for star ratings (denominator: review count)

type Metrics30 = { views: number; carts: number; units: number };

async function fetchInputs() {
  const db = adminClient();
  if (!db) return null;
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
  const exploreSince = new Date(Date.now() - 21 * 86_400_000).toISOString();

  const metrics = new Map<string, Metrics30>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db
      .from("product_metrics_daily")
      .select("product_id, glance_views, cart_adds, units")
      .gte("day", since)
      .range(from, from + 999);
    if (error || !data?.length) break;
    for (const r of data) {
      const m = metrics.get(r.product_id) ?? { views: 0, carts: 0, units: 0 };
      m.views += r.glance_views ?? 0;
      m.carts += r.cart_adds ?? 0;
      m.units += Number(r.units ?? 0);
      metrics.set(r.product_id, m);
    }
    if (data.length < 1000) break;
  }

  const [cfgRes, ovRes, gmvRes, exploreRes, pickedRes] = await Promise.all([
    db.from("app_kv").select("v").eq("k", CONFIG_KEY).maybeSingle(),
    db.from("merit_overrides").select("*"),
    db.from("orders").select("total").in("status", PAID_STATES).limit(20000),
    db.from("explore_log").select("product_id").gte("created_at", exploreSince).limit(5000),
    db.from("search_queries").select("picked").like("picked", "product:%").gte("created_at", exploreSince).limit(5000),
  ]);

  const stored = (cfgRes.data?.v ?? null) as Partial<MeritConfig> | null;
  const edge = Number(stored?.promoterExploreEdge);
  const config: MeritConfig = {
    promoterBrands: Array.isArray(stored?.promoterBrands) ? stored!.promoterBrands! : DEFAULT_MERIT_CONFIG.promoterBrands,
    milestoneCr: Number(stored?.milestoneCr) > 0 ? Number(stored!.milestoneCr) : DEFAULT_MERIT_CONFIG.milestoneCr,
    promoterExploreEdge: Number.isFinite(edge) && edge >= 0 && edge <= 2 ? edge : DEFAULT_MERIT_CONFIG.promoterExploreEdge,
  };
  const overrides = new Map((ovRes.data ?? []).map((o: any) => [o.product_id as string, o]));
  const paidGmv = (gmvRes.data ?? []).reduce((a: number, r: any) => a + Number(r.total ?? 0), 0);

  // Exploration shows + whether the product earned ANY search pick in the
  // same window - the cooldown evidence.
  const exploreShows = new Map<string, number>();
  for (const r of exploreRes.data ?? []) exploreShows.set(r.product_id, (exploreShows.get(r.product_id) ?? 0) + 1);
  const pickedIds = new Set((pickedRes.data ?? []).map((r: any) => String(r.picked).slice(8)));

  return { metrics, config, overrides, paidGmv, exploreShows, pickedIds };
}

export type MeritData = {
  ems: Record<string, number>;
  parts: Record<string, MeritParts>;
  config: MeritConfig;
  paidGmv: number;
  milestoneReached: boolean;
  /** product ids currently in exploration cooldown (temporary, timestamped) */
  cooldownIds: string[];
  exploreShows: Record<string, number>;
};

/** Pure EMS computation - exported for the harness and the admin panel. */
export function computeMerit(
  products: Product[],
  metrics: Map<string, Metrics30>,
  config: MeritConfig,
  overrides: Map<string, any>,
  paidGmv: number,
  exploreShows: Map<string, number>,
  pickedIds: Set<string>,
  pickTotals: Record<string, number> = {}
): MeritData {
  const milestoneReached = paidGmv >= config.milestoneCr * 1_00_00_000;
  const now = Date.now();

  // Category averages (the smoothing priors), computed from live data.
  type CatAgg = { views: number; carts: number; units: number; picks: number; days: number; n: number; stars: number; ratings: number };
  const cats = new Map<string, CatAgg>();
  const dayLive = (p: Product) => Math.max(1, Math.min(365, (now - new Date(p.createdAt ?? now).getTime()) / 86_400_000));
  for (const p of products) {
    const c = cats.get(p.cat) ?? { views: 0, carts: 0, units: 0, picks: 0, days: 0, n: 0, stars: 0, ratings: 0 };
    const m = metrics.get(p.id);
    c.views += m?.views ?? 0; c.carts += m?.carts ?? 0; c.units += m?.units ?? 0;
    c.picks += pickTotals[p.id] ?? 0;
    c.days += dayLive(p); c.n += 1;
    if (p.rating && p.ratingCount) { c.stars += p.rating * p.ratingCount; c.ratings += p.ratingCount; }
    cats.set(p.cat, c);
  }

  const ems: Record<string, number> = {};
  const parts: Record<string, MeritParts> = {};
  const cooldownIds: string[] = [];

  // Demand sub-weights: buy rate least-weighted until the milestone, then
  // heaviest (owner spec). Sub-weights always sum to 1 inside the pillar.
  const dw = milestoneReached
    ? { velocity: 0.2, pick: 0.2, cart: 0.15, buy: 0.45 }
    : { velocity: 0.4, pick: 0.3, cart: 0.2, buy: 0.1 };

  for (const p of products) {
    const c = cats.get(p.cat)!;
    const m = metrics.get(p.id) ?? { views: 0, carts: 0, units: 0 };
    const days = dayLive(p);

    const muVelocity = c.views / Math.max(1, c.days);
    const muPick = c.picks / Math.max(1, c.views || 1);
    const muCart = c.carts / Math.max(1, c.views || 1);
    const muBuy = c.units / Math.max(1, c.views || 1);
    const muStars = c.ratings ? c.stars / c.ratings : 3.8;

    const smooth = (x: number, n: number, mu: number, m_: number) => (x + m_ * mu) / (n + m_);
    // Each rate is normalized against its category average, then SATURATED
    // onto 0..1 with r/(1+r) so 0.5 = exactly category average and no pillar
    // can run away. Without this, view velocity on a heavy-tailed catalogue
    // hits 90x the category mean and swamps the 50/30/20 pillar weights,
    // which is the rich-get-richer effect this engine exists to kill (live
    // harness, Aug 2026). Ordering within a pillar is preserved; doubling a
    // rate just earns diminishing returns.
    const rel = (v: number, mu: number) => {
      const r = mu > 0 ? v / mu : 1;
      return r / (1 + r);
    };

    const velocity = rel(smooth(m.views, days, muVelocity, M_DAYS), muVelocity || 0.001);
    const pickRate = rel(smooth(Math.min(pickTotals[p.id] ?? 0, 40), m.views, muPick, M_VIEWS), muPick || 0.001);
    const cartRate = rel(smooth(m.carts, m.views, muCart, M_VIEWS), muCart || 0.001);
    const buyRate = rel(smooth(m.units, m.views, muBuy, M_VIEWS), muBuy || 0.001);
    const review = rel(smooth(p.rating && p.ratingCount ? p.rating * p.ratingCount : 0, p.ratingCount ?? 0, muStars, M_REVIEWS), muStars);

    // Value: savings depth vs MRP + market-beating bonus, through the same
    // saturation (1.0 = no discount = category-par 0.5).
    const savings = p.market > 0 ? Math.max(0, 1 - p.price / p.market) : 0;
    const marketBeat = p.marketLow != null && p.marketLow > 0 ? (p.price <= p.marketLow ? 0.3 : 0) : 0;
    const value = (1 + savings + marketBeat) / (2 + savings + marketBeat);

    const promoter = config.promoterBrands.includes(p.brand) ? 0.06 : 0;
    const ov = overrides.get(p.id);
    const override = Number(ov?.boost ?? 0);
    const suppressed = Boolean(ov?.suppressed);

    const demand = dw.velocity * velocity + dw.pick * pickRate + dw.cart * cartRate + dw.buy * buyRate;
    let score = 0.6 * demand + 0.3 * review + 0.1 * value + promoter + override;
    // Display guardrails carried over from the visibility rules:
    if (!p.image) score *= 0.2;                    // photo rule
    if (p.brand === "Elume") score *= 0.5;         // house-brand dial
    if (suppressed) score = -1;

    ems[p.id] = Math.round(score * 1000) / 1000;
    parts[p.id] = { velocity, pickRate, cartRate, buyRate, review, value, promoter, override, suppressed };

    // Exploration cooldown: explored repeatedly, earned nothing. ALWAYS
    // temporary - an explicit admin cooldown_until wins; otherwise the
    // 21-day evidence window itself is the expiry.
    const adminCd = ov?.cooldown_until ? new Date(ov.cooldown_until).getTime() : 0;
    if (adminCd > now) cooldownIds.push(p.id);
    else if ((exploreShows.get(p.id) ?? 0) >= 8 && !pickedIds.has(p.id)) cooldownIds.push(p.id);
  }

  return {
    ems, parts,
    config, paidGmv, milestoneReached,
    cooldownIds,
    exploreShows: Object.fromEntries(exploreShows),
  };
}

/** Cached loader for pages (same 5-min contract as the catalogue cache). */
export async function loadMerit(products: Product[], pickTotals: Record<string, number>): Promise<MeritData | null> {
  const inputs = await cachedInputs();
  if (!inputs) return null;
  return computeMerit(
    products,
    new Map(Object.entries(inputs.metrics)),
    inputs.config,
    new Map(Object.entries(inputs.overrides)),
    inputs.paidGmv,
    new Map(Object.entries(inputs.exploreShows)),
    new Set(inputs.pickedIds),
    pickTotals
  );
}

const cachedInputs = unstable_cache(
  async () => {
    const raw = await fetchInputs();
    if (!raw) return null;
    return {
      metrics: Object.fromEntries(raw.metrics),
      config: raw.config,
      overrides: Object.fromEntries(raw.overrides),
      paidGmv: raw.paidGmv,
      exploreShows: Object.fromEntries(raw.exploreShows),
      pickedIds: [...raw.pickedIds],
    };
  },
  ["merit-inputs"],
  { revalidate: 300, tags: ["merit"] }
);
