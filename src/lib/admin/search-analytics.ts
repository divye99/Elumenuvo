import { adminClient } from "@/lib/supabase/admin";
import { normalizeSearchText } from "@/lib/search-normalize";
import { loadSearchSignals } from "@/lib/search-signals";

/**
 * Search analytics for the admin (Analytics → Searches).
 *
 * Two questions, one dataset:
 *   1. What are people looking for?  (every query, frequency-weighted -
 *      rendered as the bubble cloud)
 *   2. What do they want that we DON'T carry?  (queries that have never
 *      matched anything - the missed-demand table, which is effectively a
 *      ranked purchase-request list written by visitors themselves)
 *
 * A query counts as missed demand only when every "search"-source row for it
 * returned 0 and nothing was ever picked from it. Suggest-source rows carry
 * results=null (the dropdown does not know the final count), so null never
 * counts as zero. Queries the typo-rescue or the customers themselves later
 * corrected are annotated rather than hidden: "moter" with a learned fix is
 * a spelling gap, "tullu pump" with none is a brand we do not stock.
 */

export type SearchTermStat = {
  q: string;            // display form (most recent raw spelling)
  norm: string;
  count: number;        // times searched
  sessions: number;     // distinct visitors
  maxResults: number;   // best result count ever seen (-1 = never measured)
  picks: number;        // times a product/suggestion was chosen after it
  lastAt: string;
  correctedTo?: string; // learned fix from the reformulation miner
};

export type SearchAnalytics = {
  totalSearches: number;
  distinctQueries: number;
  zeroRate: number;         // share of measured searches that found nothing
  terms: SearchTermStat[];  // every query, most searched first
  missed: SearchTermStat[]; // never matched anything, most searched first
};

const EMPTY: SearchAnalytics = { totalSearches: 0, distinctQueries: 0, zeroRate: 0, terms: [], missed: [] };

/** excludeSids: sessions the analytics layer classified as bots. Historic
 *  bot rows predate the ingest gate on /api/search-log, and a crawler
 *  "searching" its own URL fragments would otherwise pollute both the bubble
 *  cloud and the missed-demand list. Rows with no session id stay (they
 *  cannot be attributed either way). */
export async function fetchSearchAnalytics(days: number, excludeSids?: Set<string>): Promise<SearchAnalytics> {
  const db = adminClient();
  if (!db) return EMPTY;
  try {
    const since = new Date(Date.now() - days * 86_400_000).toISOString();
    const { data, error } = await db
      .from("search_queries")
      .select("query, source, results, picked, session_id, created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(8000);
    if (error || !data) return EMPTY;

    type Agg = SearchTermStat & { sessionSet: Set<string> };
    const by = new Map<string, Agg>();
    let measured = 0;
    let zeros = 0;
    let kept = 0;

    for (const r of data as { query: string; source: string; results: number | null; picked: string | null; session_id: string | null; created_at: string }[]) {
      if (r.session_id && excludeSids?.has(r.session_id)) continue;
      kept += 1;
      const norm = normalizeSearchText(r.query ?? "");
      if (norm.length < 2 || norm.length > 80) continue;
      let a = by.get(norm);
      if (!a) {
        a = { q: r.query.trim(), norm, count: 0, sessions: 0, maxResults: -1, picks: 0, lastAt: r.created_at, sessionSet: new Set() };
        by.set(norm, a);
      }
      a.count += 1;
      if (r.session_id) a.sessionSet.add(r.session_id);
      if (r.results != null) {
        a.maxResults = Math.max(a.maxResults, r.results);
        if (r.source === "search") {
          measured += 1;
          if (r.results === 0) zeros += 1;
        }
      }
      if (r.picked) a.picks += 1;
      if (r.created_at > a.lastAt) { a.lastAt = r.created_at; a.q = r.query.trim(); }
    }

    // Annotate with learned corrections so a typo is distinguishable from a
    // product we genuinely do not carry.
    const { corrections } = await loadSearchSignals();

    const terms = [...by.values()]
      .map(({ sessionSet, ...t }) => ({ ...t, sessions: sessionSet.size, ...(corrections[t.norm] ? { correctedTo: corrections[t.norm] } : {}) }))
      .sort((a, b) => b.count - a.count || (a.lastAt < b.lastAt ? 1 : -1));

    const missed = terms.filter((t) => t.maxResults === 0 && t.picks === 0);

    return {
      totalSearches: kept,
      distinctQueries: terms.length,
      zeroRate: measured > 0 ? zeros / measured : 0,
      terms: terms.slice(0, 400),
      missed: missed.slice(0, 200),
    };
  } catch {
    return EMPTY; // table absent or transient: the tab shows an empty state
  }
}
