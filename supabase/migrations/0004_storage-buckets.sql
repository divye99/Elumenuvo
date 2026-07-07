-- ───────────────────────────────────────────────────────────────
-- Product image storage → Supabase
-- Paste into Supabase → SQL Editor → Run (once). Or create a public
-- bucket named "product-images" in Storage → New bucket (public).
-- ───────────────────────────────────────────────────────────────

-- Public bucket for product photos (uploads happen server-side via service role).
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do update set public = true;

-- Allow anyone to read the images (the storefront shows them).
drop policy if exists "public read product images" on storage.objects;
create policy "public read product images" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'product-images');
