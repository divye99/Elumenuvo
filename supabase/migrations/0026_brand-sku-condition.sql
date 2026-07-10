-- ═══════════════════════════════════════════════════════════════
-- 0026 · Layered pricing intelligence — brand SKU (MPN) + item condition
--
-- Structure 1 (the match key): every product carries the MANUFACTURER's own
--   part number / model code (`brand_sku`, e.g. Havells "AHEFBXW160", Atomberg
--   "renesa-1200-white"). Competitors list the SAME physical product under the
--   same brand SKU, so this is the reliable cross-site join key — far better
--   than fuzzy name matching, which is why we currently see only one seller.
--
-- Structure 2 (intelligence): admin + AI map the residue the brand SKU can't
--   resolve. `item_condition` records what each competitor is actually selling
--   (New / Refurbished / Open box) so like-for-like comparisons stay honest.
-- ═══════════════════════════════════════════════════════════════

-- ── Product's manufacturer part number (the canonical cross-site key) ──
alter table public.products
  add column if not exists brand_sku text;
create index if not exists products_brand_sku_idx on public.products (brand_sku);

comment on column public.products.brand_sku is
  'Manufacturer part number / model code (MPN). Layer-1 key used to match this product across competitor sites.';

-- ── Item condition on each mapping (defaults to New) ──
alter table public.competitor_map
  add column if not exists item_condition text not null default 'New';
alter table public.competitor_map
  add column if not exists competitor_brand_sku text;   -- the brand SKU as it appears on the competitor listing (audit trail)

comment on column public.competitor_map.item_condition is 'New | Refurbished | Open box — condition of the mapped competitor listing.';
comment on column public.competitor_map.competitor_brand_sku is 'Brand SKU/MPN found on the competitor listing — proof of a correct Layer-1 match.';

-- ── Carry condition onto the live price snapshot too ──
alter table public.competitor_prices
  add column if not exists item_condition text not null default 'New';
