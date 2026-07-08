-- ═══════════════════════════════════════════════════════════════
-- Auto-generated MULTI-SOURCE competitor mappings (scripts/auto-map-brands.mjs).
-- Each product maps to every seller that carries it → the radar picks the
-- lowest (Amazon-style). Complements 0013 (Vashi wires). Idempotent (upsert).
-- 70 mappings across 66 products;
-- 3 products have 2+ sellers; 68 of 134 unmatched.
-- ═══════════════════════════════════════════════════════════════

insert into public.competitor_map (product_id, source, competitor_code, unit_factor, note) values ('abb-db-4spn', 'bestofelectricals', 'abb-4-way-spn-db', 1, 'auto: ABB SHCM4 4 Way SPN Distribution Board (s9)')
  on conflict (product_id, source) do update set competitor_code = excluded.competitor_code, unit_factor = excluded.unit_factor, note = excluded.note, updated_at = now();
insert into public.competitor_map (product_id, source, competitor_code, unit_factor, note) values ('abb-db-4spn', 'vashi', 'I-1SYN869006R0001', 1, 'auto: ABB 1SYN869006R0001- 4way SPN Single Door DB with 4+2 module (s10)')
  on conflict (product_id, source) do update set competitor_code = excluded.competitor_code, unit_factor = excluded.unit_factor, note = excluded.note, updated_at = now();
insert into public.competitor_map (product_id, source, competitor_code, unit_factor, note) values ('abbdb8', 'bestofelectricals', 'abb-8-way-spn-db', 1, 'auto: ABB SHCM8 8 Way SPN Distribution Board (s9)')
  on conflict (product_id, source) do update set competitor_code = excluded.competitor_code, unit_factor = excluded.unit_factor, note = excluded.note, updated_at = now();
insert into public.competitor_map (product_id, source, competitor_code, unit_factor, note) values ('abbdb8', 'vashi', 'I-1SYN869008R0001', 1, 'auto: ABB 1SYN869008R0001- 8way SPN Single Door DB with 8+2 module (s9)')
  on conflict (product_id, source) do update set competitor_code = excluded.competitor_code, unit_factor = excluded.unit_factor, note = excluded.note, updated_at = now();
insert into public.competitor_map (product_id, source, competitor_code, unit_factor, note) values ('atm-aris-1200-pw', 'atomberg', 'Aris Ceiling Fan', 1, 'auto: Aris Smart Ceiling Fan (s10)')
  on conflict (product_id, source) do update set competitor_code = excluded.competitor_code, unit_factor = excluded.unit_factor, note = excluded.note, updated_at = now();
insert into public.competitor_map (product_id, source, competitor_code, unit_factor, note) values ('atm-aris-1200-tkw', 'atomberg', 'Aris Ceiling Fan', 1, 'auto: Aris Smart Ceiling Fan (s10)')
  on conflict (product_id, source) do update set competitor_code = excluded.competitor_code, unit_factor = excluded.unit_factor, note = excluded.note, updated_at = now();
insert into public.competitor_map (product_id, source, competitor_code, unit_factor, note) values ('atm-eff-1200-blk', 'atomberg', 'efficio exhaust fan', 1, 'auto: Efficio Exhaust Fan (s5)')
  on conflict (product_id, source) do update set competitor_code = excluded.competitor_code, unit_factor = excluded.unit_factor, note = excluded.note, updated_at = now();
insert into public.competitor_map (product_id, source, competitor_code, unit_factor, note) values ('atm-eff-1200-wht', 'atomberg', 'efficio exhaust fan', 1, 'auto: Efficio Exhaust Fan (s5)')
  on conflict (product_id, source) do update set competitor_code = excluded.competitor_code, unit_factor = excluded.unit_factor, note = excluded.note, updated_at = now();
insert into public.competitor_map (product_id, source, competitor_code, unit_factor, note) values ('atm-exh-150-wht', 'atomberg', 'efficio exhaust fan', 1, 'auto: Efficio Exhaust Fan (s10)')
  on conflict (product_id, source) do update set competitor_code = excluded.competitor_code, unit_factor = excluded.unit_factor, note = excluded.note, updated_at = now();
