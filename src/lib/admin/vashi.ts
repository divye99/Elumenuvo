/**
 * Vashi (vashiisl.com) price radar — client for their public SAP Commerce OCC
 * API. Read-only, polite (monthly), used for competitive price intelligence.
 */
export const VASHI_BASE = "https://prodapi.vashiisl.com/occ/v2/visl";
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36";

export type VashiProduct = {
  code: string;
  name: string;
  brand: string | null;
  price: number | null;
  url: string | null;
  inStock: boolean | null;
};

function toProduct(p: Record<string, unknown>): VashiProduct {
  const price = p.price as { value?: number } | undefined;
  const stock = p.stock as { stockLevelStatus?: string } | undefined;
  const rel = typeof p.url === "string" ? p.url : null;
  return {
    code: String(p.code ?? ""),
    name: String(p.name ?? ""),
    brand: (p.manufacturer as string) ?? null,
    price: typeof price?.value === "number" ? price.value : null,
    url: rel ? (rel.startsWith("http") ? rel : `https://vashiisl.com${rel}`) : null,
    inStock: stock?.stockLevelStatus ? stock.stockLevelStatus !== "outOfStock" : null,
  };
}

/** Fetch one product's live price by its Vashi code. */
export async function fetchVashiProduct(code: string): Promise<VashiProduct | null> {
  const url = `${VASHI_BASE}/products/${encodeURIComponent(code)}?fields=FULL&lang=en&curr=INR`;
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" }, cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as Record<string, unknown>;
    if (!data.code) return null;
    return toProduct(data);
  } catch {
    return null;
  }
}

/** Free-text product search (for the admin's "find the Vashi match" picker). */
export async function searchVashi(query: string, limit = 12): Promise<VashiProduct[]> {
  const q = encodeURIComponent(query.trim());
  if (!q) return [];
  const url = `${VASHI_BASE}/products/search?query=${q}&fields=FULL&currentPage=0&pageSize=${limit}&lang=en&curr=INR`;
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" }, cache: "no-store" });
    if (!res.ok) return [];
    const data = (await res.json()) as { products?: Record<string, unknown>[] };
    return (data.products ?? []).map(toProduct).filter((p) => p.code);
  } catch {
    return [];
  }
}

/** Comparable price (Vashi price × unit factor) and the ₹1-under suggestion. */
export function computeSuggestion(vashiPrice: number, unitFactor: number): { comparable: number; suggested: number } {
  const comparable = Math.round(vashiPrice * unitFactor * 100) / 100;
  return { comparable, suggested: Math.max(1, Math.round(comparable) - 1) };
}
