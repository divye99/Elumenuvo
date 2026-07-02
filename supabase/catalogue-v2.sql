-- ═══════════════════════════════════════════════════════════════
-- Elume catalogue v2 — run this ONE file in Supabase → SQL Editor.
-- Idempotent: safe to re-run any time.
--
-- Contains:
--   1. Catalogue expansion (+46 products across all categories)
--   2. Product columns: sort signals, attrs, parent_id (variant model)
--   3. Reviews + credit-waitlist tables (RLS'd)
--   4. Variant families: parent designation + attrs backfill
--   5. +29 variation SKUs (sizes / colours / lengths / quality grades)
--   6. Merchant "Recommended" picks
--
-- Variant model: every variation is a NORMAL product row (own price,
-- SKU, page, reviews) with parent_id → the family's parent product.
-- Parents have parent_id NULL. Family = parent + its children.
-- Analysis stays trivial:  parents: WHERE parent_id IS NULL;
-- family of X: WHERE id = X OR parent_id = X.
-- ═══════════════════════════════════════════════════════════════

-- ── 1. Catalogue expansion (+46) ──
insert into public.products
  (id, sku, name, brand, category, spec, mrp, elume_price, unit, sort_order, is_active)
values
  ('kei-fr-15', 'KEI-FR-1.5', 'Conflame FR Wire 1.5 sq mm', 'KEI', 'Wires & Cables', '90 m coil · single-core copper · 1100 V', 2149, 1290, 'coil', 100, true),
  ('kei-fr-25', 'KEI-FR-2.5', 'Conflame FR Wire 2.5 sq mm', 'KEI', 'Wires & Cables', '90 m coil · single-core copper · 1100 V', 3499, 2100, 'coil', 101, true),
  ('rr-fr-15', 'RR-SFR-1.5', 'Superex FR Wire 1.5 sq mm', 'RR Kabel', 'Wires & Cables', '90 m coil · single-core copper · HR PVC', 2260, 1350, 'coil', 102, true),
  ('rr-fr-25', 'RR-SFR-2.5', 'Superex FR Wire 2.5 sq mm', 'RR Kabel', 'Wires & Cables', '90 m coil · single-core copper · HR PVC', 3690, 2230, 'coil', 103, true),
  ('hav-ll-15', 'HAV-LL-1.5', 'Life Line FR Wire 1.5 sq mm', 'Havells', 'Wires & Cables', '90 m coil · single-core copper · FR PVC', 2249, 1420, 'coil', 104, true),
  ('hav-ll-25', 'HAV-LL-2.5', 'Life Line FR Wire 2.5 sq mm', 'Havells', 'Wires & Cables', '90 m coil · single-core copper · FR PVC', 3699, 2350, 'coil', 105, true),
  ('fin-fr-10', 'FIN-FR-1.0', 'FR Wire 1.0 sq mm', 'Finolex', 'Wires & Cables', '90 m coil · single-core copper · 1100 V', 1539, 999, 'coil', 106, true),
  ('poly-fr-60', 'POLY-FR-6.0', 'FRLS Wire 6.0 sq mm', 'Polycab', 'Wires & Cables', '90 m coil · single-core copper · 1100 V', 6999, 4480, 'coil', 107, true),
  ('poly-flex-3c15', 'POLY-FLX-3C1.5', 'Flexible Cable 3-core 1.5 sq mm', 'Polycab', 'Wires & Cables', '100 m · round sheathed · copper', 6200, 4340, 'coil', 108, true),
  ('hav-mcb-6b', 'HAV-MCB-6B', 'SP MCB 6A ''B'' curve', 'Havells', 'Switchgear', '10 kA · 1-pole · IS/IEC 60898', 190, 132, 'pc', 109, true),
  ('hav-mcb-16c', 'HAV-MCB-16C', 'SP MCB 16A ''C'' curve', 'Havells', 'Switchgear', '10 kA · 1-pole · IS/IEC 60898', 205, 142, 'pc', 110, true),
  ('hav-mcb-32c-sp', 'HAV-MCB-32C-SP', 'SP MCB 32A ''C'' curve', 'Havells', 'Switchgear', '10 kA · 1-pole · IS/IEC 60898', 215, 149, 'pc', 111, true),
  ('sch-mcb-32', 'SCH-A9-MCB32', 'Acti9 SP MCB 32A', 'Schneider', 'Switchgear', '10 kA · 1-pole · C curve', 302, 218, 'pc', 112, true),
  ('leg-mcb-16', 'LEG-DX3-16C', 'DX3 SP MCB 16A', 'Legrand', 'Switchgear', '10 kA · 1-pole · C curve', 268, 188, 'pc', 113, true),
  ('abb-mcb-10', 'ABB-SB201-10', 'SP MCB 10A', 'ABB', 'Switchgear', '10 kA · 1-pole · C curve', 226, 158, 'pc', 114, true),
  ('anc-mcb-16', 'ANC-UNO-16C', 'UNO SP MCB 16A', 'Anchor', 'Switchgear', '6 kA · 1-pole · C curve', 145, 99, 'pc', 115, true),
  ('hav-rccb-40', 'HAV-RCCB-40DP', 'RCCB 40A 30mA DP', 'Havells', 'Switchgear', '2-pole · Type AC', 2100, 1490, 'pc', 116, true),
  ('leg-rccb-63', 'LEG-RCCB-63-4P', 'RCCB 63A 30mA 4P', 'Legrand', 'Switchgear', '4-pole · Type AC', 4980, 3420, 'pc', 117, true),
  ('hav-iso-40', 'HAV-ISO-40DP', 'DP Isolator 40A', 'Havells', 'Switchgear', '2-pole · switch disconnector', 480, 335, 'pc', 118, true),
  ('anc-roma-16sw', 'ANC-ROMA-16SW', 'Roma 16A 1-way Switch', 'Anchor', 'Modular', 'Modular · white · urea back', 155, 105, 'pc', 119, true),
  ('anc-roma-2w6', 'ANC-ROMA-2W6', 'Roma 6A 2-way Switch', 'Anchor', 'Modular', 'Modular · white', 92, 63, 'pc', 120, true),
  ('anc-roma-reg', 'ANC-ROMA-REG', 'Roma Fan Regulator', 'Anchor', 'Modular', 'Modular · 5-step · EME', 495, 340, 'pc', 121, true),
  ('anc-roma-2m', 'ANC-ROMA-2MPL', 'Roma 2M Cover Plate', 'Anchor', 'Modular', 'Modular · white', 65, 45, 'pc', 122, true),
  ('leg-myr-6s', 'LEG-MYR-6S', 'Myrius 6A Socket', 'Legrand', 'Modular', 'Modular · 2/3-pin · shuttered', 135, 95, 'pc', 123, true),
  ('leg-myr-16s', 'LEG-MYR-16S', 'Myrius 16A Socket', 'Legrand', 'Modular', 'Modular · 6-pin · shuttered', 240, 168, 'pc', 124, true),
  ('gm-gera-1w', 'GM-GERA-1W6', 'G-Era 6A 1-way Switch', 'GM Modular', 'Modular', 'Modular · white', 78, 54, 'pc', 125, true),
  ('hav-coral-6', 'HAV-CORAL-6SW', 'Coral 6A 1-way Switch', 'Havells', 'Modular', 'Modular · white', 55, 38, 'pc', 126, true),
  ('sch-liv-6sw', 'SCH-LIV-6SW', 'Livia 6A 1-way Switch', 'Schneider', 'Modular', 'Modular · white', 88, 61, 'pc', 127, true),
  ('phi-led-9x2', 'PHI-LED-9X2', '9W LED Bulb B22 (pack of 2)', 'Philips', 'Lighting', '6500 K · cool daylight', 499, 315, 'pack', 128, true),
  ('crm-led-10', 'CRM-LED-10', '10W LED Bulb B22', 'Crompton', 'Lighting', '6500 K · high lumen', 349, 199, 'pc', 129, true),
  ('wip-bat-20', 'WIP-GAR-20', 'Garnet 20W LED Batten 4ft', 'Wipro', 'Lighting', '6500 K · slim profile', 599, 385, 'pc', 130, true),
  ('sys-bat-20', 'SYS-BAT-20', '20W LED Batten 4ft', 'Syska', 'Lighting', '6500 K · polycarbonate', 550, 355, 'pc', 131, true),
  ('hav-pnl-15r', 'HAV-PNL-15R', '15W LED Panel · Round', 'Havells', 'Lighting', 'Recessed · 6500 K', 750, 470, 'pc', 132, true),
  ('sys-fld-30', 'SYS-FLD-30', '30W LED Flood Light', 'Syska', 'Lighting', 'IP66 · 6500 K', 1499, 940, 'pc', 133, true),
  ('phi-str-24', 'PHI-STR-24', '24W LED Street Light', 'Philips', 'Lighting', 'IP65 · 6500 K · driver on board', 2450, 1690, 'pc', 134, true),
  ('atm-ren-1200', 'ATM-REN-1200', 'Renesa 1200mm BLDC Fan', 'Atomberg', 'Fans', 'BLDC · 28 W · remote · 5-star', 4700, 3290, 'pc', 135, true),
  ('hav-amb-1200', 'HAV-AMB-1200', 'Ambrose 1200mm Fan', 'Havells', 'Fans', 'Decorative · premium finish', 4870, 3230, 'pc', 136, true),
  ('usha-racer-1200', 'USHA-RACER-1200', 'Racer 1200mm Fan', 'Usha', 'Fans', 'High speed · 400 RPM', 2570, 1780, 'pc', 137, true),
  ('ori-aero-1200', 'ORI-AERO-1200', 'Aeroquiet 1200mm Fan', 'Orient', 'Fans', 'Silent aerodynamic · 18-pole motor', 5730, 3950, 'pc', 138, true),
  ('crm-exh-250', 'CRM-BRIZ-250', 'Brizair 250mm Exhaust Fan', 'Crompton', 'Fans', 'High air delivery · white', 1850, 1230, 'pc', 139, true),
  ('hav-vent-230', 'HAV-VENT-230', 'Ventilair 230mm Exhaust Fan', 'Havells', 'Fans', 'DSP · grey', 2145, 1440, 'pc', 140, true),
  ('hav-db-8spn', 'HAV-DB-8SPN', '8-way SPN DB · Double Door', 'Havells', 'DB & Panels', 'IP43 · CRCA steel · powder coated', 1720, 1160, 'pc', 141, true),
  ('leg-db-12spn', 'LEG-EKX-12SPN', 'Ekinoxe 12-way SPN DB', 'Legrand', 'DB & Panels', 'IP43 · double door', 2480, 1690, 'pc', 142, true),
  ('abb-db-4spn', 'ABB-DB-4SPN', '4-way SPN DB', 'ABB', 'DB & Panels', 'IP43 · single door', 980, 690, 'pc', 143, true),
  ('sch-db-8tpn', 'SCH-E9-8TPN', 'Easy9 8-way TPN DB', 'Schneider', 'DB & Panels', 'IP43 · double door', 4350, 2980, 'pc', 144, true),
  ('hav-db-6tpn', 'HAV-DB-6TPN', '6-way TPN DB · Double Door', 'Havells', 'DB & Panels', 'IP43 · CRCA steel', 3390, 2320, 'pc', 145, true)
on conflict (id) do nothing;

-- ── 2. Product columns ──
alter table public.products add column if not exists units_sold     int     not null default 0;
alter table public.products add column if not exists is_recommended boolean not null default false;
alter table public.products add column if not exists attrs          jsonb;
alter table public.products add column if not exists parent_id      text references public.products(id) on delete set null;
create index if not exists products_parent_idx on public.products (parent_id) where parent_id is not null;
alter table public.products drop column if exists variant_group; -- superseded by parent_id

-- ── 3. Reviews + waitlist ──
create table if not exists public.reviews (
  id          uuid primary key default gen_random_uuid(),
  product_id  text not null references public.products(id) on delete cascade,
  author_name text not null check (char_length(author_name) between 1 and 80),
  rating      int  not null check (rating between 1 and 5),
  title       text check (char_length(title) <= 120),
  body        text check (char_length(body) <= 4000),
  is_approved boolean not null default true,
  created_at  timestamptz not null default now()
);
create index if not exists reviews_product_idx on public.reviews (product_id, created_at desc);
alter table public.reviews enable row level security;
drop policy if exists "public read reviews" on public.reviews;
create policy "public read reviews" on public.reviews for select using (is_approved);
drop policy if exists "public write reviews" on public.reviews;
create policy "public write reviews" on public.reviews for insert to anon, authenticated with check (rating between 1 and 5);

create table if not exists public.waitlist (
  id         uuid primary key default gen_random_uuid(),
  email      text not null check (position('@' in email) > 1),
  name       text,
  company    text,
  feature    text not null default 'nbfc-credit',
  created_at timestamptz not null default now()
);
alter table public.waitlist enable row level security;
drop policy if exists "public join waitlist" on public.waitlist;
create policy "public join waitlist" on public.waitlist for insert to anon, authenticated with check (true);

-- ── 4. Variant families: attrs backfill + parent designation ──
-- CMI GreenShield · parent: 1.5 sq mm Red
update public.products set attrs = jsonb_build_object(
    'Size',    case when id like '%-10-%' then '1.0 sq mm' when id like '%-15-%' then '1.5 sq mm' else '2.5 sq mm' end,
    'Colour',  case when id like '%red%' then 'Red' when id like '%blu%' then 'Blue' when id like '%blk%' then 'Black' when id like '%yel%' then 'Yellow' else 'Green' end,
    'Length',  '90 m', 'Quality', 'FR')
  where id like 'cmi-gs-%';
update public.products set parent_id = 'cmi-gs-15-red' where id like 'cmi-gs-%' and id <> 'cmi-gs-15-red';

-- Polycab house wire · parent: 2.5 sq mm Red FRLS
update public.products set attrs = jsonb_build_object('Size','2.5 sq mm','Colour','Red','Length','90 m','Quality','FRLS')  where id = 'poly25';
update public.products set attrs = jsonb_build_object('Size','1.5 sq mm','Colour','Blue','Length','90 m','Quality','FRLS') where id = 'poly15';
update public.products set attrs = jsonb_build_object('Size','6.0 sq mm','Colour','Red','Length','90 m','Quality','FR')    where id = 'poly-fr-60';
update public.products set parent_id = 'poly25' where id in ('poly15','poly-fr-60');

-- Finolex FR · parent: 4.0 sq mm
update public.products set attrs = jsonb_build_object('Size','4.0 sq mm','Length','90 m','Quality','FR') where id = 'finfr4';
update public.products set attrs = jsonb_build_object('Size','1.0 sq mm','Length','90 m','Quality','FR') where id = 'fin-fr-10';
update public.products set parent_id = 'finfr4' where id = 'fin-fr-10';

-- KEI Conflame · parent: 1.5 sq mm
update public.products set attrs = jsonb_build_object('Size','1.5 sq mm','Length','90 m','Quality','FR') where id = 'kei-fr-15';
update public.products set attrs = jsonb_build_object('Size','2.5 sq mm','Length','90 m','Quality','FR') where id = 'kei-fr-25';
update public.products set parent_id = 'kei-fr-15' where id = 'kei-fr-25';

-- RR Kabel Superex · parent: 1.5 sq mm
update public.products set attrs = jsonb_build_object('Size','1.5 sq mm','Length','90 m','Quality','FR') where id = 'rr-fr-15';
update public.products set attrs = jsonb_build_object('Size','2.5 sq mm','Length','90 m','Quality','FR') where id = 'rr-fr-25';
update public.products set parent_id = 'rr-fr-15' where id = 'rr-fr-25';

-- Havells Life Line · parent: 1.5 sq mm
update public.products set attrs = jsonb_build_object('Size','1.5 sq mm','Length','90 m','Quality','FR') where id = 'hav-ll-15';
update public.products set attrs = jsonb_build_object('Size','2.5 sq mm','Length','90 m','Quality','FR') where id = 'hav-ll-25';
update public.products set parent_id = 'hav-ll-15' where id = 'hav-ll-25';

-- ── 5. New variation SKUs (+29) — every one a full product row ──
insert into public.products
  (id, sku, name, brand, category, spec, mrp, elume_price, unit, sort_order, is_active, parent_id, attrs)
values
  -- Polycab FRLS house wire · more sizes (Red)
  ('poly-frls-10-red',  'POLY-FRLS-1.0-RED',  'FRLS Wire 1.0 sq mm — Red',    'Polycab', 'Wires & Cables', '90 m coil · 1100 V · red',    1120, 985,  'coil', 200, true, 'poly25', '{"Size":"1.0 sq mm","Colour":"Red","Length":"90 m","Quality":"FRLS"}'),
  ('poly-frls-40-red',  'POLY-FRLS-4.0-RED',  'FRLS Wire 4.0 sq mm — Red',    'Polycab', 'Wires & Cables', '90 m coil · 1100 V · red',    3230, 2965, 'coil', 201, true, 'poly25', '{"Size":"4.0 sq mm","Colour":"Red","Length":"90 m","Quality":"FRLS"}'),
  ('poly-frls-100-red', 'POLY-FRLS-10-RED',   'FRLS Wire 10 sq mm — Red',     'Polycab', 'Wires & Cables', '90 m coil · 1100 V · red',    8050, 7370, 'coil', 202, true, 'poly25', '{"Size":"10 sq mm","Colour":"Red","Length":"90 m","Quality":"FRLS"}'),
  -- Polycab · 1.5 colours
  ('poly-frls-15-red',  'POLY-FRLS-1.5-RED',  'FRLS Wire 1.5 sq mm — Red',    'Polycab', 'Wires & Cables', '90 m coil · 1100 V · red',    1290, 1180, 'coil', 203, true, 'poly25', '{"Size":"1.5 sq mm","Colour":"Red","Length":"90 m","Quality":"FRLS"}'),
  ('poly-frls-15-grn',  'POLY-FRLS-1.5-GRN',  'FRLS Wire 1.5 sq mm — Green',  'Polycab', 'Wires & Cables', '90 m coil · 1100 V · green',  1290, 1180, 'coil', 204, true, 'poly25', '{"Size":"1.5 sq mm","Colour":"Green","Length":"90 m","Quality":"FRLS"}'),
  ('poly-frls-15-yel',  'POLY-FRLS-1.5-YEL',  'FRLS Wire 1.5 sq mm — Yellow', 'Polycab', 'Wires & Cables', '90 m coil · 1100 V · yellow', 1290, 1180, 'coil', 205, true, 'poly25', '{"Size":"1.5 sq mm","Colour":"Yellow","Length":"90 m","Quality":"FRLS"}'),
  ('poly-frls-15-blk',  'POLY-FRLS-1.5-BLK',  'FRLS Wire 1.5 sq mm — Black',  'Polycab', 'Wires & Cables', '90 m coil · 1100 V · black',  1290, 1180, 'coil', 206, true, 'poly25', '{"Size":"1.5 sq mm","Colour":"Black","Length":"90 m","Quality":"FRLS"}'),
  -- Polycab · 2.5 colours
  ('poly-frls-25-blu',  'POLY-FRLS-2.5-BLU',  'FRLS Wire 2.5 sq mm — Blue',   'Polycab', 'Wires & Cables', '90 m coil · 1100 V · blue',   1995, 1842, 'coil', 207, true, 'poly25', '{"Size":"2.5 sq mm","Colour":"Blue","Length":"90 m","Quality":"FRLS"}'),
  ('poly-frls-25-grn',  'POLY-FRLS-2.5-GRN',  'FRLS Wire 2.5 sq mm — Green',  'Polycab', 'Wires & Cables', '90 m coil · 1100 V · green',  1995, 1842, 'coil', 208, true, 'poly25', '{"Size":"2.5 sq mm","Colour":"Green","Length":"90 m","Quality":"FRLS"}'),
  ('poly-frls-25-yel',  'POLY-FRLS-2.5-YEL',  'FRLS Wire 2.5 sq mm — Yellow', 'Polycab', 'Wires & Cables', '90 m coil · 1100 V · yellow', 1995, 1842, 'coil', 209, true, 'poly25', '{"Size":"2.5 sq mm","Colour":"Yellow","Length":"90 m","Quality":"FRLS"}'),
  ('poly-frls-25-blk',  'POLY-FRLS-2.5-BLK',  'FRLS Wire 2.5 sq mm — Black',  'Polycab', 'Wires & Cables', '90 m coil · 1100 V · black',  1995, 1842, 'coil', 210, true, 'poly25', '{"Size":"2.5 sq mm","Colour":"Black","Length":"90 m","Quality":"FRLS"}'),
  -- Polycab · lengths + quality grade (2.5 Red)
  ('poly-frls-25-red-45m',  'POLY-FRLS-2.5-RED-45',  'FRLS Wire 2.5 sq mm — Red · 45 m',  'Polycab', 'Wires & Cables', '45 m coil · 1100 V · red',  1020, 940,  'coil', 211, true, 'poly25', '{"Size":"2.5 sq mm","Colour":"Red","Length":"45 m","Quality":"FRLS"}'),
  ('poly-frls-25-red-180m', 'POLY-FRLS-2.5-RED-180', 'FRLS Wire 2.5 sq mm — Red · 180 m', 'Polycab', 'Wires & Cables', '180 m coil · 1100 V · red', 3925, 3610, 'coil', 212, true, 'poly25', '{"Size":"2.5 sq mm","Colour":"Red","Length":"180 m","Quality":"FRLS"}'),
  ('poly-pvc-25-red',       'POLY-PVC-2.5-RED',      'PVC Wire 2.5 sq mm — Red',          'Polycab', 'Wires & Cables', '90 m coil · 1100 V · red',  1830, 1690, 'coil', 213, true, 'poly25', '{"Size":"2.5 sq mm","Colour":"Red","Length":"90 m","Quality":"PVC"}'),
  -- CMI GreenShield · Green colour + lengths
  ('cmi-gs-10-grn', 'CMI-GS-1.0-GRN', 'GreenShield House Wire 1.0 sq mm — Green', 'CMI', 'Wires & Cables', '90 m coil · single-core copper · FR PVC · 10-yr warranty', 3000, 1659, 'coil', 214, true, 'cmi-gs-15-red', '{"Size":"1.0 sq mm","Colour":"Green","Length":"90 m","Quality":"FR"}'),
  ('cmi-gs-15-grn', 'CMI-GS-1.5-GRN', 'GreenShield House Wire 1.5 sq mm — Green', 'CMI', 'Wires & Cables', '90 m coil · single-core copper · FR PVC · 10-yr warranty', 4480, 2426, 'coil', 215, true, 'cmi-gs-15-red', '{"Size":"1.5 sq mm","Colour":"Green","Length":"90 m","Quality":"FR"}'),
  ('cmi-gs-25-grn', 'CMI-GS-2.5-GRN', 'GreenShield House Wire 2.5 sq mm — Green', 'CMI', 'Wires & Cables', '90 m coil · single-core copper · FR PVC · 10-yr warranty', 6080, 3840, 'coil', 216, true, 'cmi-gs-15-red', '{"Size":"2.5 sq mm","Colour":"Green","Length":"90 m","Quality":"FR"}'),
  ('cmi-gs-15-red-45m',  'CMI-GS-1.5-RED-45',  'GreenShield House Wire 1.5 sq mm — Red · 45 m',  'CMI', 'Wires & Cables', '45 m coil · single-core copper · FR PVC · 10-yr warranty',  2280, 1290, 'coil', 217, true, 'cmi-gs-15-red', '{"Size":"1.5 sq mm","Colour":"Red","Length":"45 m","Quality":"FR"}'),
  ('cmi-gs-15-red-180m', 'CMI-GS-1.5-RED-180', 'GreenShield House Wire 1.5 sq mm — Red · 180 m', 'CMI', 'Wires & Cables', '180 m coil · single-core copper · FR PVC · 10-yr warranty', 8890, 4790, 'coil', 218, true, 'cmi-gs-15-red', '{"Size":"1.5 sq mm","Colour":"Red","Length":"180 m","Quality":"FR"}'),
  -- Finolex FR · more sizes
  ('fin-fr-15', 'FIN-FR-1.5', 'FR Wire 1.5 sq mm', 'Finolex', 'Wires & Cables', '90 m coil · single-core copper · 1100 V', 1750, 1145, 'coil', 219, true, 'finfr4', '{"Size":"1.5 sq mm","Length":"90 m","Quality":"FR"}'),
  ('fin-fr-25', 'FIN-FR-2.5', 'FR Wire 2.5 sq mm', 'Finolex', 'Wires & Cables', '90 m coil · single-core copper · 1100 V', 2760, 1795, 'coil', 220, true, 'finfr4', '{"Size":"2.5 sq mm","Length":"90 m","Quality":"FR"}'),
  ('fin-fr-60', 'FIN-FR-6.0', 'FR Wire 6.0 sq mm', 'Finolex', 'Wires & Cables', '90 m coil · single-core copper · 1100 V', 6760, 4390, 'coil', 221, true, 'finfr4', '{"Size":"6.0 sq mm","Length":"90 m","Quality":"FR"}'),
  -- KEI Conflame · more sizes
  ('kei-fr-10', 'KEI-FR-1.0', 'Conflame FR Wire 1.0 sq mm', 'KEI', 'Wires & Cables', '90 m coil · single-core copper · 1100 V', 1490, 890,  'coil', 222, true, 'kei-fr-15', '{"Size":"1.0 sq mm","Length":"90 m","Quality":"FR"}'),
  ('kei-fr-40', 'KEI-FR-4.0', 'Conflame FR Wire 4.0 sq mm', 'KEI', 'Wires & Cables', '90 m coil · single-core copper · 1100 V', 5590, 3350, 'coil', 223, true, 'kei-fr-15', '{"Size":"4.0 sq mm","Length":"90 m","Quality":"FR"}'),
  -- RR Kabel Superex · more sizes
  ('rr-fr-10', 'RR-SFR-1.0', 'Superex FR Wire 1.0 sq mm', 'RR Kabel', 'Wires & Cables', '90 m coil · single-core copper · HR PVC', 1560, 930,  'coil', 224, true, 'rr-fr-15', '{"Size":"1.0 sq mm","Length":"90 m","Quality":"FR"}'),
  ('rr-fr-40', 'RR-SFR-4.0', 'Superex FR Wire 4.0 sq mm', 'RR Kabel', 'Wires & Cables', '90 m coil · single-core copper · HR PVC', 5940, 3560, 'coil', 225, true, 'rr-fr-15', '{"Size":"4.0 sq mm","Length":"90 m","Quality":"FR"}'),
  -- Havells Life Line · more sizes
  ('hav-ll-10', 'HAV-LL-1.0', 'Life Line FR Wire 1.0 sq mm', 'Havells', 'Wires & Cables', '90 m coil · single-core copper · FR PVC', 1520, 960,  'coil', 226, true, 'hav-ll-15', '{"Size":"1.0 sq mm","Length":"90 m","Quality":"FR"}'),
  ('hav-ll-40', 'HAV-LL-4.0', 'Life Line FR Wire 4.0 sq mm', 'Havells', 'Wires & Cables', '90 m coil · single-core copper · FR PVC', 5930, 3750, 'coil', 227, true, 'hav-ll-15', '{"Size":"4.0 sq mm","Length":"90 m","Quality":"FR"}'),
  ('hav-ll-60', 'HAV-LL-6.0', 'Life Line FR Wire 6.0 sq mm', 'Havells', 'Wires & Cables', '90 m coil · single-core copper · FR PVC', 8710, 5480, 'coil', 228, true, 'hav-ll-15', '{"Size":"6.0 sq mm","Length":"90 m","Quality":"FR"}')
on conflict (id) do nothing;

-- ── 6. Merchant "Recommended" picks ──
update public.products set is_recommended = true
where id in ('cmi-gs-15-red', 'poly25', 'hav32', 'atm-ren-1200', 'anc-roma-16sw', 'sys-bat-20', 'hav-db-8spn', 'leg-myr-6s');

-- ── Summary ──
select 'total products' as metric, count(*)::text as value from public.products
union all select 'parents / standalone', count(*)::text from public.products where parent_id is null
union all select 'variations (children)', count(*)::text from public.products where parent_id is not null
union all select 'variant families', count(distinct parent_id)::text from public.products where parent_id is not null
union all select 'recommended', count(*)::text from public.products where is_recommended;
