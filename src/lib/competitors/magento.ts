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

/** Find a named child inside a configurable parent's variant tree. */
function childOf(par: Record<string, any> | undefined, childSku: string) {
  return (par?.variants ?? []).find((v: any) => v?.product?.sku === childSku);
}

/** Build a CompetitorItem from a configurable parent + one of its variants:
 *  the child carries the price, the parent carries the name and the URL. */
function itemFromVariant(base: string, par: Record<string, any>, hit: Record<string, any>, code: string): CompetitorItem {
  const cp = hit.product.price_range?.minimum_price;
  return {
    code,
    name: `${par.name} - ${(hit.attributes ?? []).map((a: any) => a.label).join(" / ")}`,
    brand: null,
    listPrice: num(cp?.regular_price?.value),
    netPrice: num(cp?.final_price?.value),
    url: productUrl(base, par),
    inStock: hit.product.stock_status ? hit.product.stock_status === "IN_STOCK" : null,
  };
}

export function makeMagentoAdapter(cfg: {
  key: string; name: string; siteUrl: string;
  /** POST the query as JSON instead of GET ?query= - ABB's WAF requires it. */
  post?: boolean;
  /** The store's ProductAttributeFilterInput has no `sku` field (ABB), so all
   *  lookups go through full-text search with an exact-match check. */
  searchOnly?: boolean;
}): CompetitorAdapter {
  const base = cfg.siteUrl.replace(/\/+$/, "");
  const endpoint = `${base}/graphql`;

  const gql = async (query: string): Promise<any> => {
    const res = cfg.post
      ? await fetch(endpoint, {
          method: "POST",
          headers: { "User-Agent": UA, Accept: "application/json", "Content-Type": "application/json" },
          body: JSON.stringify({ query }),
          cache: "no-store",
        })
      : await fetch(`${endpoint}?query=${encodeURIComponent(query)}`, {
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

    /** Bulk price fetch. Magento accepts sku:{in:[...]}, so a whole sync is a
     *  few dozen calls instead of one per product. Composite PARENT::CHILD
     *  codes are grouped by parent, and one parent fetch serves all of its
     *  mapped children at once. */
    async fetchBatch(codes) {
      const out = new Map<string, CompetitorItem>();
      // searchOnly stores can't do sku:{in:[...]}; every code goes through
      // the per-code search path instead.
      if (cfg.searchOnly) return out;
      const plain: string[] = [];
      const byParent = new Map<string, string[]>(); // parent sku -> child skus
      for (const raw of codes) {
        const code = raw.trim();
        if (!code) continue;
        if (code.includes("::")) {
          const [parent, child] = code.split("::").map((x) => x.trim());
          byParent.set(parent, [...(byParent.get(parent) ?? []), child]);
        } else plain.push(code);
      }

      const CHUNK = 40;
      // Simple / parent-level products: one query per 40 SKUs.
      for (let i = 0; i < plain.length; i += CHUNK) {
        const skus = plain.slice(i, i + CHUNK);
        try {
          const data = await gql(`query{products(filter:{sku:{in:${JSON.stringify(skus)}}},pageSize:${CHUNK}){${FIELDS}}}`);
          for (const it of (data?.data?.products?.items ?? [])) out.set(it.sku, toItem(it));
        } catch { /* the per-code path can still retry these */ }
      }

      // Configurable parents: fetch the parent, then read each mapped child out
      // of its variant tree.
      const parents = [...byParent.keys()];
      for (let i = 0; i < parents.length; i += CHUNK) {
        const skus = parents.slice(i, i + CHUNK);
        try {
          const data = await gql(`query{products(filter:{sku:{in:${JSON.stringify(skus)}}},pageSize:${CHUNK}){items{sku name url_key canonical_url stock_status ... on ConfigurableProduct{variants{product{sku name stock_status price_range{minimum_price{regular_price{value} final_price{value}}}} attributes{label}}}}}}`);
          for (const par of (data?.data?.products?.items ?? [])) {
            for (const child of (byParent.get(par.sku) ?? [])) {
              const hit = childOf(par, child);
              if (hit) out.set(`${par.sku}::${child}`, itemFromVariant(base, par, hit, `${par.sku}::${child}`));
            }
          }
        } catch { /* fall through to per-code */ }
      }
      return out;
    },

    async fetchByCode(code) {
      const sku = code.trim();
      if (!sku) return null;
      try {
        // searchOnly stores (ABB): the sku filter does not exist in their
        // schema, but full-text search matches both the internal sku and the
        // brand order code. Accept an exact sku match or a url_key that
        // starts with the code (ABB url_keys begin with the order code).
        if (cfg.searchOnly) {
          const found = await gql(`query{products(search:${JSON.stringify(sku)},pageSize:5){${FIELDS}}}`);
          const items: Record<string, any>[] = found?.data?.products?.items ?? [];
          const low = sku.toLowerCase();
          const hit =
            items.find((it) => String(it.sku).toLowerCase() === low) ??
            items.find((it) => String(it.url_key ?? "").toLowerCase().startsWith(low + "/")) ??
            (items.length === 1 && sku.length >= 8 ? items[0] : null);
          return hit ? toItem(hit) : null;
        }
        // Composite "PARENT::CHILD" codes: some stores (Atomberg) don't expose
        // configurable children to direct sku queries at all - the child's
        // price only exists inside the parent's variant tree. Fetch the
        // parent, pick the child, return its prices with the parent's URL.
        if (sku.includes("::")) {
          const [parent, child] = sku.split("::").map((x) => x.trim());
          const data = await gql(`query{products(filter:{sku:{eq:${JSON.stringify(parent)}}}){items{sku name url_key canonical_url stock_status ... on ConfigurableProduct{variants{product{sku name stock_status price_range{minimum_price{regular_price{value} final_price{value}}}} attributes{label}}}}}}`);
          const par = data?.data?.products?.items?.[0];
          const hit = childOf(par, child);
          if (!par || !hit) return null;
          return itemFromVariant(base, par, hit, sku);
        }

        const data = await gql(`query{products(filter:{sku:{eq:${JSON.stringify(sku)}}}){${FIELDS}}}`);
        const it = data?.data?.products?.items?.[0];
        if (it) return toItem(it);

        // Not directly queryable. On Magento a configurable CHILD is invisible
        // to a sku filter - its price only exists inside the parent's variant
        // tree - but full-text search does match the child sku and returns the
        // parent. Roughly half of Havells' catalogue is shaped this way, so a
        // plain child sku must not be treated as "no such product".
        const found = await gql(`query{products(search:${JSON.stringify(sku)},pageSize:5){items{__typename sku name url_key canonical_url stock_status ... on ConfigurableProduct{variants{product{sku name stock_status price_range{minimum_price{regular_price{value} final_price{value}}}} attributes{label}}}}}}`);
        for (const par of (found?.data?.products?.items ?? [])) {
          const hit = childOf(par, sku);
          // resolvedCode lets the caller rewrite the mapping to PARENT::CHILD,
          // so the next sync is one exact query instead of a search.
          if (hit) return { ...itemFromVariant(base, par, hit, sku), resolvedCode: `${par.sku}::${sku}` };
        }
        return null;
      } catch {
        return null;
      }
    },
  };
}
