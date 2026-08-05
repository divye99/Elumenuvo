-- 0093: list the Havells Apogee 2M Dimmer 1000W White as out of stock.
-- The page stays live (SEO + spec reference) but shows the out-of-stock panel,
-- is demoted in catalogue ranking, sorts to the bottom, exports as
-- out_of_stock in the merchant feed, and checkout refuses it server-side.
-- Reversal: tick "In stock" on the product in /admin/products (or set true here).

update public.products set in_stock = false where id = 'hav-atadexw102';
