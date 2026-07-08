-- ═══════════════════════════════════════════════════════════════
-- Auto-generated brand-source competitor mappings (scripts/auto-map-brands.mjs).
-- Complements 0013 (Vashi). Review, then run. Idempotent (upsert).
-- 19 mapped, 93 unmatched of 131 products.
-- ═══════════════════════════════════════════════════════════════

insert into public.competitor_map (product_id, source, competitor_code, unit_factor, note) values ('leg-mcb-16', 'bestofelectricals', 'legrand-lexic-16a-single-pole-mcb-c-curve-10ka', 1, 'auto: Legrand DX3 408592 16A C-Curve 10kA 1 Pole MCB (score 5)')
  on conflict (product_id, source) do update set competitor_code = excluded.competitor_code, note = excluded.note, updated_at = now();
insert into public.competitor_map (product_id, source, competitor_code, unit_factor, note) values ('abb-mcb-10', 'bestofelectricals', 'abb-10-a-sp-mcb-c-curve-10ka-mcb', 1, 'auto: ABB 10A C-Curve 10kA 1 Pole MCB (score 5)')
  on conflict (product_id, source) do update set competitor_code = excluded.competitor_code, note = excluded.note, updated_at = now();
insert into public.competitor_map (product_id, source, competitor_code, unit_factor, note) values ('leg-rccb-63', 'bestofelectricals', 'legrand-dx3-63a-30ma-double-pole-rccb', 1, 'auto: Legrand DX3 411853 63A 30mA 2 Pole RCCB (score 6)')
  on conflict (product_id, source) do update set competitor_code = excluded.competitor_code, note = excluded.note, updated_at = now();
insert into public.competitor_map (product_id, source, competitor_code, unit_factor, note) values ('anc-roma-2w6', 'bestofelectricals', 'anchor-penta-6a-2way-switch-14112', 1, 'auto: Anchor Penta 6A Two Way Switch (score 8)')
  on conflict (product_id, source) do update set competitor_code = excluded.competitor_code, note = excluded.note, updated_at = now();
insert into public.competitor_map (product_id, source, competitor_code, unit_factor, note) values ('atm-ren-1200', 'atomberg', 'Renesa Ceiling Fan', 1, 'auto: Renesa Ceiling Fan (score 10)')
  on conflict (product_id, source) do update set competitor_code = excluded.competitor_code, note = excluded.note, updated_at = now();
insert into public.competitor_map (product_id, source, competitor_code, unit_factor, note) values ('atm-ren-1200-blk', 'atomberg', 'Renesa Ceiling Fan', 1, 'auto: Renesa Ceiling Fan (score 10)')
  on conflict (product_id, source) do update set competitor_code = excluded.competitor_code, note = excluded.note, updated_at = now();
insert into public.competitor_map (product_id, source, competitor_code, unit_factor, note) values ('atm-ren-1200-brn', 'atomberg', 'Renesa Ceiling Fan', 1, 'auto: Renesa Ceiling Fan (score 10)')
  on conflict (product_id, source) do update set competitor_code = excluded.competitor_code, note = excluded.note, updated_at = now();
insert into public.competitor_map (product_id, source, competitor_code, unit_factor, note) values ('atm-ren-1200-ivb', 'atomberg', 'Renesa Ceiling Fan', 1, 'auto: Renesa Ceiling Fan (score 10)')
  on conflict (product_id, source) do update set competitor_code = excluded.competitor_code, note = excluded.note, updated_at = now();
insert into public.competitor_map (product_id, source, competitor_code, unit_factor, note) values ('atm-ren-1400-wht', 'atomberg', 'Renesa Ceiling Fan', 1, 'auto: Renesa Ceiling Fan (score 10)')
  on conflict (product_id, source) do update set competitor_code = excluded.competitor_code, note = excluded.note, updated_at = now();
insert into public.competitor_map (product_id, source, competitor_code, unit_factor, note) values ('atm-ren-1400-brn', 'atomberg', 'Renesa Ceiling Fan', 1, 'auto: Renesa Ceiling Fan (score 10)')
  on conflict (product_id, source) do update set competitor_code = excluded.competitor_code, note = excluded.note, updated_at = now();
insert into public.competitor_map (product_id, source, competitor_code, unit_factor, note) values ('atm-renp-1200-pw', 'atomberg', 'Renesa + Ceiling Fan', 1, 'auto: Renesa + Ceiling Fan (score 10)')
  on conflict (product_id, source) do update set competitor_code = excluded.competitor_code, note = excluded.note, updated_at = now();
insert into public.competitor_map (product_id, source, competitor_code, unit_factor, note) values ('atm-renp-1200-gld', 'atomberg', 'Renesa + Ceiling Fan', 1, 'auto: Renesa + Ceiling Fan (score 10)')
  on conflict (product_id, source) do update set competitor_code = excluded.competitor_code, note = excluded.note, updated_at = now();
insert into public.competitor_map (product_id, source, competitor_code, unit_factor, note) values ('atm-renp-1400-brn', 'atomberg', 'Renesa + Ceiling Fan', 1, 'auto: Renesa + Ceiling Fan (score 10)')
  on conflict (product_id, source) do update set competitor_code = excluded.competitor_code, note = excluded.note, updated_at = now();
insert into public.competitor_map (product_id, source, competitor_code, unit_factor, note) values ('atm-aris-1200-pw', 'atomberg', 'Aris Ceiling Fan', 1, 'auto: Aris Smart Ceiling Fan (score 10)')
  on conflict (product_id, source) do update set competitor_code = excluded.competitor_code, note = excluded.note, updated_at = now();
insert into public.competitor_map (product_id, source, competitor_code, unit_factor, note) values ('atm-aris-1200-tkw', 'atomberg', 'Aris Ceiling Fan', 1, 'auto: Aris Smart Ceiling Fan (score 10)')
  on conflict (product_id, source) do update set competitor_code = excluded.competitor_code, note = excluded.note, updated_at = now();
insert into public.competitor_map (product_id, source, competitor_code, unit_factor, note) values ('atm-stu-1200-mw', 'atomberg', 'Studio + Ceiling Fan', 1, 'auto: Studio + Ceiling Fan (score 10)')
  on conflict (product_id, source) do update set competitor_code = excluded.competitor_code, note = excluded.note, updated_at = now();
insert into public.competitor_map (product_id, source, competitor_code, unit_factor, note) values ('atm-stu-1200-sg', 'atomberg', 'Studio + Ceiling Fan', 1, 'auto: Studio + Ceiling Fan (score 10)')
  on conflict (product_id, source) do update set competitor_code = excluded.competitor_code, note = excluded.note, updated_at = now();
insert into public.competitor_map (product_id, source, competitor_code, unit_factor, note) values ('atm-exh-200-wht', 'atomberg', 'efficio exhaust fan', 1, 'auto: Efficio Exhaust Fan (score 10)')
  on conflict (product_id, source) do update set competitor_code = excluded.competitor_code, note = excluded.note, updated_at = now();
insert into public.competitor_map (product_id, source, competitor_code, unit_factor, note) values ('atm-exh-150-wht', 'atomberg', 'efficio exhaust fan', 1, 'auto: Efficio Exhaust Fan (score 10)')
  on conflict (product_id, source) do update set competitor_code = excluded.competitor_code, note = excluded.note, updated_at = now();

select source, count(*) from public.competitor_map group by source order by source;
