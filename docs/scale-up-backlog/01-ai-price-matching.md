# 01 · AI price matching (LLM Layer 2) — PAUSED

**Parked:** 2026-07-10 · **Decision:** brand-SKU (Layer 1) + fuzzy name matcher +
manual approval is enough at current scale. Revisit when the residue of unmatched /
ambiguous products grows past what an admin can approve by hand.

## What it is

The pricing-intelligence stack is layered:

1. **Layer 1 — brand SKU (MPN)** ✅ built. Deterministic cross-site join on the
   manufacturer's part number (`products.brand_sku`).
2. **Layer 1.5 — fuzzy name matcher** ✅ built (`scripts/auto-map-brands.mjs`),
   writes `approval='pending'` mappings for admin review.
3. **Layer 2 — AI matching** ⏸ THIS ITEM. A Claude-powered pass over the products
   neither layer resolves: given our product (name/brand/spec/attrs) and the top-N
   candidate listings from a seller, the model picks the correct match (or
   abstains), with a confidence + reason. Output lands as `approval='pending'`
   with `match_method='ai'` — the admin approval queue already built is the
   human-in-the-loop.

## How to resume (checklist)

1. Add `ANTHROPIC_API_KEY` to Vercel env + GitHub Actions secrets.
2. Extend `competitor_map.match_method` check constraint to include `'ai'`
   (one-line migration).
3. New script `scripts/ai-match.mjs` (or a stage inside `auto-map-brands.mjs`):
   for each unresolved product × source, fetch top ~10 candidates via the existing
   adapters, ask Claude (claude-sonnet-latest is plenty) to pick/abstain, upsert
   pending mappings. Batch + cache; expect pennies per hundred products.
4. Surface `match_method='ai'` with a distinct badge in the existing approval UI
   (RadarClient + ProductManager already render pending rows).
5. Optional later: same technique for *brand-SKU extraction* from product pages
   (scrape page → ask model for the MPN) to fill `brand_sku` for brands with no
   structured store API.

## Related paused items mentioned in the same breath

- None yet — add files here as they come up.