insert into public.competitor_map (product_id, source, competitor_code, unit_factor, note) values ('atm-exh-200-wht', 'atomberg', 'efficio exhaust fan', 1, 'auto: Efficio Exhaust Fan (s10)')
  on conflict (product_id, source) do update set competitor_code = excluded.competitor_code, unit_factor = excluded.unit_factor, note = excluded.note, updated_at = now();
insert into public.competitor_map (product_id, source, competitor_code, unit_factor, note) values ('atm-stu-1200-mw', 'atomberg', 'studio plus exhaust fan', 1, 'auto: Studio+ Exhaust Fans  (s5)')
  on conflict (product_id, source) do update set competitor_code = excluded.competitor_code, unit_factor = excluded.unit_factor, note = excluded.note, updated_at = now();
insert into public.competitor_map (product_id, source, competitor_code, unit_factor, note) values ('atm-stu-1200-sg', 'atomberg', 'studio plus exhaust fan', 1, 'auto: Studio+ Exhaust Fans  (s5)')
  on conflict (product_id, source) do update set competitor_code = excluded.competitor_code, unit_factor = excluded.unit_factor, note = excluded.note, updated_at = now();
insert into public.competitor_map (product_id, source, competitor_code, unit_factor, note) values ('fin-fr-10', 'vashi', 'I-1.5FX1CBLKFRLS100', 90, 'auto: Finolex 1.5 Sqmm, 1 Core, Copper Class 5/Flexible, FRLS, Sin (s6)')
  on conflict (product_id, source) do update set competitor_code = excluded.competitor_code, unit_factor = excluded.unit_factor, note = excluded.note, updated_at = now();
insert into public.competitor_map (product_id, source, competitor_code, unit_factor, note) values ('fin-fr-15', 'vashi', 'I-1.5FX1CBLKHW300', 90, 'auto: Finolex 1.5 Sqmm, 1 Core, Copper Class 5/Flexible, FR, FR Wi (s13)')
  on conflict (product_id, source) do update set competitor_code = excluded.competitor_code, unit_factor = excluded.unit_factor, note = excluded.note, updated_at = now();
insert into public.competitor_map (product_id, source, competitor_code, unit_factor, note) values ('fin-fr-25', 'vashi', 'I-2.5FX1CBLKHW300', 90, 'auto: Finolex 2.5 Sqmm, 1 Core, Copper Class 5/Flexible, FR, FR Wi (s13)')
  on conflict (product_id, source) do update set competitor_code = excluded.competitor_code, unit_factor = excluded.unit_factor, note = excluded.note, updated_at = now();
insert into public.competitor_map (product_id, source, competitor_code, unit_factor, note) values ('fin-fr-60', 'vashi', 'I-1.5FX1CBLKFRLS100', 90, 'auto: Finolex 1.5 Sqmm, 1 Core, Copper Class 5/Flexible, FRLS, Sin (s6)')
  on conflict (product_id, source) do update set competitor_code = excluded.competitor_code, unit_factor = excluded.unit_factor, note = excluded.note, updated_at = now();
insert into public.competitor_map (product_id, source, competitor_code, unit_factor, note) values ('finfr4', 'vashi', 'I-4FX1CBLKHW200', 90, 'auto: Finolex 4 Sqmm, 1 Core, Copper Class 5/Flexible, FR, FR Wire (s7)')
  on conflict (product_id, source) do update set competitor_code = excluded.competitor_code, unit_factor = excluded.unit_factor, note = excluded.note, updated_at = now();
insert into public.competitor_map (product_id, source, competitor_code, unit_factor, note) values ('hav-db-6tpn', 'havells', 'DRDPTHODOW06', 1, 'auto: TPN 6 Way DD DB (s10)')
  on conflict (product_id, source) do update set competitor_code = excluded.competitor_code, unit_factor = excluded.unit_factor, note = excluded.note, updated_at = now();
