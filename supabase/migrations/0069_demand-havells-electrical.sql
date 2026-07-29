-- ═══════════════════════════════════════════════════════════════
-- 0069: in-demand Havells products from Google Merchant Center's
-- "Products customers are buying" (Power & Electrical Supplies, June 2026).
--
-- 22 products, every one verified on havells.com right now (SKU, live
-- selling price, MRP, image). Priced at Havells − 2%, the standing rule.
-- Sub-Rs300 items follow the 0067 policy: listed + tracked, in_stock=false.
-- Each gets an exact Havells competitor mapping, so the radar re-verifies
-- these prices on the next sync and keeps them 1 rupee under from then on.
-- ═══════════════════════════════════════════════════════════════

insert into public.products
  (id, sku, brand_sku, name, brand, category, spec, mrp, elume_price, unit, image_url, hsn, gst_rate, is_active, in_stock, sort_order)
values
  ('hav-ahlgwxw063','AHLGWXW063','AHLGWXW063','Havells 6 A 3 Pin Plugtop with Indicator','Havells','Electrical Accessories','Per Google demand data · Havells AHLGWXW063 6 A 3 Plug Top',111,64,'pc','https://havells.com/media/catalog/product/cache/74c1057f7991b4edb2bc7bdaa94de933/import/Switches/AHLGWXW063.jpg','8536',0.1800,true,false,0),
  ('hav-dhmncspa032','DHMNCSPA032','DHMNCSPA032','Havells Mini MCB SP — 32 A','Havells','Switchgear','Per Google demand data · Havells DHMNCSPA032 PVC Plastic 32A SP C Mini MCB (White)',183,108,'pc','https://havells.com/media/catalog/product/cache/74c1057f7991b4edb2bc7bdaa94de933/import/Switchgear/DHMNCSPA032.jpg','8536',0.1800,true,false,0),
  ('hav-dhmgbspf016','DHMGBSPF016','DHMGBSPF016','Havells MCB SP B Curve — 16 A','Havells','Switchgear','Per Google demand data · Havells DHMGBSPF016 PVC Plastic 16A MCB SP B Curve (White)',278,165,'pc','https://havells.com/media/catalog/product/cache/74c1057f7991b4edb2bc7bdaa94de933/d/h/dhmgbspf016.jpg','8536',0.1800,true,false,0),
  ('hav-dhmncspa020','DHMNCSPA020','DHMNCSPA020','Havells Mini MCB SP — 20 A','Havells','Switchgear','Per Google demand data · Havells DHMNCSPA020 PVC Plastic 20A SP C Mini MCB (White)',183,108,'pc','https://havells.com/media/catalog/product/cache/74c1057f7991b4edb2bc7bdaa94de933/import/Switchgear/DHMNCSPA020.jpg','8536',0.1800,true,false,0),
  ('hav-dhmgbspf010','DHMGBSPF010','DHMGBSPF010','Havells MCB SP B Curve — 10 A','Havells','Switchgear','Per Google demand data · Havells DHMGBSPF010 PVC Plastic 10A MCB SP B Curve (White)',278,165,'pc','https://havells.com/media/catalog/product/cache/74c1057f7991b4edb2bc7bdaa94de933/d/h/dhmgbspf010.jpg','8536',0.1800,true,false,0),
  ('hav-dhmncspa025','DHMNCSPA025','DHMNCSPA025','Havells Mini MCB SP — 25 A','Havells','Switchgear','Per Google demand data · Havells DHMNCSPA025 PVC Plastic 25A SP C Mini MCB (White)',183,108,'pc','https://havells.com/media/catalog/product/cache/74c1057f7991b4edb2bc7bdaa94de933/import/Switchgear/DHMNCSPA025.jpg','8536',0.1800,true,false,0),
  ('hav-dhdpusn020','DHDPUSN020','DHDPUSN020','Havells Plug & Socket Board SP&N — 20 A','Havells','DB & Panels','Per Google demand data · Havells 20 A MCB Socket & Plug, DHDPUSN020/DHDPUDP020',1805,1062,'pc','https://havells.com/media/catalog/product/cache/74c1057f7991b4edb2bc7bdaa94de933/f/h/fhvvehuwht06_89__3.jpg','8537',0.1800,true,true,0),
  ('hav-dhmncspa010','DHMNCSPA010','DHMNCSPA010','Havells Mini MCB SP — 10 A','Havells','Switchgear','Per Google demand data · Havells DHMNCSPA010 PVC Plastic 10A SP C Mini MCB (White)',183,108,'pc','https://havells.com/media/catalog/product/cache/74c1057f7991b4edb2bc7bdaa94de933/import/Switchgear/DHMNCSPA010.jpg','8536',0.1800,true,false,0),
  ('hav-dhmgbspf025','DHMGBSPF025','DHMGBSPF025','Havells MCB SP B Curve — 25 A','Havells','Switchgear','Per Google demand data · Havells DHMGBSPF025 PVC Plastic 25A MCB SP B Curve (White)',278,165,'pc','https://havells.com/media/catalog/product/cache/74c1057f7991b4edb2bc7bdaa94de933/d/h/dhmgbspf025.jpg','8536',0.1800,true,false,0),
  ('hav-dhdmcsn0251025','DHDMCSN0251025','DHDMCSN0251025','Havells DBOXx MCB Protected socket — 25 A','Havells','DB & Panels','Per Google demand data · DBOXx MCB Protected socket',856,504,'pc','https://havells.com/media/catalog/product/cache/74c1057f7991b4edb2bc7bdaa94de933/f/h/fhvvehuwht06_45_.jpg','8537',0.1800,true,true,0),
  ('hav-dhmgodpx040','DHMGODPX040','DHMGODPX040','Havells MCB Changeover DP — 40 A','Havells','Switchgear','Per Google demand data · MCB Changeover DP',2576,1515,'pc','https://havells.com/media/catalog/product/cache/74c1057f7991b4edb2bc7bdaa94de933/f/h/fhvvehuwht06_58_11__1_1_1.jpg','8536',0.1800,true,true,0),
  ('hav-ahnmuxw062','AHNMUXW062','AHNMUXW062','Havells 6 A 2 Pin Universal Adaptor With Indicator','Havells','Electrical Accessories','Per Google demand data · 6 A 2 Pin Universal Adaptor With Indicator',159,91,'pc','https://havells.com/media/catalog/product/cache/74c1057f7991b4edb2bc7bdaa94de933/import/Switches/AHNMUXW062.jpg','8536',0.1800,true,false,0),
  ('hav-ahlgxxw163','AHLGXXW163','AHLGXXW163','Havells 16 A 3 Pin Plugtop','Havells','Electrical Accessories','Per Google demand data · 16 A 3 Pin Plugtop',129,76,'pc','https://havells.com/media/catalog/product/cache/74c1057f7991b4edb2bc7bdaa94de933/import/Switches/AHLGXXW163.jpg','8536',0.1800,true,false,0),
  ('hav-ahnxoxf06x','AHNXOXF06X','AHNXOXF06X','Havells Wheel Star 5X 5+1 Surge & Spikeguard (1.5 m) 6 A','Havells','Electrical Accessories','Per Google demand data · Wheel Star 5X 5+1 Surge & Spikeguard 6 A',880,519,'pc','https://havells.com/media/catalog/product/cache/74c1057f7991b4edb2bc7bdaa94de933/a/h/ahnxoxf06x_1.jpg','8536',0.1800,true,true,0),
  ('hav-dhmybspm010','DHMYBSPM010','DHMYBSPM010','Havells X7 MCB SP — 10 A','Havells','Switchgear','Per Google demand data · X7 Mcb Sp',229,135,'pc','https://havells.com/media/catalog/product/cache/74c1057f7991b4edb2bc7bdaa94de933/x/7/x7_mcb_sp_base_1.jpg','8536',0.1800,true,false,0),
  ('hav-dhdsnvdrz04063','DHDSNVDRZ04063','DHDSNVDRZ04063','Havells Phase Selector Vertical DB — 63 A','Havells','DB & Panels','Per Google demand data · Phase Selector Vertical DB',16000,9408,'pc','https://havells.com/media/catalog/product/cache/74c1057f7991b4edb2bc7bdaa94de933/f/h/fhvvehuwht06_85__7.jpg','8537',0.1800,true,true,0),
  ('hav-dhted30016','DHTED30016','DHTED30016','Havells 24 Hours Analog Time switch — 16 A','Havells','Switchgear','Per Google demand data · 24 Hours Analog Time switch',3547,2086,'pc','https://havells.com/media/catalog/product/cache/74c1057f7991b4edb2bc7bdaa94de933/f/h/fhvvehuwht06_58_6_5_.jpg','8536',0.1800,true,true,0),
  ('hav-ahlhgxw060','AHLHGXW060','AHLHGXW060','Havells Fancy Jumbo Batten Holder Metal Ring — 60 A','Havells','Electrical Accessories','Per Google demand data · Fancy Batten Holder Metal Ring',100,57,'pc','https://havells.com/media/catalog/product/cache/74c1057f7991b4edb2bc7bdaa94de933/import/Switches/AHLHGXW060.jpg','8536',0.1800,true,false,0),
  ('hav-dhducdp0253025','DHDUCDP0253025','DHDUCDP0253025','Havells DBOXx MCB Protected Power Unit — 25 A','Havells','DB & Panels','Per Google demand data · DBOXx MCB Protected Power Unit',1831,1077,'pc','https://havells.com/media/catalog/product/cache/74c1057f7991b4edb2bc7bdaa94de933/d/h/dhducdp0253025.jpg','8537',0.1800,true,true,0),
  ('hav-acvsxiw161','ACVSXIW161','ACVSXIW161','Havells Verona 16 A 1 Way Switch with Indicator White','Havells','Modular','Per Google demand data · Verona 16 A 1 Way Switch with Indicator White',329,214,'pc','https://havells.com/media/catalog/product/cache/74c1057f7991b4edb2bc7bdaa94de933/a/c/acvsxiw161_base.jpg','8536',0.1800,true,false,0),
  ('hav-dhbmacdp4030032','DHBMACDP4030032','DHBMACDP4030032','Havells RCBO ‘A’ Type SPN & 2M — 32 A','Havells','Switchgear','Per Google demand data · RCBO ''A'' Type SPN 2M',6358,3115,'pc','https://havells.com/media/catalog/product/cache/74c1057f7991b4edb2bc7bdaa94de933/import/Switchgear/DHBMACDP4030032.jpg','8536',0.1800,true,true,0),
  ('hav-dhmzctpf063','DHMZCTPF063','DHMZCTPF063','Havells MCB TP C CURVE — 63 A','Havells','Switchgear','Per Google demand data · MCB TP C Curve',2497,1224,'pc','https://havells.com/media/catalog/product/cache/74c1057f7991b4edb2bc7bdaa94de933/import/Switchgear/DHMZCTPF063_1.jpg','8536',0.1800,true,true,0)
