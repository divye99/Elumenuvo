-- ═══════════════════════════════════════════════════════════════
-- Atomberg fans + Norisys modular switches — run AFTER catalogue-v2.sql.
-- Idempotent: safe to re-run.
--
-- Data provenance (researched July 2026):
--   Atomberg MRPs from atomberg.com + retailer listings (shiningbulb,
--   technocart, betterhomeapp, balajihomeessentials). All Atomberg fans
--   are BLDC. Elume prices set near Atomberg's own online selling prices.
--   Norisys series/finishes from norisys.com (CUBE flagship, SQUARE
--   classic); MRPs from eleczo.com Norisys listings (GST-inclusive).
-- ═══════════════════════════════════════════════════════════════

-- Existing Renesa row becomes the Renesa family parent (Pearl White 1200mm)
update public.products set attrs = '{"Sweep":"1200 mm","Colour":"Pearl White"}'
where id = 'atm-ren-1200' and attrs is null;

insert into public.products
  (id, sku, name, brand, category, spec, mrp, elume_price, unit, sort_order, is_active, parent_id, attrs)
values
  -- ── Atomberg Renesa (parent: atm-ren-1200) ──
  ('atm-ren-1200-blk', 'ATM-REN-1200-BLK', 'Renesa 1200mm BLDC Fan — Midnight Black', 'Atomberg', 'Fans', 'BLDC · 28 W · 340 RPM · remote · 5-star · 2+1 yr warranty', 5190, 3630, 'pc', 300, true, 'atm-ren-1200', '{"Sweep":"1200 mm","Colour":"Midnight Black"}'),
  ('atm-ren-1200-brn', 'ATM-REN-1200-BRN', 'Renesa 1200mm BLDC Fan — Earth Brown',     'Atomberg', 'Fans', 'BLDC · 28 W · 340 RPM · remote · 5-star · 2+1 yr warranty', 5190, 3630, 'pc', 301, true, 'atm-ren-1200', '{"Sweep":"1200 mm","Colour":"Earth Brown"}'),
  ('atm-ren-1200-ivb', 'ATM-REN-1200-IVB', 'Renesa 1200mm BLDC Fan — Ivory & Black',   'Atomberg', 'Fans', 'BLDC · 28 W · 340 RPM · remote · 5-star · 2+1 yr warranty', 5190, 3630, 'pc', 302, true, 'atm-ren-1200', '{"Sweep":"1200 mm","Colour":"Ivory & Black"}'),
  ('atm-ren-1400-wht', 'ATM-REN-1400-WHT', 'Renesa 1400mm BLDC Fan — White',           'Atomberg', 'Fans', 'BLDC · 32 W · 250 RPM · remote · 5-star · 2+1 yr warranty', 5890, 4120, 'pc', 303, true, 'atm-ren-1200', '{"Sweep":"1400 mm","Colour":"White"}'),
  ('atm-ren-1400-brn', 'ATM-REN-1400-BRN', 'Renesa 1400mm BLDC Fan — Matte Brown',     'Atomberg', 'Fans', 'BLDC · 32 W · 250 RPM · remote · 5-star · 2+1 yr warranty', 5890, 4120, 'pc', 304, true, 'atm-ren-1200', '{"Sweep":"1400 mm","Colour":"Matte Brown"}'),

  -- ── Atomberg Renesa+ (parent: Pearl White 1200) ──
  ('atm-renp-1200-pw',  'ATM-RENP-1200-PW',  'Renesa+ 1200mm BLDC Fan — Pearl White',   'Atomberg', 'Fans', 'BLDC · 28 W · 340 RPM · remote · 5-star · 2+1 yr warranty', 6230, 4360, 'pc', 305, true, null, '{"Sweep":"1200 mm","Colour":"Pearl White"}'),
  ('atm-renp-1200-gld', 'ATM-RENP-1200-GLD', 'Renesa+ 1200mm BLDC Fan — Metallic Gold', 'Atomberg', 'Fans', 'BLDC · 28 W · 340 RPM · remote · 5-star · 2+1 yr warranty', 6230, 4360, 'pc', 306, true, 'atm-renp-1200-pw', '{"Sweep":"1200 mm","Colour":"Metallic Gold"}'),
  ('atm-renp-1400-brn', 'ATM-RENP-1400-BRN', 'Renesa+ 1400mm BLDC Fan — Earth Brown',   'Atomberg', 'Fans', 'BLDC · remote · 5-star · 2+1 yr warranty',                  7120, 4990, 'pc', 307, true, 'atm-renp-1200-pw', '{"Sweep":"1400 mm","Colour":"Earth Brown"}'),

  -- ── Atomberg Aris (parent: Pearl White 1200) ──
  ('atm-aris-1200-pw',  'ATM-ARIS-1200-PW',  'Aris 1200mm BLDC Fan — Pearl White',   'Atomberg', 'Fans', 'BLDC · 28 W · 360 RPM · remote · 5-star · 3+2 yr warranty', 12300, 6999, 'pc', 308, true, null, '{"Sweep":"1200 mm","Colour":"Pearl White"}'),
  ('atm-aris-1200-tkw', 'ATM-ARIS-1200-TKW', 'Aris 1200mm BLDC Fan — Dark Teakwood', 'Atomberg', 'Fans', 'BLDC · 28 W · 360 RPM · remote · 5-star · 3+2 yr warranty', 12300, 6999, 'pc', 309, true, 'atm-aris-1200-pw', '{"Sweep":"1200 mm","Colour":"Dark Teakwood"}'),

  -- ── Atomberg Efficio (parent: White 1200) ──
  ('atm-eff-1200-wht', 'ATM-EFF-1200-WHT', 'Efficio 1200mm BLDC Fan — White',       'Atomberg', 'Fans', 'BLDC · 28 W · 380 RPM · remote · 5-star · 2+1 yr warranty', 4590, 3210, 'pc', 310, true, null, '{"Sweep":"1200 mm","Colour":"White"}'),
  ('atm-eff-1200-blk', 'ATM-EFF-1200-BLK', 'Efficio 1200mm BLDC Fan — Matte Black', 'Atomberg', 'Fans', 'BLDC · 28 W · 380 RPM · remote · 5-star · 2+1 yr warranty', 4590, 3210, 'pc', 311, true, 'atm-eff-1200-wht', '{"Sweep":"1200 mm","Colour":"Matte Black"}'),

  -- ── Atomberg Studio+ (parent: Marble White 1200) ──
  ('atm-stu-1200-mw', 'ATM-STU-1200-MW', 'Studio+ 1200mm BLDC Fan — Marble White', 'Atomberg', 'Fans', 'BLDC · 28 W · 360 RPM · remote · 5-star · 2+1 yr warranty', 8910, 5560, 'pc', 312, true, null, '{"Sweep":"1200 mm","Colour":"Marble White"}'),
  ('atm-stu-1200-sg', 'ATM-STU-1200-SG', 'Studio+ 1200mm BLDC Fan — Sand Grey',    'Atomberg', 'Fans', 'BLDC · 28 W · 360 RPM · remote · 5-star · 2+1 yr warranty', 8910, 5560, 'pc', 313, true, 'atm-stu-1200-mw', '{"Sweep":"1200 mm","Colour":"Sand Grey"}'),

  -- ── Atomberg Efficio Exhaust (parent: 200mm White) ──
  ('atm-exh-200-wht', 'ATM-EXH-200-WHT', 'Efficio Exhaust Fan 200mm — White', 'Atomberg', 'Fans', 'BLDC · 20 W · 1600 RPM · 1+1 yr warranty', 2900, 1740, 'pc', 314, true, null, '{"Sweep":"200 mm","Colour":"White"}'),
  ('atm-exh-150-wht', 'ATM-EXH-150-WHT', 'Efficio Exhaust Fan 150mm — White', 'Atomberg', 'Fans', 'BLDC · 11 W · 2000 RPM · 1+1 yr warranty', 3350, 1990, 'pc', 315, true, 'atm-exh-200-wht', '{"Sweep":"150 mm","Colour":"White"}'),

  -- ── Norisys CUBE 6A 1-way switch (parent: Frost White) ──
  ('nor-cube-6a1w-fw', 'NOR-C511001', 'CUBE 6A 1-way Switch — Frost White',    'Norisys', 'Modular', 'Modular · 1M · premium flagship series', 186, 121, 'pc', 316, true, null, '{"Colour":"Frost White"}'),
  ('nor-cube-6a1w-qg', 'NOR-C511002', 'CUBE 6A 1-way Switch — Quartz Grey',    'Norisys', 'Modular', 'Modular · 1M · premium flagship series', 231, 150, 'pc', 317, true, 'nor-cube-6a1w-fw', '{"Colour":"Quartz Grey"}'),
  ('nor-cube-6a1w-cb', 'NOR-C511017', 'CUBE 6A 1-way Switch — Charcoal Black', 'Norisys', 'Modular', 'Modular · 1M · premium flagship series', 253, 164, 'pc', 318, true, 'nor-cube-6a1w-fw', '{"Colour":"Charcoal Black"}'),
  ('nor-cube-6a1w-sr', 'NOR-C511020', 'CUBE 6A 1-way Switch — Scarlet Red',    'Norisys', 'Modular', 'Modular · 1M · premium flagship series', 303, 197, 'pc', 319, true, 'nor-cube-6a1w-fw', '{"Colour":"Scarlet Red"}'),

  -- ── Norisys CUBE — more devices ──
  ('nor-cube-6a2w-fw', 'NOR-C521001', 'CUBE 6A 2-way Switch — Frost White', 'Norisys', 'Modular', 'Modular · 1M · premium flagship series', 269, 175, 'pc', 320, true, null, null),
  ('nor-cube-16s-fw',  'NOR-C533101', 'CUBE 16A 3-pin Socket — Frost White',    'Norisys', 'Modular', 'Modular · 2M · shuttered', 474, 308, 'pc', 321, true, null, '{"Colour":"Frost White"}'),
  ('nor-cube-16s-qg',  'NOR-C533102', 'CUBE 16A 3-pin Socket — Quartz Grey',    'Norisys', 'Modular', 'Modular · 2M · shuttered', 579, 376, 'pc', 322, true, 'nor-cube-16s-fw', '{"Colour":"Quartz Grey"}'),
  ('nor-cube-16s-cb',  'NOR-C533117', 'CUBE 16A 3-pin Socket — Charcoal Black', 'Norisys', 'Modular', 'Modular · 2M · shuttered', 638, 415, 'pc', 323, true, 'nor-cube-16s-fw', '{"Colour":"Charcoal Black"}'),
  ('nor-cube-twin-fw', 'NOR-C533201', 'CUBE 6/16A Twin Socket — Frost White', 'Norisys', 'Modular', 'Modular · 2M · shuttered', 507, 330, 'pc', 324, true, null, null),
  ('nor-cube-reg4-fw', 'NOR-C590401', 'CUBE 80W 4-step Fan Regulator — Frost White',  'Norisys', 'Modular', 'Modular · 1M', 835, 543, 'pc', 325, true, null, null),
  ('nor-cube-reg5-fw', 'NOR-C591101', 'CUBE 120W 5-step Fan Regulator — Frost White', 'Norisys', 'Modular', 'Modular · 2M', 1346, 875, 'pc', 326, true, null, null),
  ('nor-cube-dim-fw',  'NOR-C590501', 'CUBE 500W Light Dimmer — Frost White', 'Norisys', 'Modular', 'Modular · 1M', 787, 512, 'pc', 327, true, null, '{"Colour":"Frost White"}'),
  ('nor-cube-dim-qg',  'NOR-C590502', 'CUBE 500W Light Dimmer — Quartz Grey', 'Norisys', 'Modular', 'Modular · 1M', 970, 631, 'pc', 328, true, 'nor-cube-dim-fw', '{"Colour":"Quartz Grey"}'),
  ('nor-cube-4mpl-qg', 'NOR-C540402', 'CUBE 4-Module Vector Cover Plate — Quartz Grey', 'Norisys', 'Modular', 'Modular · 4M plate', 300, 195, 'pc', 329, true, null, null),

  -- ── Norisys SQUARE ──
  ('nor-sq-shs-fw',  'NOR-S733201', 'SQUARE 6/16A Socket with Shutter — Frost White', 'Norisys', 'Modular', 'Modular · 2M · polycarbonate classic series', 445, 289, 'pc', 330, true, null, null),
  ('nor-sq-reg5-fw', 'NOR-S790101', 'SQUARE 80W 5-step Fan Regulator — Frost White',  'Norisys', 'Modular', 'Modular · 2M · polycarbonate classic series', 1130, 735, 'pc', 331, true, null, null)
on conflict (id) do nothing;

select 'total products' as metric, count(*)::text as value from public.products
union all select 'Atomberg', count(*)::text from public.products where brand = 'Atomberg'
union all select 'Norisys', count(*)::text from public.products where brand = 'Norisys'
union all select 'variant families', count(distinct parent_id)::text from public.products where parent_id is not null;
