-- ═══════════════════════════════════════════════════════════════
-- 0055 · Atomberg: correct per-variant mappings (brand SKU = FG-codes)
--
-- Migration 0022's auto-matcher mapped Atomberg by PARENT product ("Renesa
-- Ceiling Fan"), whose price is the cheapest variant, and even crossed
-- categories (our Efficio CEILING fan -> their EXHAUST fan). Scraped
-- atomberg.com's GraphQL variant trees: their true brand SKUs are FG-codes
-- per colour/sweep/trim. Children aren't directly queryable, so codes here
-- use the composite "PARENT::CHILD" form the Magento adapter now resolves
-- (fetch parent, read the child's own MRP + selling price).
--
-- Lines Atomberg no longer sells in our spec are left UNMAPPED on purpose:
-- Renesa+ 1200/1400 and Studio+ 1200mm have no current equivalent, and a
-- wrong match is worse than none. Notes flag successor-line matches.
-- ═══════════════════════════════════════════════════════════════

delete from public.competitor_prices where source = 'atomberg';
delete from public.competitor_map    where source = 'atomberg';

insert into public.competitor_map (product_id, source, competitor_code, competitor_url, unit_factor, note) values
  ('atm-ren-1200',     'atomberg', 'Renesa Prime::FG1080', 'https://atomberg.com/atomberg-renesa-prime-bldc-motor-3-blade-ceiling-fan', 1, 'Gloss White 1200mm Remote · Renesa Prime is the current-gen Renesa'),
  ('atm-ren-1200-blk', 'atomberg', 'Renesa Prime::FG1095', 'https://atomberg.com/atomberg-renesa-prime-bldc-motor-3-blade-ceiling-fan', 1, 'Gloss Black 1200mm Remote'),
  ('atm-ren-1200-brn', 'atomberg', 'Renesa Prime::FG1270', 'https://atomberg.com/atomberg-renesa-prime-bldc-motor-3-blade-ceiling-fan', 1, 'Gloss Brown 1200mm Remote'),
  ('atm-ren-1200-ivb', 'atomberg', 'Renesa Prime::FG1097', 'https://atomberg.com/atomberg-renesa-prime-bldc-motor-3-blade-ceiling-fan', 1, 'Gloss Seasand Ivory 1200mm Remote · closest to Ivory & Black'),
  ('atm-ren-1400-wht', 'atomberg', 'Renesa Prime::FG1081', 'https://atomberg.com/atomberg-renesa-prime-bldc-motor-3-blade-ceiling-fan', 1, 'Gloss White 1400mm Remote'),
  ('atm-ren-1400-brn', 'atomberg', 'Renesa Prime::FG1082', 'https://atomberg.com/atomberg-renesa-prime-bldc-motor-3-blade-ceiling-fan', 1, 'Honey Maplewood 1400mm Remote · closest brown finish'),
  ('atm-aris-1200-pw', 'atomberg', 'Aris Ceiling Fan::FG1184', 'https://atomberg.com/aris-ceiling-fan', 1, 'Pearl White 1200mm · Aris Gladius trim'),
  ('atm-aris-1200-tkw','atomberg', 'Aris Ceiling Fan::FG1173', 'https://atomberg.com/aris-ceiling-fan', 1, 'Dark Teakwood 1200mm · Aris Starlight trim'),
  ('atm-eff-1200-blk', 'atomberg', 'Efficio Alpha Ceiling Fan::FG0455', 'https://atomberg.com/shop-ceiling-fans-atomberg-efficio-alpha-bldc-motor-with-remote-3-blade-ceiling-fan', 1, 'Gloss Black 1200mm · Efficio Alpha succeeded the Efficio line'),
  ('atm-eff-1200-wht', 'atomberg', 'Efficio Alpha Ceiling Fan::FG0454', 'https://atomberg.com/shop-ceiling-fans-atomberg-efficio-alpha-bldc-motor-with-remote-3-blade-ceiling-fan', 1, 'Gloss White 1200mm · Efficio Alpha succeeded the Efficio line'),
  ('atm-exh-150-wht',  'atomberg', 'efficio exhaust fan::FG0482', 'https://atomberg.com/atomberg-efficio-energy-saving-exhaust-fan-with-bldc-motor', 1, 'White 150mm · exact'),
  ('atm-exh-200-wht',  'atomberg', 'efficio exhaust fan::FG0494', 'https://atomberg.com/atomberg-efficio-energy-saving-exhaust-fan-with-bldc-motor', 1, 'White 200mm · exact')
on conflict (product_id, source) do update
  set competitor_code = excluded.competitor_code,
      competitor_url  = excluded.competitor_url,
      unit_factor     = excluded.unit_factor,
      note            = excluded.note,
      updated_at      = now();

-- Sanity
select product_id, competitor_code from public.competitor_map where source = 'atomberg' order by product_id;
