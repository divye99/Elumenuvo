# Supabase migrations — Elume storefront

Ordered SQL for the FMEG storefront database (products, orders, fulfilment,
competitor radar, reviews, profiles). **Run in Supabase → SQL Editor, in
numeric order, top to bottom.** Every file is idempotent (`create table if not
exists`, `add column if not exists`, `on conflict do nothing`), so re-running one
is always safe.

Setting up a fresh database? Run `0001` → `0016` in order. Adding a feature
later? Just run its file — the numbering only encodes *dependencies*, not a
one-time sequence.

| # | File | Creates / changes | Depends on |
|---|------|-------------------|------------|
| 0001 | `0001_catalogue.sql` | `products` table + base seed | — |
| 0002 | `0002_catalogue-v2.sql` | extends `products` (variants, attrs, is_active); `reviews`, `waitlist` | 0001 |
| 0003 | `0003_atomberg-norisys.sql` | Atomberg fans + Norisys switches seed | 0002 |
| 0004 | `0004_storage-buckets.sql` | `product-images` storage bucket | — |
| 0005 | `0005_product-images.sql` | `products.image_url` + self-hosted image URLs | 0003, 0004 |
| 0006 | `0006_content.sql` | `content` table (editable site copy) | — |
| 0007 | `0007_profiles.sql` | `profiles` (account_type, GSTIN, phone) | `auth.users` |
| 0008 | `0008_verified-reviews.sql` | `orders` ledger + DB-enforced verified reviews | 0002 |
| 0009 | `0009_checkout.sql` | storefront/guest columns on `orders` | 0008 (self-contained) |
| 0010 | `0010_orders-fulfilment.sql` | `order_shipments`, `order_events`, fulfilment cols, `delivery-proofs` bucket | 0009 |
| 0011 | `0011_import-log.sql` | `import_log` (admin CSV imports) | — |
| 0012 | `0012_competitor-pricing.sql` | `competitor_sources/map/prices/history/sync_log` (drops+recreates) | 0001 |
| 0013 | `0013_competitor-map-seed.sql` | product↔competitor mapping seed (generated) | 0012, 0001 |
| 0014 | `0014_competitor-sources-brands.sql` | brand sources (Crompton/Havells/…) | 0012 |
| 0015 | `0015_repricing.sql` | `repricing_settings` (guardrails) | — |
| 0016 | `0016_price-history.sql` | `price_history` + seed a snapshot per product | 0001 |
| 0017 | `0017_online-payment.sql` | Razorpay payment refs on `orders` (razorpay_order_id, payment_id, paid_at) | 0009 |

## Notes
- **Generated files:** `0006_content.sql` is written by `scripts/gen-content-sql.ts`;
  `0013_competitor-map-seed.sql` by `scripts/auto-map-vashi.mjs`. Regenerating
  overwrites them in place.
- **Service-role only:** competitor tables, `orders`, `import_log` and
  `repricing_settings` have no anon policies — they're read/written server-side
  with the service-role key. They appear empty locally (no key in `.env.local`).
- **Not managed by the Supabase CLI** — there is no `config.toml`; these are run
  by hand. If you later adopt `supabase db push`, rename with timestamp prefixes.

## Not in this folder (separate systems)
- `drizzle/` — the multi-tenant `/app` sandbox schema (organizations, boms,
  projects…), managed by **drizzle-kit** (`npm run db:generate` / `db:push`).
  Do not mix these here.
- `sql/space/` — the Elumenuvo space-portal schema (waitlist, portal roles),
  a different subsystem.
