"use server";

import { revalidatePath } from "next/cache";
import { isAdmin } from "@/lib/admin/auth";
import { adminClient } from "@/lib/supabase/admin";
import { rebuildCompareKeys, type BuildStats } from "@/lib/compare/build";

/**
 * Admin → Compare: browse the like-to-like groups the fingerprint engine
 * built, evict wrong members, and rebuild on demand.
 *
 * A rejection is pair-level and PERMANENT: it survives every rebuild
 * (rebuilds only recompute keys; the rejection filter is applied at rail
 * query time), so evicting a product from a group can never be undone by
 * the nightly cron - only by you restoring it here.
 */

export type CompareGroupMember = {
  id: string;
  name: string;
  brand: string;
  category: string;
  price: number;
  image: string | null;
  in_stock: boolean | null;
  parent_id: string | null;
  display: [string, string][];
  source: string;
};

export type CompareGroup = { key: string; category: string; members: CompareGroupMember[] };

export type RejectedPair = { a: string; b: string; aName: string; bName: string; created_at: string };

export async function listCompareGroups(): Promise<{ groups: CompareGroup[]; rejected: RejectedPair[]; coverage: { keyed: number; total: number } }> {
  if (!(await isAdmin())) return { groups: [], rejected: [], coverage: { keyed: 0, total: 0 } };
  const db = adminClient();
  if (!db) return { groups: [], rejected: [], coverage: { keyed: 0, total: 0 } };

  type Row = { id: string; name: string; brand: string; category: string; elume_price: number; image_url: string | null; in_stock: boolean | null; parent_id: string | null; compare_key: string | null; compare_meta: { display?: [string, string][]; source?: string } | null };
  const rows: Row[] = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await db
      .from("products")
      .select("id, name, brand, category, elume_price, image_url, in_stock, parent_id, compare_key, compare_meta")
      .eq("is_active", true)
      .range(from, from + 999);
    if (!data?.length) break;
    rows.push(...(data as Row[]));
    if (data.length < 1000) break;
  }

  const byKey = new Map<string, Row[]>();
  let keyed = 0;
  for (const r of rows) {
    if (!r.compare_key) continue;
    keyed += 1;
    (byKey.get(r.compare_key) ?? byKey.set(r.compare_key, []).get(r.compare_key)!).push(r);
  }

  // A group is interesting when it spans 2+ FAMILIES (colour variants of one
  // product are one family). One representative member per family keeps the
  // console readable - the rail dedupes the same way.
  const groups: CompareGroup[] = [];
  for (const [key, members] of byKey) {
    const famRep = new Map<string, Row>();
    for (const m of members) {
      const fam = m.parent_id ?? m.id;
      if (!famRep.has(fam)) famRep.set(fam, m);
    }
    if (famRep.size < 2) continue;
    const reps = [...famRep.values()].sort((a, b) => a.elume_price - b.elume_price);
    groups.push({
      key,
      category: reps[0].category,
      members: reps.map((m) => ({
        id: m.id, name: m.name, brand: m.brand, category: m.category, price: Number(m.elume_price),
        image: m.image_url, in_stock: m.in_stock, parent_id: m.parent_id,
        display: m.compare_meta?.display ?? [], source: m.compare_meta?.source ?? "extracted",
      })),
    });
  }
  groups.sort((a, b) => b.members.length - a.members.length || a.key.localeCompare(b.key));

  const { data: rej } = await db.from("compare_rejections").select("a, b, created_at").order("created_at", { ascending: false }).limit(300);
  const nameOf = new Map(rows.map((r) => [r.id, r.name]));
  const rejected: RejectedPair[] = (rej ?? []).map((r: { a: string; b: string; created_at: string }) => ({
    ...r, aName: nameOf.get(r.a) ?? r.a, bName: nameOf.get(r.b) ?? r.b,
  }));

  return { groups, rejected, coverage: { keyed, total: rows.length } };
}

type Result = { ok: boolean; error?: string };

/** "This product doesn't belong with these": rejects the pair (id, other)
 *  for every current member of its group, both directions covered by a<b. */
export async function rejectFromGroup(id: string, otherIds: string[]): Promise<Result> {
  if (!(await isAdmin())) return { ok: false, error: "Not signed in." };
  const db = adminClient();
  if (!db) return { ok: false, error: "Service-role key missing - writes disabled." };
  const pairs = [...new Set(otherIds)]
    .filter((o) => o && o !== id)
    .map((o) => (id < o ? { a: id, b: o } : { a: o, b: id }));
  if (pairs.length === 0) return { ok: false, error: "Nothing to reject." };
  const { error } = await db.from("compare_rejections").upsert(pairs, { onConflict: "a,b" });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/compare");
  for (const p of pairs) { revalidatePath(`/catalogue/${p.a}`); revalidatePath(`/catalogue/${p.b}`); }
  return { ok: true };
}

export async function restorePair(a: string, b: string): Promise<Result> {
  if (!(await isAdmin())) return { ok: false, error: "Not signed in." };
  const db = adminClient();
  if (!db) return { ok: false, error: "Service-role key missing - writes disabled." };
  const [x, y] = a < b ? [a, b] : [b, a];
  const { error } = await db.from("compare_rejections").delete().eq("a", x).eq("b", y);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/compare");
  revalidatePath(`/catalogue/${x}`);
  revalidatePath(`/catalogue/${y}`);
  return { ok: true };
}

export async function rebuildCompareAction(): Promise<{ ok: boolean; error?: string; stats?: BuildStats }> {
  if (!(await isAdmin())) return { ok: false, error: "Not signed in." };
  const result = await rebuildCompareKeys();
  if ("error" in result) return { ok: false, error: result.error };
  revalidatePath("/admin/compare");
  return { ok: true, stats: result };
}
