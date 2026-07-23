-- ═══════════════════════════════════════════════════════════════
-- 0060 · Solar Lighthouse NXT in; discontinued LTS Outrider out
--
-- The LTS Outrider torch (LHEXTDPGEN1K010) is discontinued — Havells pulled
-- their own listing and no seller stocks it. Replaced in the catalogue by
-- the LTS Solar Lighthouse NXT 10 W (customer agreed to the swap on their
-- order). NXT priced at the standing Havells −2% rule: 940 → ₹921.
-- brand_sku set so the Havells sync auto-maps and auto-tracks it.
-- ═══════════════════════════════════════════════════════════════

insert into public.products
  (id, sku, name, brand, category, spec, mrp, elume_price, unit, image_url, is_active, brand_sku, sort_order, tech_specs)
values (
  'hav-lhextip7cn1m010',
  'HAV-SOLAR-NXT-10W',
  'Havells LTS Solar Lighthouse NXT 10 W',
  'Havells',
  'Lighting',
  'Portable Lighting · Solar lantern + torch · 10 W · Solar panel + USB Type-C charging · 3.7 V 4000 mAh Li-ion · Torch up to 10 h, back light up to 8 h · Warranty 6 months',
  1685,
  921,
  'pc',
  'https://havells.com/media/catalog/product/cache/74c1057f7991b4edb2bc7bdaa94de933/s/o/solar_main.jpg',
  true,
  'LHEXTIP7CN1M010',
  0,
  '{"source":"havells.com","description":"Solar rechargeable LED lantern","specs":{"Wattage (W)":"10 W","Battery Type Capacity":"3.7 V, 4000 mAh Li-ion","Charging Method Provision":"Integrated solar panel + USB Type-C","Back Up Duration":"Torch up to 10 hours; back light up to 8 hours at full brightness","Warranty":"6 Months","Product range":"Portable Lighting"},"key_features":["Integrated solar panel — charges in the sun, no mains needed","USB Type-C fast charging as primary","4000 mAh Li-ion battery","Torch up to 10 hrs, lantern up to 8 hrs at full brightness","2-in-1: lantern + torch","Warranty: 6 months"]}'::jsonb
)
on conflict (id) do update set
  name = excluded.name, mrp = excluded.mrp, elume_price = excluded.elume_price,
  image_url = excluded.image_url, is_active = true, brand_sku = excluded.brand_sku,
  spec = excluded.spec, tech_specs = excluded.tech_specs;

-- Discontinued everywhere (Havells listing withdrawn): remove the Outrider.
delete from public.products where id = 'hav-lhextdpgen1k010';

select id, name, elume_price, mrp from public.products where id = 'hav-lhextip7cn1m010';
