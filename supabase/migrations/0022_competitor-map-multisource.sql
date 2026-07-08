-- ═══════════════════════════════════════════════════════════════
-- Auto-generated MULTI-SOURCE competitor mappings (scripts/auto-map-brands.mjs).
-- Each product maps to every seller that carries it → the radar picks the
-- lowest (Amazon-style). Complements 0013 (Vashi wires). Idempotent (upsert).
-- 21 mappings across 67 products;
-- 6 products have 2+ sellers; 29 unmatched.
-- ═══════════════════════════════════════════════════════════════

insert into public.competitor_map (product_id, source, competitor_code, unit_factor, note) values ('hav32', 'havells', 'DCVNCDPA032', 1, 'auto: 32 A DP Mini MCB C Series (s6)')
  on conflict (product_id, source) do update set competitor_code = excluded.competitor_code, note = excluded.note, updated_at = now();
insert into public.competitor_map (product_id, source, competitor_code, unit_factor, note) values ('hav32', 'bestofelectricals', 'havells-crabtree-32a-sp-c-curve-10ka-mcb', 1, 'auto: Havells 32A C-Curve 10kA 1 Pole MCB (s5)')
  on conflict (product_id, source) do update set competitor_code = excluded.competitor_code, note = excluded.note, updated_at = now();
insert into public.competitor_map (product_id, source, competitor_code, unit_factor, note) values ('hav32', 'vashi', 'I-32A-MCB-2-TRAY', 1, 'auto: 32 A DP C MCB EURO 2 TRAY PACK HAVELLS (s6)')
  on conflict (product_id, source) do update set competitor_code = excluded.competitor_code, note = excluded.note, updated_at = now();
insert into public.competitor_map (product_id, source, competitor_code, unit_factor, note) values ('abbdb8', 'bestofelectricals', 'abb-8-way-spn-db', 1, 'auto: ABB SHCM8 8 Way SPN Distribution Board (s7)')
  on conflict (product_id, source) do update set competitor_code = excluded.competitor_code, note = excluded.note, updated_at = now();
insert into public.competitor_map (product_id, source, competitor_code, unit_factor, note) values ('abbdb8', 'vashi', 'I-1SYN869008R0001', 1, 'auto: ABB 1SYN869008R0001- 8way SPN Single Door DB with 8+2 module IP30 Ty (s8)')
  on conflict (product_id, source) do update set competitor_code = excluded.competitor_code, note = excluded.note, updated_at = now();
insert into public.competitor_map (product_id, source, competitor_code, unit_factor, note) values ('hav-rccb-40', 'bestofelectricals', 'havells-40a-dp-mcb-changeover-switch', 1, 'auto: Havells 40A DP MCB Changeover Switch (s6)')
  on conflict (product_id, source) do update set competitor_code = excluded.competitor_code, note = excluded.note, updated_at = now();
insert into public.competitor_map (product_id, source, competitor_code, unit_factor, note) values ('leg-rccb-63', 'bestofelectricals', 'legrand-dx3-63a-30ma-double-pole-rccb', 1, 'auto: Legrand DX3 411853 63A 30mA 2 Pole RCCB (s6)')
  on conflict (product_id, source) do update set competitor_code = excluded.competitor_code, note = excluded.note, updated_at = now();
insert into public.competitor_map (product_id, source, competitor_code, unit_factor, note) values ('hav-iso-40', 'bestofelectricals', 'havells-40a-dp-mcb-changeover-switch', 1, 'auto: Havells 40A DP MCB Changeover Switch (s7)')
  on conflict (product_id, source) do update set competitor_code = excluded.competitor_code, note = excluded.note, updated_at = now();
insert into public.competitor_map (product_id, source, competitor_code, unit_factor, note) values ('wip-bat-20', 'bestofelectricals', 'wipro-garnet-slim-20w-led-batten', 1, 'auto: Wipro Garnet Slim 20W LED Batten (s6)')
  on conflict (product_id, source) do update set competitor_code = excluded.competitor_code, note = excluded.note, updated_at = now();
insert into public.competitor_map (product_id, source, competitor_code, unit_factor, note) values ('hav-db-8spn', 'havells', 'DRDPSHODOW08', 1, 'auto: SPN 8 Way DD DB (s7)')
  on conflict (product_id, source) do update set competitor_code = excluded.competitor_code, note = excluded.note, updated_at = now();