insert into public.competitor_map (product_id, source, competitor_code, unit_factor, note) values ('hav-db-8spn', 'havells', 'DRDPSHODOW08', 1, 'auto: SPN 8 Way DD DB (s10)')
  on conflict (product_id, source) do update set competitor_code = excluded.competitor_code, unit_factor = excluded.unit_factor, note = excluded.note, updated_at = now();
insert into public.competitor_map (product_id, source, competitor_code, unit_factor, note) values ('hav-iso-40', 'bestofelectricals', 'havells-40a-double-pole-isolator', 1, 'auto: Havells 40A Double Pole Isolator Switch (s9)')
  on conflict (product_id, source) do update set competitor_code = excluded.competitor_code, unit_factor = excluded.unit_factor, note = excluded.note, updated_at = now();
insert into public.competitor_map (product_id, source, competitor_code, unit_factor, note) values ('hav-ll-15', 'bestofelectricals', 'havells-15-sqmm-2-core-copper-armoured-control-cable', 1, 'auto: Havells 1.5 sqmm 2 core Copper Armoured Control Cable (s6)')
  on conflict (product_id, source) do update set competitor_code = excluded.competitor_code, unit_factor = excluded.unit_factor, note = excluded.note, updated_at = now();
insert into public.competitor_map (product_id, source, competitor_code, unit_factor, note) values ('hav-ll-25', 'bestofelectricals', 'havells-25-sqmm-2-core-copper-armoured-control-cable', 1, 'auto: Havells 2.5 sqmm 2 core Copper Armoured Control Cable (s6)')
  on conflict (product_id, source) do update set competitor_code = excluded.competitor_code, unit_factor = excluded.unit_factor, note = excluded.note, updated_at = now();
insert into public.competitor_map (product_id, source, competitor_code, unit_factor, note) values ('hav-pnl-15r', 'havells', 'LHEHAAP8NAND010-c', 1, 'auto: Nimbus LED Panel Round (s6)')
  on conflict (product_id, source) do update set competitor_code = excluded.competitor_code, unit_factor = excluded.unit_factor, note = excluded.note, updated_at = now();
insert into public.competitor_map (product_id, source, competitor_code, unit_factor, note) values ('hav-rccb-40', 'bestofelectricals', 'havells-crabtree-40a-sp-c-curve-10ka-mcb', 1, 'auto: Havells Crabtree 40A C-Curve 10kA 1 Pole MCB (s5)')
  on conflict (product_id, source) do update set competitor_code = excluded.competitor_code, unit_factor = excluded.unit_factor, note = excluded.note, updated_at = now();
insert into public.competitor_map (product_id, source, competitor_code, unit_factor, note) values ('hav32', 'havells', 'DCVNCDPA032', 1, 'auto: 32 A DP Mini MCB C Series (s9)')
  on conflict (product_id, source) do update set competitor_code = excluded.competitor_code, unit_factor = excluded.unit_factor, note = excluded.note, updated_at = now();
insert into public.competitor_map (product_id, source, competitor_code, unit_factor, note) values ('hav32', 'bestofelectricals', 'havells-crabtree-32a-sp-c-curve-10ka-mcb', 1, 'auto: Havells 32A C-Curve 10kA 1 Pole MCB (s9)')
  on conflict (product_id, source) do update set competitor_code = excluded.competitor_code, unit_factor = excluded.unit_factor, note = excluded.note, updated_at = now();
insert into public.competitor_map (product_id, source, competitor_code, unit_factor, note) values ('hav32', 'vashi', 'I-32A-MCB-2-TRAY', 1, 'auto: 32 A DP C MCB EURO 2 TRAY PACK HAVELLS (s8)')
  on conflict (product_id, source) do update set competitor_code = excluded.competitor_code, unit_factor = excluded.unit_factor, note = excluded.note, updated_at = now();
insert into public.competitor_map (product_id, source, competitor_code, unit_factor, note) values ('leg-db-12spn', 'vashi', 'I-507642', 1, 'auto: Legrand 507642 - 12 WAY IP54 SPN DB EKINOX3 (s11)')
  on conflict (product_id, source) do update set competitor_code = excluded.competitor_code, unit_factor = excluded.unit_factor, note = excluded.note, updated_at = now();
