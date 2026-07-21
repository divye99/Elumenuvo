/**
 * Generic Magento 2 adapter over the public GraphQL endpoint (/graphql, no auth).
 *   • search      → products(search: "…", pageSize: n)
 *   • fetchByCode → products(filter: { sku: { eq: "…" } })   (competitor_code = SKU)
 * `regular_price` is the MRP/list, `final_price` the current selling price (our
 * "net"). Powers Legrand + Havells today; any Magento store with GraphQL enabled
 * is a one-liner via makeMagentoAdapter({ key, name, siteUrl }).
 */
import type { CompetitorAdapter, CompetitorItem } from "./types";

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36";
const FIELDS = "items{sku name url_key canonical_url stock_status price_range{minimum_price{regular_price{value} final_price{value}}}}";

/** Product URL differs per store: Havells pages need the .html suffix (their
 *  canonical_url carries it; bare url_key 404s), while Atomberg is the exact
 *  opposite (bare url_key works, .html 404s, canonical_url absent). Rule:
 *  trust canonical_url when the store provides it, else use the bare url_key. */
function productUrl(base: string, it: Record<string, any>): string | null {
  if (typeof it.canonical_url === "string" && it.canonical_url) return `${base}/${it.canonical_url.replace(/^\/+/, "")}`;
  if (typeof it.url_key === "string" && it.url_key) return `${base}/${it.url_key}`;
  return null;
}

function num(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === "string" ? Number(v.replace(/[₹,\s]/g, "")) : Number(v);
  return Number.isFinite(n) ? n : null;
}

export function makeMagentoAdapter(cfg: { key: string; name: string; siteUrl: string }): CompetitorAdapter {
  const base = cfg.siteUrl.replace(/\/+$/, "");
  const endpoint = `${base}/graphql`;

  const gql = async (query: string): Promise<any> => {
    const res = await fetch(`${endpoint}?query=${encodeURIComponent(query)}`, {
      headers: { "User-Agent": UA, Accept: "application/json", "Content-Type": "application/json", Store: "default" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return res.json();
  };

  const toItem = (it: Record<string, any>): CompetitorItem => {
    const mp = it.price_range?.minimum_price ?? {};
    const regular = num(mp.regular_price?.value);
    const final = num(mp.final_price?.value);
    return {
      code: String(it.sku ?? ""),
      name: String(it.name ?? ""),
      brand: cfg.name,
      listPrice: regular ?? final,
      netPrice: final, // Magento's live selling price (our "net")
      url: productUrl(base, it),
      inStock: it.stock_status ? it.stock_status === "IN_STOCK" : null,
    };
  };

  return {
    key: cfg.key,
    name: cfg.name,
    siteUrl: cfg.siteUrl,
    needsLogin: false,

    async search(query, limit = 12) {
      const q = query.trim();
      if (!q) return [];
      try {
        const data = await gql(`query{products(search:${JSON.stringify(q)},pageSize:${limit}){${FIELDS}}}`);
        const items: Record<string, any>[] = data?.data?.products?.items ?? [];
        return items.map(toItem).filter((p) => p.code);
      } catch {
        return [];
      }
    },

    async fetchByCode(code) {
      const sku = code.trim();
      if (!sku) return null;
      try {
        // Composite "PARENT::CHILD" codes: some stores (Atomberg) don't expose
        // configurable children to direct sku queries at all — the child's
        // price only exists inside the parent's variant tree. Fetch the
        // parent, pick the child, return its prices with the parent's URL.
        if (sku.includes("::")) {
          const [parent, child] = sku.split("::").map((x) => x.trim());
          const data = await gql(`query{products(filter:{sku:{eq:${JSON.stringify(parent)}}}){items{sku name url_key canonical_url stock_status ... on ConfigurableProduct{variants{product{sku name stock_status price_range{minimum_price{regular_price{value} final_price{value}}}} attributes{label}}}}}}`);
          const par = data?.data?.products?.items?.[0];
          const hit = (par?.variants ?? []).find((v: any) => v?.product?.sku === child);
          if (!par || !hit) return null;
          const cp = hit.product.price_range?.minimum_price;
          return {
            code: sku,
            name: `${par.name} — ${(hit.attributes ?? []).map((a: any) => a.label).join(" / ")}`,
            brand: null,
            listPrice: num(cp?.regular_price?.value),
            netPrice: num(cp?.final_price?.value),
            url: productUrl(base, par),
            inStock: hit.product.stock_status ? hit.product.stock_status === "IN_STOCK" : null,
          };
        }
        const data = await gql(`query{products(filter:{sku:{eq:${JSON.stringify(sku)}}}){${FIELDS}}}`);
        const it = data?.data?.products?.items?.[0];
        return it ? toItem(it) : null;
      } catch {
        return null;
      }
    },
  };
}