insert into public.competitor_map (product_id, source, competitor_code, unit_factor, note) values ('hav-db-8spn', 'bestofelectricals', 'havells-8-way-dd-spn-db', 1, 'auto: Havells 8 Way DD SPN Distribution Board (s7)')
  on conflict (product_id, source) do update set competitor_code = excluded.competitor_code, note = excluded.note, updated_at = now();
insert into public.competitor_map (product_id, source, competitor_code, unit_factor, note) values ('leg-db-12spn', 'bestofelectricals', 'legrand-12-way-spn-db-all-vtpn-db-all-flexy-db-cable-end-box', 1, 'auto: Legrand 507914 12 Way SPN Cable End Box (s7)')
  on conflict (product_id, source) do update set competitor_code = excluded.competitor_code, note = excluded.note, updated_at = now();
insert into public.competitor_map (product_id, source, competitor_code, unit_factor, note) values ('leg-db-12spn', 'vashi', 'I-507612', 1, 'auto: Legrand 507612 - 12 WAY IP43 IK09 12 Module EKINOXÂ³ SPN DB (s8)')
  on conflict (product_id, source) do update set competitor_code = excluded.competitor_code, note = excluded.note, updated_at = now();
insert into public.competitor_map (product_id, source, competitor_code, unit_factor, note) values ('abb-db-4spn', 'bestofelectricals', 'abb-4-way-spn-db', 1, 'auto: ABB SHCM4 4 Way SPN Distribution Board (s7)')
  on conflict (product_id, source) do update set competitor_code = excluded.competitor_code, note = excluded.note, updated_at = now();
insert into public.competitor_map (product_id, source, competitor_code, unit_factor, note) values ('abb-db-4spn', 'vashi', 'I-1SYN869006R0001', 1, 'auto: ABB 1SYN869006R0001- 4way SPN Single Door DB with 4+2 module IP30 Ty (s9)')
  on conflict (product_id, source) do update set competitor_code = excluded.competitor_code, note = excluded.note, updated_at = now();
insert into public.competitor_map (product_id, source, competitor_code, unit_factor, note) values ('hav-db-6tpn', 'havells', 'DRDPTHODOW06', 1, 'auto: TPN 6 Way DD DB (s7)')
  on conflict (product_id, source) do update set competitor_code = excluded.competitor_code, note = excluded.note, updated_at = now();
insert into public.competitor_map (product_id, source, competitor_code, unit_factor, note) values ('hav-db-6tpn', 'bestofelectricals', 'havells-6-way-dd-tpn-db', 1, 'auto: Havells 6 Way DD TPN Distribution Board (s7)')
  on conflict (product_id, source) do update set competitor_code = excluded.competitor_code, note = excluded.note, updated_at = now();
insert into public.competitor_map (product_id, source, competitor_code, unit_factor, note) values ('atm-aris-1200-pw', 'atomberg', 'Aris Ceiling Fan', 1, 'auto: Aris Smart Ceiling Fan (s10)')
  on conflict (product_id, source) do update set competitor_code = excluded.competitor_code, note = excluded.note, updated_at = now();
insert into public.competitor_map (product_id, source, competitor_code, unit_factor, note) values ('atm-aris-1200-tkw', 'atomberg', 'Aris Ceiling Fan', 1, 'auto: Aris Smart Ceiling Fan (s10)')
  on conflict (product_id, source) do update set competitor_code = excluded.competitor_code, note = excluded.note, updated_at = now();
insert into public.competitor_map (product_id, source, competitor_code, unit_factor, note) values ('atm-exh-200-wht', 'atomberg', 'efficio exhaust fan', 1, 'auto: Efficio Exhaust Fan (s10)')
  on conflict (product_id, source) do update set competitor_code = excluded.competitor_code, note = excluded.note, updated_at = now();
insert into public.competitor_map (product_id, source, competitor_code, unit_factor, note) values ('atm-exh-150-wht', 'atomberg', 'efficio exhaust fan', 1, 'auto: Efficio Exhaust Fan (s10)')
  on conflict (product_id, source) do update set competitor_code = excluded.competitor_code, note = excluded.note, updated_at = now();

select source, count(*) from public.competitor_map group by source order by source;