insert into public.competitor_map (product_id, source, competitor_code, unit_factor, note) values ('phi-led-9x2', 'bestofelectricals', 'philips-9w-ace-saver-led-bulb', 1, 'auto: Philips 9W B-22 Ace Saver LED Bulbs (s5)')
  on conflict (product_id, source) do update set competitor_code = excluded.competitor_code, unit_factor = excluded.unit_factor, note = excluded.note, updated_at = now();
insert into public.competitor_map (product_id, source, competitor_code, unit_factor, note) values ('phi-str-24', 'bestofelectricals', 'philips-webber-581982-24w-l-shaped-diffused-blade-led-magnetic-track-light', 1, 'auto: Philips Webber 581982 24W L-Shaped Diffused Blade Led Magnet (s5)')
  on conflict (product_id, source) do update set competitor_code = excluded.competitor_code, unit_factor = excluded.unit_factor, note = excluded.note, updated_at = now();
insert into public.competitor_map (product_id, source, competitor_code, unit_factor, note) values ('poly-flex-3c15', 'vashi', 'I-1.5PX3CYWY 100', 90, 'auto: Polycab 1.5 Sqmm, 3 Core, Solid Copper Conductor, Xlpe Insul (s13)')
  on conflict (product_id, source) do update set competitor_code = excluded.competitor_code, unit_factor = excluded.unit_factor, note = excluded.note, updated_at = now();
insert into public.competitor_map (product_id, source, competitor_code, unit_factor, note) values ('poly-fr-60', 'vashi', 'I-1.5PX1CBLKFRLS100', 90, 'auto: Polycab 1.5 Sqmm, 1 Core, Flexible Copper Conductor, FRLSH P (s6)')
  on conflict (product_id, source) do update set competitor_code = excluded.competitor_code, unit_factor = excluded.unit_factor, note = excluded.note, updated_at = now();
insert into public.competitor_map (product_id, source, competitor_code, unit_factor, note) values ('poly-frls-10-red', 'vashi', 'I-1PX16CFLX100', 90, 'auto: Polycab 1.0 Sqmm, 16 Core, Copper Class 5/Flexible, PVC Type (s5)')
  on conflict (product_id, source) do update set competitor_code = excluded.competitor_code, unit_factor = excluded.unit_factor, note = excluded.note, updated_at = now();
insert into public.competitor_map (product_id, source, competitor_code, unit_factor, note) values ('poly-frls-100-red', 'vashi', 'I-10PX4CYYSTRFRLS', 90, 'auto: Polycab 10 Sqmm, 4 Core, Stranded Copper Conductor, Xlpe Ins (s7)')
  on conflict (product_id, source) do update set competitor_code = excluded.competitor_code, unit_factor = excluded.unit_factor, note = excluded.note, updated_at = now();
insert into public.competitor_map (product_id, source, competitor_code, unit_factor, note) values ('poly-frls-15-red', 'vashi', 'I-1.5PX2C YY 100', 90, 'auto: Polycab 1.5 Sqmm, 2 Core, Solid Copper Conductor, Xlpe Insul (s5)')
  on conflict (product_id, source) do update set competitor_code = excluded.competitor_code, unit_factor = excluded.unit_factor, note = excluded.note, updated_at = now();
insert into public.competitor_map (product_id, source, competitor_code, unit_factor, note) values ('poly-frls-25-red-180m', 'vashi', 'I-2.5PX3CYY', 90, 'auto: Polycab 2.5 Sqmm, 3 Core, Solid Copper Conductor, Xlpe Insul (s5)')
  on conflict (product_id, source) do update set competitor_code = excluded.competitor_code, unit_factor = excluded.unit_factor, note = excluded.note, updated_at = now();
