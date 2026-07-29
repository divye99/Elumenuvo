-- ═══════════════════════════════════════════════════════════════
-- 0068: in-demand wall plates & covers from Google Merchant Center's
-- "Products customers are buying" report (Wall Plates & Covers, June 2026).
--
-- 4 of the 5 suggested products, each priced from a VERIFIED live source:
--
--   Legrand Myrius NextGen 12M Pearl Champagne  679572  MRP 1728  sell  929  (shop.legrand.co.in)
--   Legrand Myrius NextGen 12M Glossy Ice White 679532  MRP 1270  sell  681  (shop.legrand.co.in)
--   Legrand Arteor 6A 1-way switch 1M White     573400  MRP  232  sell  125  (shop.legrand.co.in)
--   Havells Crabtree Athena 12M Cover Plate Wh  ACAPNCWV12 MRP 524 sell 267  (havells.com)
--
-- Our price = brand-store selling price − 2%, same rule as the Havells import.
-- The Arteor switch and the Athena plate land under the ₹300 floor, so they
-- follow the 0067 policy: listed, price-tracked, but in_stock = false.
--
-- NOT added: Anchor 66906GPW Roma Urban 6M (the 5th suggestion). No source I
-- could verify publishes its price; it needs a trade price entered by hand
-- rather than a guessed one.
--
-- The Athena plate gets a Havells competitor mapping (auto price tracking
-- works day one). The Legrand shop's API does not expose these SKUs to
-- queries, so the Legrand rows have no mapping yet and reprice manually.
-- ═══════════════════════════════════════════════════════════════

insert into public.products
  (id, sku, brand_sku, name, brand, category, spec, mrp, elume_price, unit, image_url, hsn, gst_rate, is_active, in_stock, attrs, sort_order)
values
  (
    'leg-679572', '679572', '679572',
    'Legrand Myrius NextGen Plate with Frame — Pearl Champagne · 12 Module',
    'Legrand', 'Modular',
    '12-module cover plate with support frame · Myrius NextGen · pearl champagne',
    1728, 910, 'pc',
    'https://shop.legrand.co.in/media/catalog/product/l/g/lg-679572-web-r_2.jpg',
    '8538', 0.18, true, true,
    '{"Series": "Myrius NextGen", "Modules": "12", "Colour": "Pearl Champagne"}'::jsonb, 0
  ),
  (
    'leg-679532', '679532', '679532',
    'Legrand Myrius NextGen Plate with Frame — Glossy Ice White · 12 Module',
    'Legrand', 'Modular',
    '12-module cover plate with support frame · Myrius NextGen · glossy ice white',
    1270, 667, 'pc',
    'https://shop.legrand.co.in/media/catalog/product/l/g/lg-679532-web-r_2.jpg',
    '8538', 0.18, true, true,
    '{"Series": "Myrius NextGen", "Modules": "12", "Colour": "Glossy Ice White"}'::jsonb, 0
  ),
  (
    'leg-573400', '573400', '573400',
    'Legrand Arteor 6A Switch — 1-way · 1 Module · White',
    'Legrand', 'Modular',
    '6 A one-way switch · single pole · 1 module · Arteor · white',
    232, 122, 'pc',
    'https://shop.legrand.co.in/media/catalog/product/l/g/lg-573400-web-r.jpg',
    '8536', 0.18, true, false,  -- under the Rs300 floor: browsable, not orderable
    '{"Series": "Arteor", "Modules": "1", "Colour": "White", "Rating": "6 A"}'::jsonb, 0
  ),
  (
    'hav-acapncwv12', 'ACAPNCWV12', 'ACAPNCWV12',
    'Havells Crabtree Athena 12M Cover Plate — White',
    'Havells', 'Modular',
    '12-module combined cover plate · Athena Classic · polycarbonate · white',
    524, 261, 'pc',
    'https://havells.com/media/catalog/product/cache/74c1057f7991b4edb2bc7bdaa94de933/import/Crabtree-Switches/ACAPNCWV12base.png',
    '8538', 0.18, true, false,  -- under the Rs300 floor: browsable, not orderable
    '{"Series": "Crabtree Athena", "Modules": "12", "Colour": "White"}'::jsonb, 0
  )
on conflict (id) do update set
  mrp = excluded.mrp, elume_price = excluded.elume_price, image_url = excluded.image_url,
  hsn = excluded.hsn, gst_rate = excluded.gst_rate, attrs = excluded.attrs;

-- Athena plate: exact Havells mapping so the radar tracks it from day one.
insert into public.competitor_map (product_id, source, competitor_code, unit_factor, approval, match_method)
values ('hav-acapncwv12', 'havells', 'ACAPNCWV12', 1, 'approved', 'brand-sku')
on conflict (product_id, source) do update set competitor_code = excluded.competitor_code, updated_at = now();

-- Verification
select id, name, elume_price, in_stock from public.products
where id in ('leg-679572','leg-679532','leg-573400','hav-acapncwv12');
