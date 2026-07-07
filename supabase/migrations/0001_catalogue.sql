-- ───────────────────────────────────────────────────────────────
-- Elume catalogue → Supabase
-- Paste this whole file into Supabase → SQL Editor → Run.
-- Safe to re-run (idempotent upsert).
-- ───────────────────────────────────────────────────────────────

create table if not exists public.products (
  id           text primary key,
  sku          text not null,
  name         text not null,
  brand        text not null,
  category     text not null,
  spec         text,
  mrp          numeric(12,2) not null,   -- supplier list price
  elume_price  numeric(12,2) not null,   -- our single-unit selling price
  unit         text not null default 'pc',
  image_url    text,
  sort_order   int  not null default 0,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now()
);

-- Public read-only access (storefront catalogue). Writes stay server-side.
alter table public.products enable row level security;
drop policy if exists "public read products" on public.products;
create policy "public read products" on public.products
  for select to anon, authenticated using (is_active);

create index if not exists products_category_idx on public.products (category);
create index if not exists products_brand_idx    on public.products (brand);

insert into public.products (id, sku, name, brand, category, spec, mrp, elume_price, unit, sort_order) values
  ('poly25', 'POLY-FRLS-2.5', 'FRLS Wire 2.5 mm²', 'Polycab', 'Wires & Cables', '90 m coil · 1100 V · red', 1995, 1842, 'coil', 0),
  ('hav32', 'HAV-MCB-32C', 'DP MCB 32A ''C'' curve', 'Havells', 'Switchgear', '10 kA · 2-pole · BIS', 540, 486, 'pc', 1),
  ('schrccb', 'SCH-A9-RCCB40', 'Acti9 RCCB 40A 30mA', 'Schneider', 'Switchgear', '4-pole · Type AC', 2460, 2180, 'pc', 2),
  ('leg1w', 'LEG-MYR-1W16', 'Myrius 1-way Switch 16A', 'Legrand', 'Modular', 'Modular · white', 148, 128, 'pc', 3),
  ('crmfan', 'CRM-HB-1200', 'Hill Briz 1200mm Fan', 'Crompton', 'Fans', 'BLDC · 28 W · brown', 1820, 1640, 'pc', 4),
  ('finfr4', 'FIN-FR-4.0', 'FR Wire 4 mm²', 'Finolex', 'Wires & Cables', '90 m coil · 1100 V', 3150, 2910, 'coil', 5),
  ('abbdb8', 'ABB-DB-8SPN', '8-way DB · SPN', 'ABB', 'DB & Panels', 'IP43 · double door', 1610, 1420, 'pc', 6),
  ('sysled', 'SYS-LED-9', 'LED Bulb 9W (pack of 4)', 'Syska', 'Lighting', '6500 K · B22', 620, 540, 'pack', 7),
  ('ancroma', 'ANC-ROMA-6', 'Roma 6A Socket', 'Anchor', 'Modular', 'Modular · 2/3-pin', 112, 96, 'pc', 8),
  ('poly15', 'POLY-FRLS-1.5', 'FRLS Wire 1.5 mm²', 'Polycab', 'Wires & Cables', '90 m coil · 1100 V · blue', 1290, 1180, 'coil', 9),
  ('havpanel', 'HAV-LED-18', 'LED Panel 18W · DW', 'Havells', 'Lighting', 'Recessed · square', 485, 420, 'pc', 10),
  ('schliv', 'SCH-LIV-2M', 'Livia 2M Socket', 'Schneider', 'Modular', '16A · modular', 240, 210, 'pc', 11),
  ('cmi-gs-10-red', 'CMI-GS-1.0-RED', 'GreenShield House Wire 1.0 sq mm — Red', 'CMI', 'Wires & Cables', '90 m coil · single-core copper · FR PVC · 10-yr warranty', 3000, 1659, 'coil', 12),
  ('cmi-gs-15-red', 'CMI-GS-1.5-RED', 'GreenShield House Wire 1.5 sq mm — Red', 'CMI', 'Wires & Cables', '90 m coil · single-core copper · FR PVC · 10-yr warranty', 4480, 2426, 'coil', 13),
  ('cmi-gs-25-red', 'CMI-GS-2.5-RED', 'GreenShield House Wire 2.5 sq mm — Red', 'CMI', 'Wires & Cables', '90 m coil · single-core copper · FR PVC · 10-yr warranty', 6080, 3840, 'coil', 14),
  ('cmi-gs-10-blu', 'CMI-GS-1.0-BLU', 'GreenShield House Wire 1.0 sq mm — Blue', 'CMI', 'Wires & Cables', '90 m coil · single-core copper · FR PVC · 10-yr warranty', 3000, 1659, 'coil', 15),
  ('cmi-gs-15-blu', 'CMI-GS-1.5-BLU', 'GreenShield House Wire 1.5 sq mm — Blue', 'CMI', 'Wires & Cables', '90 m coil · single-core copper · FR PVC · 10-yr warranty', 4480, 2426, 'coil', 16),
  ('cmi-gs-25-blu', 'CMI-GS-2.5-BLU', 'GreenShield House Wire 2.5 sq mm — Blue', 'CMI', 'Wires & Cables', '90 m coil · single-core copper · FR PVC · 10-yr warranty', 6080, 3840, 'coil', 17),
  ('cmi-gs-10-blk', 'CMI-GS-1.0-BLK', 'GreenShield House Wire 1.0 sq mm — Black', 'CMI', 'Wires & Cables', '90 m coil · single-core copper · FR PVC · 10-yr warranty', 3000, 1659, 'coil', 18),
  ('cmi-gs-15-blk', 'CMI-GS-1.5-BLK', 'GreenShield House Wire 1.5 sq mm — Black', 'CMI', 'Wires & Cables', '90 m coil · single-core copper · FR PVC · 10-yr warranty', 4480, 2426, 'coil', 19),
  ('cmi-gs-25-blk', 'CMI-GS-2.5-BLK', 'GreenShield House Wire 2.5 sq mm — Black', 'CMI', 'Wires & Cables', '90 m coil · single-core copper · FR PVC · 10-yr warranty', 6080, 3840, 'coil', 20),
  ('cmi-gs-10-yel', 'CMI-GS-1.0-YEL', 'GreenShield House Wire 1.0 sq mm — Yellow', 'CMI', 'Wires & Cables', '90 m coil · single-core copper · FR PVC · 10-yr warranty', 3000, 1659, 'coil', 21),
  ('cmi-gs-15-yel', 'CMI-GS-1.5-YEL', 'GreenShield House Wire 1.5 sq mm — Yellow', 'CMI', 'Wires & Cables', '90 m coil · single-core copper · FR PVC · 10-yr warranty', 4480, 2426, 'coil', 22),
  ('cmi-gs-25-yel', 'CMI-GS-2.5-YEL', 'GreenShield House Wire 2.5 sq mm — Yellow', 'CMI', 'Wires & Cables', '90 m coil · single-core copper · FR PVC · 10-yr warranty', 7000, 4249, 'coil', 23)
on conflict (id) do update set
  sku = excluded.sku, name = excluded.name, brand = excluded.brand,
  category = excluded.category, spec = excluded.spec, mrp = excluded.mrp,
  elume_price = excluded.elume_price, unit = excluded.unit, sort_order = excluded.sort_order;