insert into public.competitor_map (product_id, source, competitor_code, unit_factor, note) values ('poly-frls-25-red-45m', 'vashi', 'I-2.5PX3CYY', 90, 'auto: Polycab 2.5 Sqmm, 3 Core, Solid Copper Conductor, Xlpe Insul (s5)')
  on conflict (product_id, source) do update set competitor_code = excluded.competitor_code, unit_factor = excluded.unit_factor, note = excluded.note, updated_at = now();
insert into public.competitor_map (product_id, source, competitor_code, unit_factor, note) values ('poly-frls-40-red', 'vashi', 'I-4PX6CFLX100', 90, 'auto: Polycab 4.0 Sqmm, 6 Core, Copper Class 5/Flexible, PVC Type  (s5)')
  on conflict (product_id, source) do update set competitor_code = excluded.competitor_code, unit_factor = excluded.unit_factor, note = excluded.note, updated_at = now();
insert into public.competitor_map (product_id, source, competitor_code, unit_factor, note) values ('poly-pvc-25-red', 'vashi', 'I-2.5PX3CYY', 90, 'auto: Polycab 2.5 Sqmm, 3 Core, Solid Copper Conductor, Xlpe Insul (s5)')
  on conflict (product_id, source) do update set competitor_code = excluded.competitor_code, unit_factor = excluded.unit_factor, note = excluded.note, updated_at = now();
insert into public.competitor_map (product_id, source, competitor_code, unit_factor, note) values ('poly25', 'vashi', 'I-2.5PX3CYY', 90, 'auto: Polycab 2.5 Sqmm, 3 Core, Solid Copper Conductor, Xlpe Insul (s5)')
  on conflict (product_id, source) do update set competitor_code = excluded.competitor_code, unit_factor = excluded.unit_factor, note = excluded.note, updated_at = now();
insert into public.competitor_map (product_id, source, competitor_code, unit_factor, note) values ('wip-bat-20', 'bestofelectricals', 'wipro-garnet-slim-20w-led-batten', 1, 'auto: Wipro Garnet Slim 20W LED Batten (s10)')
  on conflict (product_id, source) do update set competitor_code = excluded.competitor_code, unit_factor = excluded.unit_factor, note = excluded.note, updated_at = now();
insert into public.competitor_map (product_id, source, competitor_code, unit_factor, note) values ('wire-havells-frlsh-1p5-red', 'bestofelectricals', 'havells-15-sqmm-2-core-copper-armoured-control-cable', 1, 'auto: Havells 1.5 sqmm 2 core Copper Armoured Control Cable (s6)')
  on conflict (product_id, source) do update set competitor_code = excluded.competitor_code, unit_factor = excluded.unit_factor, note = excluded.note, updated_at = now();
insert into public.competitor_map (product_id, source, competitor_code, unit_factor, note) values ('wire-havells-frlsh-2p5-red', 'bestofelectricals', 'havells-25-sqmm-2-core-copper-armoured-control-cable', 1, 'auto: Havells 2.5 sqmm 2 core Copper Armoured Control Cable (s6)')
  on conflict (product_id, source) do update set competitor_code = excluded.competitor_code, unit_factor = excluded.unit_factor, note = excluded.note, updated_at = now();
insert into public.competitor_map (product_id, source, competitor_code, unit_factor, note) values ('wire-havells-frlsh-4-red', 'bestofelectricals', 'havells-4-sqmm-3-core-copper-armoured-power-cable', 1, 'auto: Havells 4 sqmm 3 core Copper Armoured Power Cable (s6)')
  on conflict (product_id, source) do update set competitor_code = excluded.competitor_code, unit_factor = excluded.unit_factor, note = excluded.note, updated_at = now();
insert into public.competitor_map (product_id, source, competitor_code, unit_factor, note) values ('wire-havells-frlsh-6-red', 'bestofelectricals', 'havells-6-sqmm-3-core-aluminium-armoured-power-cable', 1, 'auto: Havells 6 sqmm 3 core Aluminium Armoured Power Cable (s6)')
  on conflict (product_id, source) do update set competitor_code = excluded.competitor_code, unit_factor = excluded.unit_factor, note = excluded.note, updated_at = now();
