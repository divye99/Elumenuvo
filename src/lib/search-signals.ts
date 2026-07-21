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
 * service key is absent — search never breaks because learning is down.
 */

export type SearchSignals = {
  popularQueries: { q: string; count: number }[];
  picksByQuery: Record<string, Record<string, number>>;
  pickTotals: Record<string, number>;
};

const EMPTY: SearchSignals = { popularQueries: [], picksByQuery: {}, pickTotals: {} };

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
      .select("query, results, picked")
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

    const popularQueries = [...queryCount.values()]
      .filter((x) => x.count >= 2) // one-off typos don't teach anything
      .sort((a, b) => b.count - a.count)
      .slice(0, 300)
      .map((x) => ({ q: x.display, count: x.count }));

    const dataOut: SearchSignals = { popularQueries, picksByQuery, pickTotals };
    cache = { at: Date.now(), data: dataOut };
    return dataOut;
  } catch {
    return EMPTY;
  }
}