on conflict (id) do update set
  mrp = excluded.mrp, elume_price = excluded.elume_price, image_url = excluded.image_url,
  hsn = excluded.hsn, gst_rate = excluded.gst_rate, in_stock = excluded.in_stock;

insert into public.competitor_map (product_id, source, competitor_code, unit_factor, approval, match_method)
values
  ('hav-ahlgwxw063','havells','AHLGWXW063',1,'approved','brand-sku'),
  ('hav-dhmncspa032','havells','DHMNCSPA032',1,'approved','brand-sku'),
  ('hav-dhmgbspf016','havells','DHMGBSPF016',1,'approved','brand-sku'),
  ('hav-dhmncspa020','havells','DHMNCSPA020',1,'approved','brand-sku'),
  ('hav-dhmgbspf010','havells','DHMGBSPF010',1,'approved','brand-sku'),
  ('hav-dhmncspa025','havells','DHMNCSPA025',1,'approved','brand-sku'),
  ('hav-dhdpusn020','havells','DHDPUSN020',1,'approved','brand-sku'),
  ('hav-dhmncspa010','havells','DHMNCSPA010',1,'approved','brand-sku'),
  ('hav-dhmgbspf025','havells','DHMGBSPF025',1,'approved','brand-sku'),
  ('hav-dhdmcsn0251025','havells','DHDMCSN0251025',1,'approved','brand-sku'),
  ('hav-dhmgodpx040','havells','DHMGODPX040-c',1,'approved','brand-sku'),
  ('hav-ahnmuxw062','havells','AHNMUXW062',1,'approved','brand-sku'),
  ('hav-ahlgxxw163','havells','AHLGXXW163',1,'approved','brand-sku'),
  ('hav-ahnxoxf06x','havells','AHNXOXF06X',1,'approved','brand-sku'),
  ('hav-dhmybspm010','havells','DHMYBSPM010',1,'approved','brand-sku'),
  ('hav-dhdsnvdrz04063','havells','DHDSNVDRZ04063',1,'approved','brand-sku'),
  ('hav-dhted30016','havells','DHTED30016',1,'approved','brand-sku'),
  ('hav-ahlhgxw060','havells','AHLHGXW060',1,'approved','brand-sku'),
  ('hav-dhducdp0253025','havells','DHDUCDP0253025',1,'approved','brand-sku'),
  ('hav-acvsxiw161','havells','ACVSXIW161',1,'approved','brand-sku'),
  ('hav-dhbmacdp4030032','havells','DHBMACDP4030032',1,'approved','brand-sku'),
  ('hav-dhmzctpf063','havells','DHMZCTPF063-c',1,'approved','brand-sku')
on conflict (product_id, source) do update set competitor_code = excluded.competitor_code, updated_at = now();

select count(*) filter (where in_stock) as orderable,
       count(*) filter (where not in_stock) as listed_oos
from public.products where id in ('hav-ahlgwxw063','hav-dhmncspa032','hav-dhmgbspf016','hav-dhmncspa020','hav-dhmgbspf010','hav-dhmncspa025','hav-dhdpusn020','hav-dhmncspa010','hav-dhmgbspf025','hav-dhdmcsn0251025','hav-dhmgodpx040','hav-ahnmuxw062','hav-ahlgxxw163','hav-ahnxoxf06x','hav-dhmybspm010','hav-dhdsnvdrz04063','hav-dhted30016','hav-ahlhgxw060','hav-dhducdp0253025','hav-acvsxiw161','hav-dhbmacdp4030032','hav-dhmzctpf063');
