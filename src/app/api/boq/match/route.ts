import { NextResponse } from "next/server";
import { getProfile, isBusiness, hasPurchases } from "@/lib/profile";
import { isAdmin } from "@/lib/admin/auth";
import { adminClient } from "@/lib/supabase/admin";
import { fetchProducts } from "@/lib/products";
import { parseBoqText, parseBoqRows } from "@/lib/boq/parse";
import { parseCsv } from "@/lib/admin/import";
import { buildBoqIndex, matchBoqLine, type AliasMap, type BoqCandidate } from "@/lib/boq/match";

/**
 * Smart BOM matching endpoint (business accounts only).
 * Body: { source: 'paste'|'csv'|'xlsx', name?: string, text?: string, rows?: string[][] }
 * Returns the persisted upload id plus every line's match, alternates
 * hydrated into card-ready product summaries for the review table.
 * The catalogue index builds from the shared cached fetch (no extra egress);
 * learned aliases load fresh per request so corrections apply immediately.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

type Body = { source?: "paste" | "csv" | "xlsx"; name?: string; text?: string; rows?: string[][] };

export async function POST(req: Request) {
  // Two doors: the admin cookie (/admin/boq console, owner fulfilling
  // enquiries on a customer's behalf) or a business account with purchases.
  const admin = await isAdmin();
  const profile = admin ? null : await getProfile();
  if (!admin) {
    if (!profile) return NextResponse.json({ ok: false, error: "Sign in to use Smart BOM." }, { status: 401 });
    if (!isBusiness(profile)) return NextResponse.json({ ok: false, error: "Smart BOM is available on business accounts." }, { status: 403 });
    // Owner gate (Aug 2026): early access for business customers WITH a
    // record of purchase - the tool is not public yet.
    if (!(await hasPurchases(profile.email))) return NextResponse.json({ ok: false, error: "Smart BOM unlocks after your first order." }, { status: 403 });
  }

  let body: Body;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Bad request." }, { status: 400 }); }

  const lines = Array.isArray(body.rows) && body.rows.length
    ? parseBoqRows(body.rows.slice(0, 400).map((r) => (Array.isArray(r) ? r.map(String) : [String(r)])))
    : typeof body.text === "string" && body.text.trim()
      ? body.source === "csv"
        ? parseBoqRows(parseCsv(body.text.slice(0, 200_000)).slice(0, 400))
        : parseBoqText(body.text.slice(0, 100_000))
      : [];
  if (!lines.length) return NextResponse.json({ ok: false, error: "No BOQ lines found - paste the line items or upload the sheet." }, { status: 422 });

  const [products, db] = [await fetchProducts(), adminClient()];
  const index = buildBoqIndex(products);

  // Learned aliases: alias_norm -> ranked candidates by hits.
  const aliases: AliasMap = new Map();
  if (db) {
    const { data } = await db.from("product_aliases").select("alias_norm, product_id, hits").order("hits", { ascending: false }).limit(5000);
    for (const r of data ?? []) {
      const list = aliases.get(r.alias_norm) ?? [];
      list.push({ id: r.product_id, score: Number(r.hits) || 1 });
      aliases.set(r.alias_norm, list);
    }
  }

  const matches = lines.map((line) => matchBoqLine(line, index, aliases));

  // Persist the upload + lines so feedback and history work. Admin-run BOQs
  // carry user_id null (migration 0125 relaxed the column).
  let uploadId: string | null = null;
  if (db) {
    const { data: up, error } = await db.from("boq_uploads").insert({
      user_id: profile?.id ?? null,
      name: (body.name ?? "").slice(0, 120) || null,
      source: body.source ?? "paste",
      line_count: lines.length,
    }).select("id").single();
    if (!error && up) {
      uploadId = up.id;
      await db.from("boq_lines").insert(matches.map((m) => ({
        upload_id: up.id,
        user_id: profile?.id ?? null,
        position: m.line.position,
        raw_line: m.line.raw.slice(0, 500),
        qty: m.line.qty,
        qty_unit: m.line.unit,
        matched_product_id: m.productId,
        confidence: m.confidence,
        match_method: m.method,
        alternates: m.alternates,
        status: m.productId ? "proposed" : "unmatched",
        final_qty: m.finalQty,
      })));
    }
  }

  // Hydrate product summaries for the review UI (top pick + alternates).
  const need = new Set<string>();
  for (const m of matches) {
    if (m.productId) need.add(m.productId);
    for (const a of m.alternates) need.add(a.id);
  }
  const summaries: Record<string, { id: string; name: string; brand: string; sku: string; price: number; mrp: number; unit: string; cat: string; gstRate?: number; image?: string }> = {};
  for (const id of need) {
    const p = index.byId.get(id);
    if (p) summaries[id] = { id: p.id, name: p.name, brand: p.brand, sku: p.sku, price: p.price, mrp: p.market, unit: p.unit, cat: p.cat, gstRate: p.gstRate, image: p.image };
  }

  return NextResponse.json({
    ok: true,
    uploadId,
    lines: matches.map((m) => ({
      position: m.line.position,
      raw: m.line.raw,
      description: m.line.description,
      qty: m.line.qty,
      unit: m.line.unit,
      productId: m.productId,
      confidence: m.confidence,
      method: m.method,
      alternates: m.alternates.map((a: BoqCandidate) => a.id),
      finalQty: m.finalQty,
      qtyNote: m.qtyNote,
    })),
    products: summaries,
  });
}
