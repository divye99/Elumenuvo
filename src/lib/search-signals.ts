import { adminClient } from "@/lib/supabase/admin";
import { normalizeSearchText } from "@/lib/search-normalize";

/**
 * The self-improving layer of search: aggregates the query log
 * (search_queries) into signals that reshape suggestions and ranking.
 *
 *  - popularQueries: what real visitors actually type (frequency-ranked,
 *    only queries that found results) → suggest completions
 *  - picksByQuery:   query → which products people chose after typing it
 *    → per-query product boost in suggest
 *  - pickTotals:     product → total times chosen from search anywhere
 *    → global boost in suggest and the catalogue's Featured sort
 *
 * Aggregates rebuild at most every 10 minutes per server instance and the
 * whole thing degrades to empty signals if the table is missing or the
 * service key is absent - search never breaks because learning is down.
 */

export type SearchSignals = {
  popularQueries: { q: string; count: number }[];
  picksByQuery: Record<string, Record<string, number>>;
  pickTotals: Record<string, number>;
  /** Learned spelling fixes, mined from the log: a zero-result search
   *  followed in the same session by a search that found something. The
   *  customers who corrected themselves teach the ones who won't. */
  corrections: Record<string, string>;
};

const EMPTY: SearchSignals = { popularQueries: [], picksByQuery: {}, pickTotals: {}, corrections: {} };

let cache: { at: number; data: SearchSignals } | null = null;
const TTL = 10 * 60_000;

export async function loadSearchSignals(): Promise<SearchSignals> {
  if (cache && Date.now() - cache.at < TTL) return cache.data;
  const db = adminClient();
  if (!db) return EMPTY;
  try {
    // Recent window keeps signals fresh; cap protects the request.
    const since = new Date(Date.now() - 90 * 86_400_000).toISOString();
    const { data, error } = await db
      .from("search_queries")
      .select("query, results, picked, session_id, created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(8000);
    if (error || !data) return EMPTY;

    const queryCount = new Map<string, { display: string; count: number }>();
    const picksByQuery: Record<string, Record<string, number>> = {};
    const pickTotals: Record<string, number> = {};

    for (const r of data as { query: string; results: number | null; picked: string | null }[]) {
      const norm = normalizeSearchText(r.query ?? "");
      if (norm.length < 2 || norm.length > 60) continue;
      // Queries that found something are suggestion-worthy; dead ends aren't.
      if ((r.results ?? 0) > 0 || r.picked) {
        const e = queryCount.get(norm);
        if (e) e.count += 1;
        else queryCount.set(norm, { display: r.query.trim().toLowerCase(), count: 1 });
      }
      if (r.picked?.startsWith("product:")) {
        const pid = r.picked.slice(8);
        (picksByQuery[norm] ??= {})[pid] = (picksByQuery[norm][pid] ?? 0) + 1;
        pickTotals[pid] = (pickTotals[pid] ?? 0) + 1;
      }
    }

    /* ── Reformulation mining: zero-result -> success, same session ──
       "Water moter" (0) followed by "Water motor" (1 hit) within ten minutes
       is a customer telling us the correct spelling. Next time anyone types
       the failing form, suggest can offer the fix immediately. Guard rails:
       the pair must share a word-overlap or be within a small edit of each
       other, so an unrelated next search ("Seimens rcbo" -> "Exhaust fan")
       never becomes a "correction". */
    const corrections: Record<string, string> = {};
    {
      type R = { query: string; results: number | null; picked: string | null; session_id?: string | null; created_at?: string };
      const bySession = new Map<string, R[]>();
      for (const r of [...(data as R[])].reverse()) { // oldest first
        if (!r.session_id) continue;
        (bySession.get(r.session_id) ?? bySession.set(r.session_id, []).get(r.session_id)!).push(r);
      }
      const related = (a: string, b: string) => {
        const aw = new Set(a.split(" "));
        if (b.split(" ").some((w) => aw.has(w))) return true;
        return Math.abs(a.length - b.length) <= 3 && a.slice(0, 3) === b.slice(0, 3);
      };
      const votes = new Map<string, Map<string, number>>();
      for (const rows of bySession.values()) {
        for (let i = 0; i < rows.length - 1; i++) {
          if ((rows[i].results ?? -1) !== 0) continue;
          const bad = normalizeSearchText(rows[i].query ?? "");
          if (bad.length < 3) continue;
          const next = rows.slice(i + 1, i + 3).find((x) => (x.results ?? 0) > 0);
          if (!next?.created_at || !rows[i].created_at) continue;
          if (new Date(next.created_at).getTime() - new Date(rows[i].created_at!).getTime() > 10 * 60_000) continue;
          const good = normalizeSearchText(next.query ?? "");
          if (good === bad || !related(bad, good)) continue;
          (votes.get(bad) ?? votes.set(bad, new Map()).get(bad)!).set(good, (votes.get(bad)!.get(good) ?? 0) + 1);
        }
      }
      for (const [bad, opts] of votes) {
        const [best] = [...opts.entries()].sort((a, b) => b[1] - a[1]);
        if (best) corrections[bad] = best[0];
      }
    }

    /* ── Cross-learning from Smart BOM (owner, Aug 2026) ──
       product_aliases holds phrasings a human CONFIRMED map to a product -
       from BOQ review approvals and from suggest picks. Fold them in as
       synthetic picks, weighted 3x: a deliberate line-by-line confirmation
       carries more intent than a casual suggestion click. This one fold
       feeds every consumer of these signals at once: the suggest dropdown,
       the results-page ranking boost, and the visibility engine. Tolerated
       to fail on DBs where migration 0108 has not run yet. */
    try {
      const { data: aliases } = await db
        .from("product_aliases")
        .select("alias_norm, product_id, hits")
        .order("hits", { ascending: false })
        .limit(4000);
      for (const a of aliases ?? []) {
        const w = Math.min(Number(a.hits) || 1, 20) * 3;
        (picksByQuery[a.alias_norm] ??= {})[a.product_id] = (picksByQuery[a.alias_norm][a.product_id] ?? 0) + w;
        pickTotals[a.product_id] = (pickTotals[a.product_id] ?? 0) + w;
      }
    } catch { /* pre-0108 database - BOQ cross-learning simply off */ }

    const popularQueries = [...queryCount.values()]
      .filter((x) => x.count >= 2) // one-off typos don't teach anything
      .sort((a, b) => b.count - a.count)
      .slice(0, 300)
      .map((x) => ({ q: x.display, count: x.count }));

    const dataOut: SearchSignals = { popularQueries, picksByQuery, pickTotals, corrections };
    cache = { at: Date.now(), data: dataOut };
    return dataOut;
  } catch {
    return EMPTY;
  }
}
