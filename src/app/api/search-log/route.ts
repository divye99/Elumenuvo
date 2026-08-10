import { NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { rateLimited, requestIp } from "@/lib/rate-limit";

/**
 * Fire-and-forget search logging (see migration 0047). Called via
 * navigator.sendBeacon from the storefront, so it must always answer fast and
 * never surface an error to the shopper: every failure path is a silent 204.
 * Writes with the service role; the table has no anon policies.
 */

export const runtime = "nodejs";

const ok = () => new NextResponse(null, { status: 204 });

export async function POST(request: Request) {
  if (rateLimited(`slog:${requestIp(request.headers)}`, 40, 60_000)) return new Response(null, { status: 204 });
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return ok();
  }

  const q = String(body.q ?? "").trim().slice(0, 120);
  const source = body.source === "suggest" ? "suggest" : "search";
  if (q.length < 2) return ok();

  const db = adminClient();
  if (!db) return ok(); // local dev without the service key: logging is off

  const results = Number.isFinite(Number(body.results)) ? Math.max(0, Math.min(100000, Math.round(Number(body.results)))) : null;
  const picked = body.picked ? String(body.picked).slice(0, 160) : null;

  // Cross-learning (owner, Aug 2026): a suggest pick is a human confirming
  // "this phrasing means this product" - exactly what the Smart BOM alias
  // table stores. Feed it there too, so the BOQ matcher learns from every
  // storefront search and vice versa. Best-effort: never delays the beacon.
  if (source === "suggest" && picked?.startsWith("product:") && q.length >= 4) {
    const { normalizeSearchText } = await import("@/lib/search-normalize");
    const alias_norm = normalizeSearchText(q).slice(0, 300);
    const product_id = picked.slice(8);
    if (alias_norm.length >= 4 && product_id) {
      void (async () => {
        try {
          const { data: existing } = await db.from("product_aliases")
            .select("id, hits").eq("alias_norm", alias_norm).eq("product_id", product_id).maybeSingle();
          if (existing) await db.from("product_aliases").update({ hits: (existing.hits ?? 1) + 1, updated_at: new Date().toISOString() }).eq("id", existing.id);
          else await db.from("product_aliases").insert({ alias_norm, product_id, source: "search" });
        } catch { /* learning is best-effort */ }
      })();
    }
  }
  const category = body.cat ? String(body.cat).slice(0, 60) : null;
  const session = body.sid ? String(body.sid).slice(0, 40) : null;

  try {
    await db.from("search_queries").insert({
      query: q,
      normalized: q.toLowerCase().replace(/\s+/g, " "),
      source,
      results: source === "search" ? results : null,
      picked: source === "suggest" ? picked : null,
      category,
      session_id: session,
    });
  } catch {
    /* the log must never break search */
  }
  return ok();
}
