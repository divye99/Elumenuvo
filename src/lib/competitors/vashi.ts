/**
 * Vashi (vashiisl.com) adapter — SAP Commerce OCC API + Spartacus OAuth.
 * Anonymous calls return the list/MRP price; an OAuth password-grant token
 * (from a Vashi B2B account) unlocks the net selling price.
 */
import type { CompetitorAdapter, CompetitorItem } from "./types";

const BASE = "https://prodapi.vashiisl.com";
const OCC = `${BASE}/occ/v2/visl`;
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36";
// Spartacus OAuth client — client_secret is baked into their bundle; client_id
// is the Spartacus default and overridable via env if it ever changes.
const CLIENT_ID = process.env.VASHI_CLIENT_ID || "mobile_android";
const CLIENT_SECRET = process.env.VASHI_CLIENT_SECRET || "vislsecret";

function headers(auth?: string | null): Record<string, string> {
  const h: Record<string, string> = { "User-Agent": UA, Accept: "application/json" };
  if (auth) h.Authorization = `Bearer ${auth}`;
  return h;
}

function toItem(p: Record<string, any>): CompetitorItem {
  const price = p.price ?? {};
  const list = num(price.mrp ?? price.mrpValue ?? price.value);
  const selling = num(price.value ?? price.sellingPrice);
  // Net only differs when we're authenticated and the selling price is below MRP.
  const net = selling != null && list != null && selling < list ? selling : null;
  const rel = typeof p.url === "string" ? p.url : null;
  return {
    code: String(p.code ?? ""),
    name: String(p.name ?? ""),
    brand: (p.manufacturer as string) ?? null,
    listPrice: list ?? selling,
    netPrice: net,
    url: rel ? (rel.startsWith("http") ? rel : `https://vashiisl.com${rel}`) : null,
    inStock: p.stock?.stockLevelStatus ? p.stock.stockLevelStatus !== "outOfStock" : null,
  };
}

function num(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === "string" ? Number(v.replace(/[₹,\s]/g, "")) : Number(v);
  return Number.isFinite(n) ? n : null;
}

export const vashiAdapter: CompetitorAdapter = {
  key: "vashi",
  name: "Vashi",
  siteUrl: "https://vashiisl.com",
  needsLogin: true,

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

  async fetchByCode(code, auth) {
    try {
      const res = await fetch(`${OCC}/products/${encodeURIComponent(code)}?fields=FULL&lang=en&curr=INR`, { headers: headers(auth), cache: "no-store" });
      if (!res.ok) return null;
      const data = (await res.json()) as Record<string, any>;
      if (!data.code) return null;
      return toItem(data);
    } catch {
      return null;
    }
  },

  async login(username, password) {
    if (!username || !password) return null;
    const body = new URLSearchParams({
      grant_type: "password",
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      username,
      password,
    });
    try {
      const res = await fetch(`${BASE}/authorizationserver/oauth/token`, {
        method: "POST",
        headers: { "User-Agent": UA, "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
        body,
        cache: "no-store",
      });
      if (!res.ok) return null;
      const data = (await res.json()) as { access_token?: string };
      return data.access_token ?? null;
    } catch {
      return null;
    }
  },
};
