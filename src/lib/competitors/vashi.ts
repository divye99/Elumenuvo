/**
 * Vashi (vashiisl.com) adapter — SAP Commerce OCC API. The real B2B net price
 * is PUBLIC: send the `X-Custom-Pincode` header and the price object returns the
 * discounted price (value = net incl GST, mrp = list). No login required.
 *   e.g. I-2.5PX1CBLKFRLS100 → value ₹43.78 (net inc GST) vs mrp ₹92.75 (list).
 */
import type { CompetitorAdapter, CompetitorItem } from "./types";

const OCC = "https://prodapi.vashiisl.com/occ/v2/visl";
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36";
// A metro pincode unlocks representative net pricing (Vashi is Mumbai-based).
const PINCODE = process.env.VASHI_PINCODE || "400001";

function headers(): Record<string, string> {
  return {
    "User-Agent": UA,
    Accept: "application/json",
    "X-Custom-Country": "IN",
    "X-Custom-Pincode": PINCODE,
    "X-Custom-Dealer": "",
  };
}

function num(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === "string" ? Number(v.replace(/[₹,\s]/g, "")) : Number(v);
  return Number.isFinite(n) ? n : null;
}

function toItem(p: Record<string, any>): CompetitorItem {
  const price = p.price ?? {};
  const list = num(price.mrp ?? price.mrpValue); // list / MRP
  const value = num(price.value ?? price.sellingPrice); // net (incl GST) with pincode
  const net = value != null && list != null && value < list ? value : null;
  const rel = typeof p.url === "string" ? p.url : null;
  return {
    code: String(p.code ?? ""),
    name: String(p.name ?? ""),
    brand: (p.manufacturer as string) ?? null,
    listPrice: list ?? value,
    netPrice: net,
    url: rel ? (rel.startsWith("http") ? rel : `https://vashiisl.com${rel}`) : null,
    inStock: p.stock?.stockLevelStatus ? p.stock.stockLevelStatus !== "outOfStock" : null,
  };
}

export const vashiAdapter: CompetitorAdapter = {
  key: "vashi",
  name: "Vashi",
  siteUrl: "https://vashiisl.com",
  needsLogin: false, // net price is public via the pincode header

  async search(query, limit = 12) {
    const q = encodeURIComponent(query.trim());
    if (!q) return [];
    try {
      const res = await fetch(`${OCC}/products/search?query=${q}&fields=FULL&currentPage=0&pageSize=${limit}&lang=en&curr=INR`, { headers: headers(), cache: "no-store" });
      if (!res.ok) return [];
      const data = (await res.json()) as { products?: Record<string, any>[] };
      return (data.products ?? []).map(toItem).filter((p) => p.code);
    } catch {
      return [];
    }
  },

  async fetchByCode(code) {
    try {
      const res = await fetch(`${OCC}/products/${encodeURIComponent(code)}?fields=FULL&lang=en&curr=INR`, { headers: headers(), cache: "no-store" });
      if (!res.ok) return null;
      const data = (await res.json()) as Record<string, any>;
      if (!data.code) return null;
      return toItem(data);
    } catch {
      return null;
    }
  },
};