insert into public.competitor_map (product_id, source, competitor_code, unit_factor, note) values ('wire-havells-hrfr-1p5-red', 'bestofelectricals', 'havells-15-sqmm-2-core-copper-armoured-control-cable', 1, 'auto: Havells 1.5 sqmm 2 core Copper Armoured Control Cable (s6)')
  on conflict (product_id, source) do update set competitor_code = excluded.competitor_code, unit_factor = excluded.unit_factor, note = excluded.note, updated_at = now();
insert into public.competitor_map (product_id, source, competitor_code, unit_factor, note) values ('wire-havells-hrfr-2p5-red', 'bestofelectricals', 'havells-25-sqmm-2-core-copper-armoured-control-cable', 1, 'auto: Havells 2.5 sqmm 2 core Copper Armoured Control Cable (s6)')
  on conflict (product_id, source) do update set competitor_code = excluded.competitor_code, unit_factor = excluded.unit_factor, note = excluded.note, updated_at = now();
insert into public.competitor_map (product_id, source, competitor_code, unit_factor, note) values ('wire-havells-hrfr-4-red', 'bestofelectricals', 'havells-4-sqmm-3-core-copper-armoured-power-cable', 1, 'auto: Havells 4 sqmm 3 core Copper Armoured Power Cable (s6)')
  on conflict (product_id, source) do update set competitor_code = excluded.competitor_code, unit_factor = excluded.unit_factor, note = excluded.note, updated_at = now();
insert into public.competitor_map (product_id, source, competitor_code, unit_factor, note) values ('wire-havells-hrfr-6-red', 'bestofelectricals', 'havells-6-sqmm-3-core-aluminium-armoured-power-cable', 1, 'auto: Havells 6 sqmm 3 core Aluminium Armoured Power Cable (s6)')
  on conflict (product_id, source) do update set competitor_code = excluded.competitor_code, unit_factor = excluded.unit_factor, note = excluded.note, updated_at = now();
insert into public.competitor_map (product_id, source, competitor_code, unit_factor, note) values ('wire-polycab-fr-0p5-red', 'vashi', 'I-JFTC0.5X5P0.5MMPOLY', 90, 'auto: Polycab 0.5 Sqmm, 5 Pair, Jelly Filled Armoured Telecom Cabl (s6)')
  on conflict (product_id, source) do update set competitor_code = excluded.competitor_code, unit_factor = excluded.unit_factor, note = excluded.note, updated_at = now();
insert into public.competitor_map (product_id, source, competitor_code, unit_factor, note) values ('wire-polycab-fr-0p75-red', 'vashi', 'I-0.75PX1CGRNHW300', 90, 'auto: Polycab 0.75 Sqmm, 1 Core, Copper Class 5/Flexible, FRLF, FR (s13)')
  on conflict (product_id, source) do update set competitor_code = excluded.competitor_code, unit_factor = excluded.unit_factor, note = excluded.note, updated_at = now();
insert into public.competitor_map (product_id, source, competitor_code, unit_factor, note) values ('wire-polycab-fr-1-red', 'vashi', 'I-1PX1CREDFR100', 90, 'auto: Polycab 1 Sqmm, 1 Core, Flexible Copper Conductor, FR Pvc In (s10)')
  on conflict (product_id, source) do update set competitor_code = excluded.competitor_code, unit_factor = excluded.unit_factor, note = excluded.note, updated_at = now();
insert into public.competitor_map (product_id, source, competitor_code, unit_factor, note) values ('wire-polycab-fr-1p5-red', 'vashi', 'I-1.5PX2C YY 100', 90, 'auto: Polycab 1.5 Sqmm, 2 Core, Solid Copper Conductor, Xlpe Insul (s6)')
  on conflict (product_id, source) do update set competitor_code = excluded.competitor_code, unit_factor = excluded.unit_factor, note = excluded.note, updated_at = now();
