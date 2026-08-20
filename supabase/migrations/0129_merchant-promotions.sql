-- ═══════════════════════════════════════════════════════════════
-- 0129 · Google Merchant Center promotions
--
-- Promotions managed in /admin/promotions and served to Google as a
-- self-updating feed at /api/merchant-promotions - registered once in
-- Merchant Center as a file-from-link promotion source, exactly like the
-- product feed. No Content API credentials needed; edits here reach Google
-- on its next scheduled fetch.
--
-- Field notes (Google promotions feed spec):
--   promotion_id   stable slug, unique, no spaces (e.g. "freeship-4000")
--   long_title     the full offer text customers see, max 60 chars
--   offer_type     NO_CODE (auto/banner offers) or GENERIC_CODE (one shared
--                  code for everyone - NEVER our one-time ELUME10-XXXX codes)
--   applicability  ALL_PRODUCTS, or SPECIFIC_PRODUCTS with item_ids
--   dates          effective window, max 6 months per Google
-- ═══════════════════════════════════════════════════════════════

create table if not exists public.merchant_promotions (
  id              uuid primary key default gen_random_uuid(),
  promotion_id    text not null unique,
  long_title      text not null,
  offer_type      text not null default 'NO_CODE' check (offer_type in ('NO_CODE', 'GENERIC_CODE')),
  redemption_code text,                          -- required when GENERIC_CODE
  applicability   text not null default 'ALL_PRODUCTS' check (applicability in ('ALL_PRODUCTS', 'SPECIFIC_PRODUCTS')),
  item_ids        text[],                        -- product ids when SPECIFIC_PRODUCTS
  min_purchase    numeric,                       -- optional minimum order value (INR)
  starts_at       timestamptz not null,
  ends_at         timestamptz not null,
  active          boolean not null default true,
  created_at      timestamptz not null default now()
);

alter table public.merchant_promotions enable row level security; -- service-role only

select 'merchant promotions ready' as status;
