-- 0081: multi-photo galleries. `images` is the ordered gallery (jsonb array
-- of URLs); the existing image_url stays photo #1 and keeps feeding cards,
-- OG tags and the Merchant feed. Backfill arrives in 0082 (Havells crawl).
alter table public.products add column if not exists images jsonb;
