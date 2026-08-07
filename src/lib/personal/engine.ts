import { adminClient } from "@/lib/supabase/admin";
import { fetchProductsLite } from "@/lib/products";
import { searchTokens, matchesAll } from "@/lib/search-normalize";
import type { Product } from "@/lib/data";

/**
 * The personalisation engine: one identity, many surfaces.
 *
 * Everything is TRANSPARENT heuristics over first-party signals - no black
 * box. Each rail can say exactly why it exists ("because you keep viewing
 * Polycab wires", "you buy this every ~6 weeks"), which is both the UX and
 * the debugging story. Every input signal is already logged (site_events,
 * search_queries, orders, compare picks), so a learned model can replace
 * the scoring later without changing any surface.
 *
 * Identity:
 *   - Guests: the anonymous device token (elume.sid) that analytics and
 *     search already share. Views, searches, compare picks and carts
 *     personalise from the very first session.
 *   - Signed-in / known emails: the orders ledger adds the purchase layer -
 *     portfolio, co-purchase and replenishment prediction.
 *
 * Engines:
 *   - Taste: category/brand affinity from recent views (recency-weighted).
 *   - Substitution: compare groups ("more like what you viewed" = the
 *     like-to-like alternatives of what they engaged with).
 *   - Co-purchase: global product graph from all orders ("bought together").
 *   - Replenishment: per-customer repeat-purchase cadence (median gap
 *     between buys of the same product) → "due for reorder".
 */

/* ── cached global inputs (10 min) ── */

type OrderRow = { id: string; email: string | null; items: { id: string; qty?: number }[] | null; created_at: string; status: string };

type Graph = {
  co: Map<string, Map<string, number>>; // pid → co-bought pid → count
  byEmail: Map<string, { pid: string; qty: number; at: number }[]>;
  popular: Map<string, number>; // pid → units sold (orders ledger)
};

let graphCache: { at: number; g: Graph } | null = null;
const TTL = 10 * 60_000;

async function loadGraph(): Promise<Graph> {
  if (graphCache && Date.now() - graphCache.at < TTL) return graphCache.g;
  const g: Graph = { co: new Map(), byEmail: new Map(), popular: new Map() };
  const db = adminClient();
  if (db) {
    try {
      const { data } = await db
        .from("orders")
        .select("id, email, items, created_at, status")
        .not("status", "in", "(cancelled,payment_abandoned,awaiting_payment)")
        .order("created_at", { ascending: false })
        .limit(3000);
      for (const o of (data ?? []) as OrderRow[]) {
        const items = (o.items ?? []).filter((i) => i?.id);
        const at = new Date(o.created_at).getTime();
        for (const i of items) {
          g.popular.set(i.id, (g.popular.get(i.id) ?? 0) + (Number(i.qty) || 1));
          if (o.email) {
            const key = o.email.toLowerCase();
            (g.byEmail.get(key) ?? g.byEmail.set(key, []).get(key)!).push({ pid: i.id, qty: Number(i.qty) || 1, at });
          }
          for (const j of items) {
            if (i.id === j.id) continue;
            const row = g.co.get(i.id) ?? g.co.set(i.id, new Map()).get(i.id)!;
            row.set(j.id, (row.get(j.id) ?? 0) + 1);
          }
        }
      }
    } catch { /* graph is enhancement only */ }
  }
  graphCache = { at: Date.now(), g };
  return g;
}

/* ── per-session taste ── */

export type Taste = {
  viewed: string[];      // recent-first, deduped product ids
  carted: string[];
  searches: string[];    // recent raw queries, deduped
  cats: Map<string, number>;
  brands: Map<string, number>;
};

