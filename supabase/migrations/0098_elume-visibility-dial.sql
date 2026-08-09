-- 0098: Dial DOWN Elume house-brand visibility (owner call, Aug 2026).
-- All 168 Elume wire listings carried is_recommended = true, which adds a
-- flat trend boost on every featured surface (catalogue featured sort,
-- homepage shelves, personal rails) and a "rec" badge. Until the brand has
-- earned organic pull, Elume competes on the same terms as everyone else.
-- Fully reversible: set is_recommended = true where brand = 'Elume'.

update public.products set is_recommended = false where brand = 'Elume';
