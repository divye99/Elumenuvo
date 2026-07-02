-- ───────────────────────────────────────────────────────────────
-- Elume catalogue expansion (+46 products)
-- Paste into Supabase → SQL Editor → Run. Safe to re-run:
-- ON CONFLICT DO NOTHING — never overwrites rows you've edited in /admin.
-- ───────────────────────────────────────────────────────────────

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

select count(*) as total_products from public.products;