insert into public.competitor_map (product_id, source, competitor_code, unit_factor, note) values ('wire-polycab-fr-2p5-red', 'vashi', 'I-2.5PX3CYY', 90, 'auto: Polycab 2.5 Sqmm, 3 Core, Solid Copper Conductor, Xlpe Insul (s6)')
  on conflict (product_id, source) do update set competitor_code = excluded.competitor_code, unit_factor = excluded.unit_factor, note = excluded.note, updated_at = now();
insert into public.competitor_map (product_id, source, competitor_code, unit_factor, note) values ('wire-polycab-fr-4-red', 'vashi', 'I-4PX4CYWY 100', 90, 'auto: Polycab 4 Sqmm, 4 Core, Solid Copper Conductor, Xlpe Insulat (s6)')
  on conflict (product_id, source) do update set competitor_code = excluded.competitor_code, unit_factor = excluded.unit_factor, note = excluded.note, updated_at = now();
insert into public.competitor_map (product_id, source, competitor_code, unit_factor, note) values ('wire-polycab-fr-6-red', 'vashi', 'I-6PX4CAYFY', 90, 'auto: Polycab 6 Sqmm, 4 Core, Solid Aluminium Conductor, Xlpe Insu (s6)')
  on conflict (product_id, source) do update set competitor_code = excluded.competitor_code, unit_factor = excluded.unit_factor, note = excluded.note, updated_at = now();
insert into public.competitor_map (product_id, source, competitor_code, unit_factor, note) values ('wire-polycab-frls-0p5-red', 'vashi', 'I-JFTC0.5X5P0.5MMPOLY', 90, 'auto: Polycab 0.5 Sqmm, 5 Pair, Jelly Filled Armoured Telecom Cabl (s6)')
  on conflict (product_id, source) do update set competitor_code = excluded.competitor_code, unit_factor = excluded.unit_factor, note = excluded.note, updated_at = now();
insert into public.competitor_map (product_id, source, competitor_code, unit_factor, note) values ('wire-polycab-frls-0p75-red', 'vashi', 'I-0.75PX1CGRNHW300', 90, 'auto: Polycab 0.75 Sqmm, 1 Core, Copper Class 5/Flexible, FRLF, FR (s13)')
  on conflict (product_id, source) do update set competitor_code = excluded.competitor_code, unit_factor = excluded.unit_factor, note = excluded.note, updated_at = now();
insert into public.competitor_map (product_id, source, competitor_code, unit_factor, note) values ('wire-polycab-frls-1-red', 'vashi', 'I-1PX1CREDFR100', 90, 'auto: Polycab 1 Sqmm, 1 Core, Flexible Copper Conductor, FR Pvc In (s10)')
  on conflict (product_id, source) do update set competitor_code = excluded.competitor_code, unit_factor = excluded.unit_factor, note = excluded.note, updated_at = now();
insert into public.competitor_map (product_id, source, competitor_code, unit_factor, note) values ('wire-polycab-frls-1p5-red', 'vashi', 'I-1.5PX2C YY 100', 90, 'auto: Polycab 1.5 Sqmm, 2 Core, Solid Copper Conductor, Xlpe Insul (s6)')
  on conflict (product_id, source) do update set competitor_code = excluded.competitor_code, unit_factor = excluded.unit_factor, note = excluded.note, updated_at = now();
insert into public.competitor_map (product_id, source, competitor_code, unit_factor, note) values ('wire-polycab-frls-2p5-red', 'vashi', 'I-2.5PX3CYY', 90, 'auto: Polycab 2.5 Sqmm, 3 Core, Solid Copper Conductor, Xlpe Insul (s6)')
  on conflict (product_id, source) do update set competitor_code = excluded.competitor_code, unit_factor = excluded.unit_factor, note = excluded.note, updated_at = now();
insert into public.competitor_map (product_id, source, competitor_code, unit_factor, note) values ('wire-polycab-frls-4-red', 'vashi', 'I-4PX4CYYSTRFRLS', 90, 'auto: Polycab 4 Sqmm, 4 Core, Stranded Copper Conductor, Xlpe Insu (s7)')
  on conflict (product_id, source) do update set competitor_code = excluded.competitor_code, unit_factor = excluded.unit_factor, note = excluded.note, updated_at = now();
