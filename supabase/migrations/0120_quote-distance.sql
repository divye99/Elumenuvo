-- 0120: straight-line pickup->delivery distance on every courier quote.
-- Computed offline from the GeoNames pincode centroids (lib/geo.ts) - no
-- external geocoding API. Lets rate intelligence analyse price-per-km and
-- distance-banded lanes, feeding the future best-partner model.

alter table public.courier_quotes add column if not exists distance_km numeric;