export async function sessionTaste(sidToken: string | null): Promise<Taste> {
  const t: Taste = { viewed: [], carted: [], searches: [], cats: new Map(), brands: new Map() };
  const db = adminClient();
  if (!db || !sidToken) return t;
  const since = new Date(Date.now() - 60 * 86_400_000).toISOString();
  try {
    const { data } = await db
      .from("site_events")
      .select("type, path, detail, created_at")
      .eq("sid", sidToken)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(1500);
    const seen = new Set<string>();
    for (const e of (data ?? []) as { type: string; path: string | null; detail: { pid?: string; to?: string } | null }[]) {
      const pid =
        e.type === "add_to_cart" || e.type === "compare_add" ? e.detail?.pid ?? e.detail?.to
        : e.type === "compare_pick" ? e.detail?.to
        : e.path?.match(/^\/catalogue\/([^/?#]+)/)?.[1];
      if (!pid) continue;
      if (e.type === "add_to_cart" || e.type === "compare_add") t.carted.push(pid);
      if (!seen.has(pid)) { seen.add(pid); t.viewed.push(pid); }
    }
  } catch { /* taste stays empty → cold-start rails */ }
  // Search words are intent in the visitor's own words - "water motor",
  // "atomberg", "2 way switch" - and count toward taste alongside views.
  try {
    const { data } = await db
      .from("search_queries")
      .select("query, created_at")
      .eq("session_id", sidToken)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(80);
    const seenQ = new Set<string>();
    for (const r of (data ?? []) as { query: string }[]) {
      const q = (r.query ?? "").trim().toLowerCase();
      if (q.length >= 2 && !seenQ.has(q)) { seenQ.add(q); t.searches.push(q); }
    }
  } catch { /* searches optional */ }
  return t;
}

/* ── rails ── */

export type RailItem = Pick<Product, "id" | "name" | "brand" | "price" | "market" | "unit" | "cat" | "gstRate" | "image" | "inStock"> & { note?: string };
export type Rail = { key: string; title: string; reason: string; items: RailItem[] };

const toItem = (p: Product, note?: string): RailItem => ({
  id: p.id, name: p.name, brand: p.brand, price: p.price, market: p.market, unit: p.unit,
  cat: p.cat, gstRate: p.gstRate, image: p.image, inStock: p.inStock, note,
});

function trendLite(p: Product): number {
  return Math.min(p.unitsSold ?? 0, 200) + (p.recommended ? 8 : 0) + (p.image ? 4 : 0);
}

/** Recency-weighted taste from viewed products (index 0 = most recent),
 *  plus what they SEARCHED: each recent query is matched against the
 *  catalogue and its hits' categories/brands count toward affinity - a
 *  visitor who searched "2 way switch" three times is a Modular buyer even
 *  if they never opened a product page. */
function tasteWeights(taste: Taste, byId: Map<string, Product>, products: Product[]) {
  taste.viewed.forEach((id, i) => {
    const p = byId.get(id);
    if (!p) return;
    const w = 1 / (1 + i * 0.3);
    taste.cats.set(p.cat, (taste.cats.get(p.cat) ?? 0) + w);
    taste.brands.set(p.brand, (taste.brands.get(p.brand) ?? 0) + w);
  });
  for (const q of taste.searches.slice(0, 15)) {
    const toks = searchTokens(q);
    if (toks.length === 0) continue;
    let hits = 0;
    for (const p of products) {
      if (!matchesAll(`${p.brand} ${p.name} ${p.cat}`, toks)) continue;
      taste.cats.set(p.cat, (taste.cats.get(p.cat) ?? 0) + 0.15);
      taste.brands.set(p.brand, (taste.brands.get(p.brand) ?? 0) + 0.1);
      if (++hits >= 40) break;
    }
  }
}

/* ── project-phase prediction ──
 * Builders buy in phases: wiring rough-in first, then protection
 * (switchgear, DBs), then modular switches, then fixtures, then pumps and
 * appliances. The model blends LEARNED transitions (what category follows
 * what across every customer timeline in the orders ledger) with that
 * domain prior, so it works from order one and sharpens as volume grows. */
const PHASES: string[][] = [
  ["Wires & Cables"],
  ["Switchgear", "DB & Panels"],
  ["Modular"],
  ["Lighting", "Fans"],
  ["Pumps", "Electrical Accessories", "EV Charging"],
];
const phaseOf = (cat: string) => PHASES.findIndex((p) => p.includes(cat));

function categoryTransitions(g: Graph, byId: Map<string, Product>): Map<string, Map<string, number>> {
  const t = new Map<string, Map<string, number>>();
  for (const rows of g.byEmail.values()) {
    // first purchase time per category, in order
    const firstAt = new Map<string, number>();
    for (const r of [...rows].sort((a, b) => a.at - b.at)) {
      const cat = byId.get(r.pid)?.cat;
      if (cat && !firstAt.has(cat)) firstAt.set(cat, r.at);
    }
    const seq = [...firstAt.entries()].sort((a, b) => a[1] - b[1]).map(([c]) => c);
    for (let i = 0; i + 1 < seq.length; i++) {
      const row = t.get(seq[i]) ?? t.set(seq[i], new Map()).get(seq[i])!;
      row.set(seq[i + 1], (row.get(seq[i + 1]) ?? 0) + 1);
    }
  }
  return t;
}

export type NextCat = { cat: string; why: string };

/** Predict the next buying phase from what this customer has bought. */
export function predictNextCategories(purchasedCats: string[], g: Graph, byId: Map<string, Product>): NextCat[] {
  if (purchasedCats.length === 0) return [];
  const owned = new Set(purchasedCats);
  const transitions = categoryTransitions(g, byId);
  const scores = new Map<string, { s: number; why: string }>();
  const last = purchasedCats[purchasedCats.length - 1];
  // learned: what other customers bought after the categories this one owns
  for (const cat of owned) {
    for (const [next, n] of transitions.get(cat) ?? []) {
      if (owned.has(next)) continue;
      const cur = scores.get(next) ?? { s: 0, why: `customers who bought ${cat} bought this next` };
      cur.s += n;
      scores.set(next, cur);
    }
  }
  // prior: the construction sequence, anchored on their furthest phase
  const maxPhase = Math.max(...purchasedCats.map(phaseOf).filter((i) => i >= 0), -1);
  for (const cat of PHASES[maxPhase + 1] ?? []) {
    if (owned.has(cat)) continue;
    const cur = scores.get(cat) ?? { s: 0, why: `the usual next phase after ${last}` };
    cur.s += 1.5;
    scores.set(cat, cur);
  }
  return [...scores.entries()]
    .sort((a, b) => b[1].s - a[1].s)
    .slice(0, 3)
    .map(([cat, v]) => ({ cat, why: v.why }));
}

export type Due = { p: Product; lastAt: number; gapDays: number; overdue: number; times: number };

/** Replenishment: products this email bought 2+ times → median gap → due. */
export function dueForReorder(email: string, g: Graph, byId: Map<string, Product>): Due[] {
  const rows = g.byEmail.get(email.toLowerCase()) ?? [];
  const byPid = new Map<string, number[]>();
  for (const r of rows) (byPid.get(r.pid) ?? byPid.set(r.pid, []).get(r.pid)!).push(r.at);
  const due: Due[] = [];
  const now = Date.now();
  for (const [pid, times] of byPid) {
    if (times.length < 2) continue;
    const sorted = [...times].sort((a, b) => a - b);
    const gaps = sorted.slice(1).map((t, i) => t - sorted[i]).sort((a, b) => a - b);
    const median = gaps[Math.floor(gaps.length / 2)];
    if (median < 3 * 86_400_000) continue; // same-week double orders are not a cycle
    const gapDays = Math.round(median / 86_400_000);
    const last = sorted[sorted.length - 1];
    const overdue = (now - last) / median;
    const p = byId.get(pid);
    if (p && p.inStock !== false && overdue >= 0.8) due.push({ p, lastAt: last, gapDays, overdue, times: times.length });
  }
  return due.sort((a, b) => b.overdue - a.overdue);
}

export async function buildRails(opts: { ctx: string; sid: string | null; email: string | null }): Promise<Rail[]> {
  const [products, g, taste] = await Promise.all([fetchProductsLite(), loadGraph(), sessionTaste(opts.sid)]);
  const byId = new Map(products.map((p) => [p.id, p]));
  const buyable = products.filter((p) => p.inStock !== false && p.cat !== "Copper");
  tasteWeights(taste, byId, products);
  const viewedSet = new Set(taste.viewed);
  const purchased = opts.email ? new Set((g.byEmail.get(opts.email.toLowerCase()) ?? []).map((r) => r.pid)) : new Set<string>();
  const rails: Rail[] = [];
  const used = new Set<string>();
  const take = (list: Product[], n: number, note?: (p: Product) => string | undefined): RailItem[] => {
    const out: RailItem[] = [];
    const fams = new Set<string>();
    for (const p of list) {
      const fam = p.parentId ?? p.id;
      if (used.has(p.id) || fams.has(fam)) continue;
      fams.add(fam); used.add(p.id);
      out.push(toItem(p, note?.(p)));
      if (out.length >= n) break;
    }
    return out;
  };

  /* PDP context: co-purchase ("you might also need") */
  const pdp = opts.ctx.startsWith("pdp:") ? opts.ctx.slice(4) : null;
  if (pdp) {
    const co = [...(g.co.get(pdp) ?? new Map<string, number>()).entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([id]) => byId.get(id))
      .filter((p): p is Product => !!p && p.inStock !== false && p.id !== pdp);
    const items = take(co, 8);
    if (items.length >= 2) {
      rails.push({ key: "co", title: "Often bought together", reason: "Customers who bought this also ordered these", items });
    }
    return rails; // PDP shows only the co-purchase rail; compare handles substitutes
  }

  /* Due for reorder (signed-in) - leads on /for-you */
  if (opts.email) {
    const due = dueForReorder(opts.email, g, byId).slice(0, 8);
    if (due.length > 0) {
      rails.push({
        key: "due",
        title: "Due for a reorder",
        reason: "Based on your own buying cycle for these products",
        items: due.map((d) => toItem(d.p, `You order this about every ${d.gapDays} days · last ${Math.round((Date.now() - d.lastAt) / 86_400_000)} days ago`)),
      });
      due.forEach((d) => used.add(d.p.id));
    }

    /* Next project phase: wires → switchgear → modular → fixtures. Learned
     * from every customer timeline, anchored by the construction sequence. */
    const timeline = (g.byEmail.get(opts.email.toLowerCase()) ?? []).sort((a, b) => a.at - b.at);
    const catSeq: string[] = [];
    for (const r of timeline) {
      const c = byId.get(r.pid)?.cat;
      if (c && !catSeq.includes(c)) catSeq.push(c);
    }
    const next = predictNextCategories(catSeq, g, byId);
    if (next.length > 0) {
      const target = next[0];
      const picks = buyable
        .filter((p) => p.cat === target.cat)
        .sort((a, b) => trendLite(b) - trendLite(a));
      const items = take(picks, 10);
      if (items.length >= 3) {
        rails.push({
          key: "nextphase",
          title: `Next for your project: ${target.cat}`,
          reason: `You have bought ${catSeq.slice(-1)[0] ?? "materials"} - ${target.why}`,
          items,
        });
      }
    }
  }

  /* More like what you viewed: compare-group substitutes of engaged products.
   * Keys come from a separate guarded query so the storefront never depends
   * on migration 0095 - before it runs this map is simply empty. */
  if (taste.viewed.length > 0) {
    const keyOf = new Map<string, string>();
    const db = adminClient();
    if (db) {
      try {
        const { data } = await db.from("products").select("id, compare_key").not("compare_key", "is", null).limit(4000);
        for (const r of (data ?? []) as { id: string; compare_key: string }[]) keyOf.set(r.id, r.compare_key);
      } catch { /* pre-0095: no substitution layer yet */ }
    }
    const subs: Product[] = [];
    for (const id of taste.viewed.slice(0, 10)) {
      const key = keyOf.get(id);
      if (!key) continue;
      // A colour sibling of the viewed product is the SAME product, not an
      // alternative - exclude the viewed item's whole variant family.
      const viewedFam = byId.get(id)?.parentId ?? id;
      for (const s of buyable) {
        if (keyOf.get(s.id) === key && s.id !== id && !viewedSet.has(s.id) && (s.parentId ?? s.id) !== viewedFam) subs.push(s);
      }
    }
    // fall back to same-category trending when compare keys are absent
    const topCat = [...taste.cats.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    const fallback = topCat ? buyable.filter((p) => p.cat === topCat && !viewedSet.has(p.id)).sort((a, b) => trendLite(b) - trendLite(a)) : [];
    const items = take([...subs, ...fallback], 10);
    if (items.length >= 3) {
      rails.push({ key: "similar", title: "More like what you viewed", reason: topCat ? `Because you have been looking at ${topCat}` : "Like-for-like alternatives to products you opened", items });
    }
  }

  /* Picked for you: affinity score (cats + brands + trend), purchases boost cats too */
  if (opts.email) {
    for (const r of g.byEmail.get(opts.email.toLowerCase()) ?? []) {
      const p = byId.get(r.pid);
      if (p) { taste.cats.set(p.cat, (taste.cats.get(p.cat) ?? 0) + 2); taste.brands.set(p.brand, (taste.brands.get(p.brand) ?? 0) + 1.5); }
    }
  }
  if (taste.cats.size > 0) {
    const maxCat = Math.max(...taste.cats.values());
    const maxBrand = Math.max(1, ...taste.brands.values());
    const scored = buyable
      .filter((p) => !viewedSet.has(p.id) && !purchased.has(p.id))
      .map((p) => ({ p, s: (taste.cats.get(p.cat) ?? 0) / maxCat * 3 + (taste.brands.get(p.brand) ?? 0) / maxBrand * 1.5 + trendLite(p) / 200 + (g.popular.get(p.id) ?? 0) / 50 }))
      .filter((x) => x.s > 0.4)
      .sort((a, b) => b.s - a.s)
      .map((x) => x.p);
    const items = take(scored, 12);
    if (items.length >= 4) {
      const cats = [...taste.cats.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([c]) => c);
      rails.push({ key: "picked", title: "Picked for you", reason: `From your interest in ${cats.join(" and ")}`, items });
    }
  }

  /* Cold start / filler: trending overall (never empty-handed on /for-you) */
  if (opts.ctx === "foryou" && rails.length === 0) {
    const items = take([...buyable].sort((a, b) => trendLite(b) - trendLite(a)), 12);
    rails.push({ key: "trending", title: "Popular right now", reason: "Browse a little and this page starts learning you", items });
  }
  return rails;
}

/* ── business portfolio (customer dashboard + admin intelligence) ── */

export type Portfolio = {
  orders: number;
  units: number;
  spend: number; // GST-inclusive, whole rupees
  firstAt: string | null;
  lastAt: string | null;
  byCategory: { cat: string; units: number; spend: number }[];
  byBrand: { brand: string; units: number; spend: number }[];
  due: { id: string; name: string; brand: string; image?: string; price: number; unit: string; cat: string; gstRate?: number; market: number; gapDays: number; lastDays: number; times: number }[];
  nextCategories: NextCat[];
};

export async function buildPortfolio(email: string): Promise<Portfolio | null> {
  const [products, g] = await Promise.all([fetchProductsLite(), loadGraph()]);
  const byId = new Map(products.map((p) => [p.id, p]));
  const rows = g.byEmail.get(email.toLowerCase()) ?? [];
  if (rows.length === 0) return null;
  const cats = new Map<string, { units: number; spend: number }>();
  const brands = new Map<string, { units: number; spend: number }>();
  let units = 0; let spend = 0;
  const orderIds = new Set<string>();
  for (const r of rows) {
    const p = byId.get(r.pid);
    units += r.qty;
    const val = (p?.price ?? 0) * r.qty;
    spend += val;
    const cat = p?.cat ?? "Other";
    const brand = p?.brand ?? "Other";
    const c = cats.get(cat) ?? { units: 0, spend: 0 }; c.units += r.qty; c.spend += val; cats.set(cat, c);
    const b = brands.get(brand) ?? { units: 0, spend: 0 }; b.units += r.qty; b.spend += val; brands.set(brand, b);
  }
  // order count + first/last from timeline
  const times = rows.map((r) => r.at).sort((a, b) => a - b);
  const db = adminClient();
  if (db) {
    try {
      const { count } = await db.from("orders").select("id", { count: "exact", head: true }).ilike("email", email).not("status", "in", "(cancelled,payment_abandoned,awaiting_payment)");
      const due = dueForReorder(email, g, byId);
      const catSeq: string[] = [];
      for (const r of [...rows].sort((a, b) => a.at - b.at)) {
        const c = byId.get(r.pid)?.cat;
        if (c && !catSeq.includes(c)) catSeq.push(c);
      }
      return {
        orders: count ?? 0,
        units,
        spend: Math.round(spend),
        firstAt: times.length ? new Date(times[0]).toISOString() : null,
        lastAt: times.length ? new Date(times[times.length - 1]).toISOString() : null,
        byCategory: [...cats.entries()].map(([cat, v]) => ({ cat, ...v, spend: Math.round(v.spend) })).sort((a, b) => b.spend - a.spend),
        byBrand: [...brands.entries()].map(([brand, v]) => ({ brand, ...v, spend: Math.round(v.spend) })).sort((a, b) => b.spend - a.spend),
        due: due.slice(0, 10).map((d) => ({
          id: d.p.id, name: d.p.name, brand: d.p.brand, image: d.p.image, price: d.p.price, unit: d.p.unit,
          cat: d.p.cat, gstRate: d.p.gstRate, market: d.p.market,
          gapDays: d.gapDays, lastDays: Math.round((Date.now() - d.lastAt) / 86_400_000), times: d.times,
        })),
        nextCategories: predictNextCategories(catSeq, g, byId),
      };
    } catch { /* fall through */ }
  }
  return null;
}
