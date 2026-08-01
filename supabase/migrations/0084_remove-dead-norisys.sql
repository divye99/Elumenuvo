-- 0084: remove the 9 Norisys listings whose ONLY photo was a dead
-- BestOfElectricals URL (confirmed 404 in the 2026-08-01 image audit; BOE
-- deleted the files, and no verifiable replacement was found). They are
-- fully removed from the catalogue per the decision of 2026-08-01.
-- None of the 9 is a variant-family parent (checked before generating).

delete from public.competitor_map where product_id in (
  'boe5647','boe5649','boe5668','boe7536','boe8238','boe8520','boe8524','boe8528','boe8530'
);
delete from public.price_history where product_id in (
  'boe5647','boe5649','boe5668','boe7536','boe8238','boe8520','boe8524','boe8528','boe8530'
);
delete from public.products where id in (
  'boe5647','boe5649','boe5668','boe7536','boe8238','boe8520','boe8524','boe8528','boe8530'
);
