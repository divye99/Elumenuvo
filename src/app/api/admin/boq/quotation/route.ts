import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin/auth";
import { adminClient } from "@/lib/supabase/admin";
import { fetchProducts } from "@/lib/products";
import { parseBoqText, parseBoqRows } from "@/lib/boq/parse";
import { parseCsv } from "@/lib/admin/import";
import { buildBoqIndex, matchBoqLine, type AliasMap } from "@/lib/boq/match";
import { buildQuotationDocx, type QuotationInput } from "@/lib/quotation";

/**
 * Quotation export for the admin BOQ tool (owner ask, Aug 2026): turn an
 * enquiry (customer email + RFQ product lines) into the standard Elume
 * quotation as an EDITABLE Word file - ex-GST MRP vs ex-GST Elume price with
 * the discount between them, GST once at the bottom.
 *
 * POST actions:
 *  - resolve: { text?, source? "paste"|"csv", ids? "id:qty,..." }
 *      -> items prefilled from the catalogue (Smart BOM matcher for text,
 *         direct lookup for ids), with MRP/price converted to ex-GST.
 *  - docx: { payload: QuotationInput } -> the .docx file itself.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

type Body = {
  action?: "resolve" | "docx";
  text?: string;
  source?: "paste" | "csv";
  ids?: string;
  payload?: QuotationInput;
};

const ex = (incl: number, rate: number) => Math.round((incl / (1 + rate)) * 100) / 100;

export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ ok: false, error: "Not signed in." }, { status: 403 });

  let body: Body;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Bad request." }, { status: 400 }); }

  if (body.action === "docx") {
    const q = body.payload;
    if (!q || !q.items?.length || !q.company || !q.subject) {
      return NextResponse.json({ ok: false, error: "Company, subject and at least one item are required." }, { status: 422 });
    }
    // Letterhead logo from our own CDN (public/ is not in the serverless
    // bundle); a miss just renders the text letterhead.
    let logo: Uint8Array | undefined;
    try {
      const site = (process.env.NEXT_PUBLIC_SITE_URL || "https://elumenuvo.com").replace(/\/+$/, "");
      const res = await fetch(`${site}/assets/elume-horizontal.png`);
      if (res.ok) logo = new Uint8Array(await res.arrayBuffer());
    } catch { /* text letterhead */ }
    const buf = await buildQuotationDocx(q, logo);
    const fname = `Elume-Quotation-${q.ref.replace(/[^\w-]+/g, "-")}.docx`;
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${fname}"`,
      },
    });
  }

  // ── resolve ──
  const products = await fetchProducts();
  const byId = new Map(products.map((p) => [p.id, p]));
  type Draft = {
    productId: string | null; description: string; catNo?: string; code?: string;
    qty: number; unit: string; mrpEx: number; priceEx: number; confidence: number;
  };
  const toDraft = (p: NonNullable<ReturnType<typeof byId.get>>, qty: number, confidence = 1): Draft => {
    const rate = p.gstRate ?? 0.18;
    return {
      productId: p.id,
      description: p.name,
      catNo: p.brandSku ?? p.sku ?? undefined,
      code: p.elin ?? undefined,
      qty,
      unit: p.unit === "coil" ? "Coils" : "Nos",
      mrpEx: ex(p.market, rate),
      priceEx: ex(p.price, rate),
      confidence,
    };
  };

  const items: Draft[] = [];
  if (body.ids) {
    for (const part of body.ids.split(",")) {
      const [id, qtyRaw] = part.split(":");
      const p = id ? byId.get(id.trim()) : undefined;
      if (p) items.push(toDraft(p, Math.max(1, parseInt(qtyRaw ?? "1", 10) || 1)));
    }
  } else if (typeof body.text === "string" && body.text.trim()) {
    const lines = body.source === "csv"
      ? parseBoqRows(parseCsv(body.text.slice(0, 200_000)).slice(0, 200))
      : parseBoqText(body.text.slice(0, 100_000));
    if (!lines.length) return NextResponse.json({ ok: false, error: "No product lines found in the paste." }, { status: 422 });
    const index = buildBoqIndex(products);
    const aliases: AliasMap = new Map();
    const db = adminClient();
    if (db) {
      const { data } = await db.from("product_aliases").select("alias_norm, product_id, hits").order("hits", { ascending: false }).limit(5000);
      for (const r of data ?? []) {
        const list = aliases.get(r.alias_norm) ?? [];
        list.push({ id: r.product_id, score: Number(r.hits) || 1 });
        aliases.set(r.alias_norm, list);
      }
    }
    for (const line of lines) {
      const m = matchBoqLine(line, index, aliases);
      const p = m.productId ? byId.get(m.productId) : undefined;
      if (p) items.push(toDraft(p, Math.max(1, line.qty ?? 1), m.confidence));
      else items.push({ productId: null, description: line.description, qty: Math.max(1, line.qty ?? 1), unit: "Nos", mrpEx: 0, priceEx: 0, confidence: 0 });
    }
  } else {
    return NextResponse.json({ ok: false, error: "Paste the RFQ lines or pass ids." }, { status: 422 });
  }

  return NextResponse.json({ ok: true, items });
}
