import { adminClient } from "@/lib/supabase/admin";
import { fingerprintProduct } from "@/lib/compare/fingerprint";

/**
 * (Re)compute compare fingerprints for the whole catalogue.
 *
 * Runs nightly (cron) and on demand from /admin/compare, and is the reason
 * the mapping is self-maintaining: import a new brand and its products land
 * in the right groups on the next rebuild with zero manual mapping. Only
 * changed rows are written, so re-runs on an unchanged catalogue are no-ops.
 */
export type BuildStats = {
  scanned: number;
  keyed: number;        // products that produced a fingerprint
  groups: number;       // distinct keys with 2+ members from different families
  updated: number;      // rows actually written
};

type Row = {
  id: string;
  name: string;
  category: string;
  spec: string | null;
  attrs: Record<string, string> | null;
  parent_id: string | null;
  compare_key: string | null;
  compare_meta: Record<string, unknown> | null;
};

/**
 * Incremental variant: re-fingerprint ONLY the given products (a save, or a
 * bulk import's rows). Fingerprints are per-product and independent, so new
 * or edited products join existing groups without touching any other row -
 * this is what makes mapping event-driven instead of nightly.
 */
export async function rebuildCompareKeysFor(ids: string[]): Promise<void> {
  const db = adminClient();
  const unique = [...new Set(ids.filter(Boolean))];
  if (!db || unique.length === 0) return;
  try {
    for (let i = 0; i < unique.length; i += 200) {
      const { data } = await db
        .from("products")
        .select("id, name, category, spec, attrs, compare_key, compare_meta")
        .in("id", unique.slice(i, i + 200));
      for (const r of (data ?? []) as Omit<Row, "parent_id">[]) {
        const fp = fingerprintProduct(r);
        const key = fp?.key ?? null;
        const meta = fp ? { conflicts: fp.conflicts, display: fp.display, source: fp.source } : null;
        if (key !== r.compare_key || JSON.stringify(meta) !== JSON.stringify(r.compare_meta)) {
          await db.from("products").update({ compare_key: key, compare_meta: meta }).eq("id", r.id);
        }
      }
    }
  } catch (e) {
    // Mapping is a progressive enhancement: a failed refresh must never fail
    // the product save that triggered it. (Missing 0095 column lands here.)
    console.warn("[compare-rebuild]", e instanceof Error ? e.message : e);
  }
}

export async function rebuildCompareKeys(): Promise<BuildStats | { error: string }> {
  const db = adminClient();
  if (!db) return { error: "Service-role key missing." };

  const rows: Row[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db
      .from("products")
      .select("id, name, category, spec, attrs, parent_id, compare_key, compare_meta")
      .eq("is_active", true)
      .range(from, from + 999);
    if (error) return { error: error.message };
    if (!data?.length) break;
    rows.push(...(data as Row[]));
    if (data.length < 1000) break;
  }

  const stats: BuildStats = { scanned: rows.length, keyed: 0, groups: 0, updated: 0 };
  const groupFamilies = new Map<string, Set<string>>();
  const changes: { id: string; compare_key: string | null; compare_meta: Record<string, unknown> | null }[] = [];

  for (const r of rows) {
    const fp = fingerprintProduct(r);
    const key = fp?.key ?? null;
    const meta = fp ? { conflicts: fp.conflicts, display: fp.display, source: fp.source } : null;
    if (key) {
      stats.keyed += 1;
      const fam = r.parent_id ?? r.id;
      (groupFamilies.get(key) ?? groupFamilies.set(key, new Set()).get(key)!).add(fam);
    }
    if (key !== r.compare_key || JSON.stringify(meta) !== JSON.stringify(r.compare_meta)) {
      changes.push({ id: r.id, compare_key: key, compare_meta: meta });
    }
  }
  stats.groups = [...groupFamilies.values()].filter((f) => f.size >= 2).length;

  // Parallel batches, and one bad row never aborts the run: the first live
  // rebuild died on sequential updates (serverless deadline) leaving half
  // the catalogue unkeyed - exactly the failure this shape prevents.
  let firstError: string | null = null;
  for (let i = 0; i < changes.length; i += 40) {
    const results = await Promise.all(
      changes.slice(i, i + 40).map((c) =>
        db.from("products").update({ compare_key: c.compare_key, compare_meta: c.compare_meta }).eq("id", c.id)
      )
    );
    for (const r of results) {
      if (r.error) firstError ??= r.error.message;
      else stats.updated += 1;
    }
  }
  if (firstError && stats.updated === 0) return { error: firstError };
  return stats;
}