insert into public.competitor_map (product_id, source, competitor_code, unit_factor, note) values ('wire-polycab-frls-6-red', 'vashi', 'I-6PX4CYWYSTRFRLS', 90, 'auto: Polycab 6 Sqmm, 4 Core, Stranded Copper Conductor, Xlpe Insu (s7)')
  on conflict (product_id, source) do update set competitor_code = excluded.competitor_code, unit_factor = excluded.unit_factor, note = excluded.note, updated_at = now();
insert into public.competitor_map (product_id, source, competitor_code, unit_factor, note) values ('wire-polycab-frlsh-0p5-red', 'vashi', 'I-JFTC0.5X5P0.5MMPOLY', 90, 'auto: Polycab 0.5 Sqmm, 5 Pair, Jelly Filled Armoured Telecom Cabl (s6)')
  on conflict (product_id, source) do update set competitor_code = excluded.competitor_code, unit_factor = excluded.unit_factor, note = excluded.note, updated_at = now();
insert into public.competitor_map (product_id, source, competitor_code, unit_factor, note) values ('wire-polycab-frlsh-0p75-red', 'vashi', 'I-0.75PX1CGRNHW300', 90, 'auto: Polycab 0.75 Sqmm, 1 Core, Copper Class 5/Flexible, FRLF, FR (s13)')
  on conflict (product_id, source) do update set competitor_code = excluded.competitor_code, unit_factor = excluded.unit_factor, note = excluded.note, updated_at = now();
insert into public.competitor_map (product_id, source, competitor_code, unit_factor, note) values ('wire-polycab-frlsh-1-red', 'vashi', 'I-1PX1CREDFRLS100', 90, 'auto: Polycab 1 Sqmm, 1 Core, Flexible Copper Conductor, FRLSH Pvc (s11)')
  on conflict (product_id, source) do update set competitor_code = excluded.competitor_code, unit_factor = excluded.unit_factor, note = excluded.note, updated_at = now();
insert into public.competitor_map (product_id, source, competitor_code, unit_factor, note) values ('wire-polycab-frlsh-1p5-red', 'vashi', 'I-1.5PX2C YY 100', 90, 'auto: Polycab 1.5 Sqmm, 2 Core, Solid Copper Conductor, Xlpe Insul (s6)')
  on conflict (product_id, source) do update set competitor_code = excluded.competitor_code, unit_factor = excluded.unit_factor, note = excluded.note, updated_at = now();
insert into public.competitor_map (product_id, source, competitor_code, unit_factor, note) values ('wire-polycab-frlsh-2p5-red', 'vashi', 'I-2.5PX3CYY', 90, 'auto: Polycab 2.5 Sqmm, 3 Core, Solid Copper Conductor, Xlpe Insul (s6)')
  on conflict (product_id, source) do update set competitor_code = excluded.competitor_code, unit_factor = excluded.unit_factor, note = excluded.note, updated_at = now();
insert into public.competitor_map (product_id, source, competitor_code, unit_factor, note) values ('wire-polycab-frlsh-4-red', 'vashi', 'I-4PX4CYWY 100', 90, 'auto: Polycab 4 Sqmm, 4 Core, Solid Copper Conductor, Xlpe Insulat (s6)')
  on conflict (product_id, source) do update set competitor_code = excluded.competitor_code, unit_factor = excluded.unit_factor, note = excluded.note, updated_at = now();
insert into public.competitor_map (product_id, source, competitor_code, unit_factor, note) values ('wire-polycab-frlsh-6-red', 'vashi', 'I-6PX4CAYFY', 90, 'auto: Polycab 6 Sqmm, 4 Core, Solid Aluminium Conductor, Xlpe Insu (s6)')
  on conflict (product_id, source) do update set competitor_code = excluded.competitor_code, unit_factor = excluded.unit_factor, note = excluded.note, updated_at = now();

select source, count(*) from public.competitor_map group by source order by source;
