-- ═══════════════════════════════════════════════════════════════
-- 0071: in-demand Legrand products + the 'legrand' competitor source.
--
-- 32 products from Google Merchant Center's demand report, every one
-- verified on shop.legrand.co.in (SKU, live selling price, MRP, image) via
-- the full-catalogue crawl (1,389 pages, 1,376 SKUs indexed). Priced at
-- Legrand-store − 2%, same rule as Havells. Sub-Rs300 items are listed
-- out-of-stock per the 0067 policy.
--
-- competitor_code is "slug#SKU": the adapter fetches the page by slug and
-- verifies the on-page SKU before trusting the price, so a reused slug can
-- never feed a wrong number. Prices auto-apply on sync (Havells-style rules).
-- ═══════════════════════════════════════════════════════════════

insert into public.competitor_sources (id, name, site_url, enabled, needs_login, sort_order) values
  ('legrand', 'Legrand', 'https://shop.legrand.co.in', true, false, 8)
on conflict (id) do update set enabled = true, site_url = excluded.site_url;

insert into public.products
  (id, sku, brand_sku, name, brand, category, spec, mrp, elume_price, unit, image_url, hsn, gst_rate, is_active, in_stock, sort_order)
values
  ('leg-677217','677217','677217','Legrand Lyncus 32A-Switch-DP-with Indicator-2 Module-White','Legrand','Modular','Per Google demand data · Legrand Lyncus 677217 White 32A DP Switch',690,376,'pc','https://shop.legrand.co.in/media/catalog/product/l/g/lg-677217-web-r.jpg','8536',0.1800,true,true,0),
  ('leg-675974','675974','675974','Legrand Mylinc 16A-Modular MCB-SP-1 Module-White','Legrand','Switchgear','Per Google demand data · Legrand 675974 - Modular Sp Mcb 16 A 1 M',562,245,'pc','https://shop.legrand.co.in/media/catalog/product/l/g/lg-675974-web-r_lu23evdkvertp4t3.jpg','8536',0.1800,true,false,0),
  ('leg-675555','675555','675555','Legrand Mylinc 6/16A-Socket-3 Pin-ISI Combine-2 Module-White','Legrand','Modular','Per Google demand data · Legrand Mylinc Polycarbonate 16A 3 Pin Multi Socket 675555 (White)',476,207,'pc','https://shop.legrand.co.in/media/catalog/product/l/g/lg-675555-web-r_ckezzhantxmdsqve.jpg','8536',0.1800,true,false,0),
  ('leg-408636','408636','408636','Legrand DX3 DP C32A AC MCB','Legrand','Switchgear','Per Google demand data · Legrand DX 3 32-Amp 2-Pole C Curve MCB 408636 (White)',1471,808,'pc','https://shop.legrand.co.in/media/catalog/product/l/g/lg-408636-web-r_lrqxt659axltqj19.jpg','8536',0.1800,true,true,0),
  ('leg-411369','411369','411369','Legrand DX3 RCBO FP 63A 30MA','Legrand','Switchgear','Per Google demand data · DX3 AC RCBO 4 pole 415 V, AC Type 30mA 63 A - Legrand - 411369',9368,5653,'pc','https://shop.legrand.co.in/media/catalog/product/l/g/lg-411369-web-r_3fpe3b4v39xsllsh.jpg','8536',0.1800,true,true,0),
  ('leg-411877','411877','411877','Legrand DX3 FP 40A,30MA RCCB','Legrand','Switchgear','Per Google demand data · DX3 RCCBs (RCCB) 4 pole 415 V AMP 30 mA 40 A- Legrand - 411877',6613,3751,'pc','https://shop.legrand.co.in/media/catalog/product/l/g/lg-411877-web-r_swkekbnhbdiyk0ri.jpg','8536',0.1800,true,true,0),
  ('leg-679217','679217','679217','Legrand Myrius NextGen Myrius 32A Switch DP with Indicator - 2M - Classic White','Legrand','Modular','Per Google demand data · Legrand Myrius Nextgen 679217 White 32A DP Switch',1284,676,'pc','https://shop.legrand.co.in/media/catalog/product/l/g/lg-679217-web-r.jpg','8536',0.1800,true,true,0),
  ('leg-411325','411325','411325','Legrand DX3 RCBO DP 25A 30MA','Legrand','Switchgear','Per Google demand data · Legrand 411325 - 25A DP 30mA 10KA C~ AC:240/415V DX3 RCBO',5812,3506,'pc','https://shop.legrand.co.in/media/catalog/product/l/g/lg-411325-web-r_ts8qjf5auumnxths.jpg','8536',0.1800,true,true,0),
  ('leg-408635','408635','408635','Legrand DX3 DP C25A AC MCB','Legrand','Switchgear','Per Google demand data · DX3 AC MCB 2 pole 415 V AMP 25 A - Legrand - 408635',1471,808,'pc','https://shop.legrand.co.in/media/catalog/product/l/g/lg-408635-web-r_zwhpcolv6neg4irf.jpg','8536',0.1800,true,true,0),
  ('leg-408592','408592','408592','Legrand DX3 SP C16A AC MCB','Legrand','Switchgear','Per Google demand data · DX3 AC MCB 1 pole 240/410 V AMP 16 A - Legrand - 408592',450,246,'pc','https://shop.legrand.co.in/media/catalog/product/l/g/lg-408592-web-r_ydd5ujotchgspeea.jpg','8536',0.1800,true,false,0),
  ('leg-411322','411322','411322','Legrand DX3 RCBO DP 6A 30MA','Legrand','Switchgear','Per Google demand data · DX3 AC RCBO 2 pole 240 V AC Type 30mA 6 A - Legrand - 411322',5812,3506,'pc','https://shop.legrand.co.in/media/catalog/product/l/g/lg-411322-web-r_si3yl6ixo2o5k2of.jpg','8536',0.1800,true,true,0),
  ('leg-411327','411327','411327','Legrand DX3 RCBO DP 40A 30MA','Legrand','Switchgear','Per Google demand data · DX3 AC RCBO 2 pole 240 V AC Type 30mA 40 A - Legrand - 411327',6983,4213,'pc','https://shop.legrand.co.in/media/catalog/product/l/g/lg-411327-web-r_esw4zuzazqwtbqat.jpg','8536',0.1800,true,true,0),
  ('leg-675511','675511','675511','Legrand Mylinc 16A-Switch-SP-1 Way-1 Module-White','Legrand','Modular','Per Google demand data · Legrand LEGRAND Polycarbonate Mylinc 16A 1-Way Switch 675511 (White), 1 Way, 1_W',256,111,'pc','https://shop.legrand.co.in/media/catalog/product/l/g/lg-675511-web-r_69rsprijmm9y38o9.jpg','8536',0.1800,true,false,0),
  ('leg-411878','411878','411878','Legrand DX3 FP 63A,30MA RCCB','Legrand','Switchgear','Per Google demand data · Legrand 411878 - 63A FP 30mA AC:415V DX3 RCCBs',7357,4174,'pc','https://shop.legrand.co.in/media/catalog/product/l/g/lg-411878-web-r_ipxrjlco7g7mnbag.jpg','8536',0.1800,true,true,0),
  ('leg-411852','411852','411852','Legrand DX3 DP 40A,30MA RCCB','Legrand','Switchgear','Per Google demand data · Legrand 411852 - 40A DP 30mA AC:240V DX3 RCCBs',5301,3007,'pc','https://shop.legrand.co.in/media/catalog/product/l/g/lg-411852-web-r_i7lxpqhphhsxybm5.jpg','8536',0.1800,true,true,0),
  ('leg-411851','411851','411851','Legrand DX3 DP 25A,30MA RCCB','Legrand','Switchgear','Per Google demand data · DX3 RCCBs (RCCB) 2 pole 240 V AMP 30 mA 25 A- Legrand - 411851',4565,2589,'pc','https://shop.legrand.co.in/media/catalog/product/l/g/lg-411851-web-r_ra3cwjmu0glzh2ms.jpg','8536',0.1800,true,true,0),
  ('leg-411336','411336','411336','Legrand DX3 RCBO DP 16A 300MA','Legrand','Switchgear','Per Google demand data · DX3 AC RCBO 2 pole 240 V AC Type 300mA 16 A - Legrand - 411336',7213,4351,'pc','https://shop.legrand.co.in/media/catalog/product/l/g/lg-411336-web-r_yuhde9of3rlrrkjg.jpg','8536',0.1800,true,true,0),
  ('leg-573471','573471','573471','Legrand Arteor 6/16A-Socket Shuttered-3 Pin-Indian-2 Module-White','Legrand','Modular','Per Google demand data · Arteor Legrand 16A 3 Pin Multi Socket 2M AR 573471',722,380,'pc','https://shop.legrand.co.in/media/catalog/product/5/7/573471-legrand-1000_wr0184xy5xekhxer.jpg','8536',0.1800,true,true,0),
  ('leg-411374','411374','411374','Legrand DX3 RCBO FP 63A 100MA','Legrand','Switchgear','Per Google demand data · Legrand 411374 - 63A FP 100mA 10KA C~ AC:240/415V DX3 RCBO',10013,6043,'pc','https://shop.legrand.co.in/media/catalog/product/l/g/lg-411374-web-r_ek4egxgz3xajvdvd.jpg','8536',0.1800,true,true,0),
  ('leg-411862','411862','411862','Legrand DX3 DP 40,300MA RCCB','Legrand','Switchgear','Per Google demand data · DX3 RCCBs (RCCB) 2 pole 240 V AMP 300 mA 40 A- Legrand - 411862',6099,3461,'pc','https://shop.legrand.co.in/media/catalog/product/l/g/lg-411862-web-r_6oaswkn1vzkhwe1o.jpg','8536',0.1800,true,true,0),
  ('leg-411326','411326','411326','Legrand DX3 RCBO DP 32A 30MA','Legrand','Switchgear','Per Google demand data · DX3 AC RCBO 2 pole 240 V AC Type 30mA 32 A - Legrand - 411326',5812,3507,'pc','https://shop.legrand.co.in/media/catalog/product/l/g/lg-411326-web-r_vxrq82m9azw1bv1x.jpg','8536',0.1800,true,true,0),
  ('leg-411883','411883','411883','Legrand DX3 FP 63A,100MA RCCB','Legrand','Switchgear','Per Google demand data · Legrand DX³ 4 Pole 63 A Residual Current Circuit Breaker 415V 4118 83',8094,4592,'pc','https://shop.legrand.co.in/media/catalog/product/l/g/lg-411883-web-r_5mwdklpevc0uhalb.jpg','8536',0.1800,true,true,0),
  ('leg-675503','675503','675503','Legrand Mylinc 6A-Switch-SP-1 Way-with Indicator-1 Module-White','Legrand','Modular','Per Google demand data · Legrand Mylinc 6A 1-Way Polycarbonate Switch 675501 (White) 1 Way Switch, 1_way',254,111,'pc','https://shop.legrand.co.in/media/catalog/product/l/g/lg-675503-web-r_m4jponyjbhtohr0s.jpg','8536',0.1800,true,false,0),
  ('leg-679230','679230','679230','Legrand Myrius NextGen 6/16A-Socket-2 Module-Classic White','Legrand','Modular','Per Google demand data · Legrand Myrius NextGen 2M Multistandard Socket (White)',592,313,'pc','https://shop.legrand.co.in/media/catalog/product/l/g/lg-679230-web-r.jpg','8536',0.1800,true,true,0),
  ('leg-679572','679572','679572','Legrand Myrius NextGen Cover Plate with Support Frame-12 Module-Pearl Champagne','Legrand','Modular','Per Google demand data · Legrand Myrius NextGen Plate with Frame Pearl Champagne / 12 Module',1728,910,'pc','https://shop.legrand.co.in/media/catalog/product/l/g/lg-679572-web-r_2.jpg','8538',0.1800,true,true,0),
  ('leg-573401','573401','573401','Legrand Arteor 6A-Switch-SP-1 Way-with Indicator-1 Module-White','Legrand','Modular','Per Google demand data · Legrand Arteor Indicator White Switch(16A)',432,229,'pc','https://shop.legrand.co.in/media/catalog/product/l/g/lg-573401-web-r.jpg','8536',0.1800,true,false,0),
  ('leg-408737','408737','408737','Legrand DX3 DP D4A AC MCB','Legrand','Switchgear','Per Google demand data · Legrand DX3 DP D4A AC MCB',2017,1105,'pc','https://shop.legrand.co.in/media/catalog/product/l/g/lg-408737-web-r_eeryrp9mishol7af.jpg','8536',0.1800,true,true,0),
  ('leg-675966','675966','675966','Legrand Mylinc Information Socket-RJ45-Cat 5E-with Shutter-1 Module-White','Legrand','Modular','Per Google demand data · Legrand Plastic Mylinc RJ45 Socket (White)',562,293,'pc','https://shop.legrand.co.in/media/catalog/product/l/g/lg-675966-web-r_eenbbisqasy7cvih.jpg','8536',0.1800,true,false,0),
  ('leg-679288','679288','679288','Legrand Myrius NextGen USB Charger-1500mA-Type A-1 Module-Classic White','Legrand','Modular','Per Google demand data · Legrand Myrius Modular Type-A & Type-C USB Charger Socket',2056,1081,'pc','https://shop.legrand.co.in/media/catalog/product/l/g/lg-679288-web-r.jpg','8536',0.1800,true,true,0),
  ('leg-679466','679466','679466','Legrand Myrius NextGen Information Socket-RJ45-Cat 6-UTP-Tooless with Shutter-2 Module-Charcoal Grey','Legrand','Modular','Per Google demand data · Legrand Myrius NextGen 2M Multistandard Socket (Charcoal Grey)',1069,597,'pc','https://shop.legrand.co.in/media/catalog/product/l/g/lg-679466-web-r_1.jpg','8536',0.1800,true,true,0),
  ('leg-679211','679211','679211','Legrand Myrius NextGen Myrius 16A Switch 1 Way with Indicator - 1M - Classic White','Legrand','Modular','Per Google demand data · Legrand Myrius Indicator Plastic White Switch (16A)',468,246,'pc','https://shop.legrand.co.in/media/catalog/product/l/g/lg-679211-web-r.jpg','8536',0.1800,true,false,0),
  ('leg-679203','679203','679203','Legrand Myrius NextGen Myrius 6A Switch 1 Way with \u201cLight\u201d Marking - 1M - Classic White','Legrand','Modular','Per Google demand data · Legrand Myrius 1 Way 16 A Modular Switch',230,122,'pc','https://shop.legrand.co.in/media/catalog/product/l/g/lg-679203-web-r.jpg','8536',0.1800,true,false,0)
on conflict (id) do update set
  mrp = excluded.mrp, elume_price = excluded.elume_price, image_url = excluded.image_url,
  hsn = excluded.hsn, gst_rate = excluded.gst_rate, in_stock = excluded.in_stock;

insert into public.competitor_map (product_id, source, competitor_code, unit_factor, approval, match_method)
values
  ('leg-677217','legrand','catalog/product/view/id/4104/s/legrand-lyncus-32a-dp-switch-2-module-indicator-white-677217#677217',1,'approved','brand-sku'),
  ('leg-675974','legrand','mylinc-16a-modular-mcb-sp-1-module-white#675974',1,'approved','brand-sku'),
  ('leg-675555','legrand','mylinc-6-16a-socket-3-pin-isi-combine-2-module-white#675555',1,'approved','brand-sku'),
  ('leg-408636','legrand','dp-c32a-ac-mcb#408636',1,'approved','brand-sku'),
  ('leg-411369','legrand','rcbo-fp-63a-30ma#411369',1,'approved','brand-sku'),
  ('leg-411877','legrand','fp-40a-30ma-rccb#411877',1,'approved','brand-sku'),
  ('leg-679217','legrand','catalog/product/view/id/4719/s/legrand-myrius-nextgen-32a-dp-switch-2m-ind-white#679217',1,'approved','brand-sku'),
  ('leg-411325','legrand','rcbo-dp-25a-30ma#411325',1,'approved','brand-sku'),
  ('leg-408635','legrand','dp-c25a-ac-mcb#408635',1,'approved','brand-sku'),
  ('leg-408592','legrand','sp-c16a-ac-mcb#408592',1,'approved','brand-sku'),
  ('leg-411322','legrand','rcbo-dp-6a-30ma#411322',1,'approved','brand-sku'),
  ('leg-411327','legrand','rcbo-dp-40a-30ma#411327',1,'approved','brand-sku'),
  ('leg-675511','legrand','mylinc-16a-switch-sp-1-way-1-module-white#675511',1,'approved','brand-sku'),
  ('leg-411878','legrand','fp-63a-30ma-rccb#411878',1,'approved','brand-sku'),
  ('leg-411852','legrand','dp-40a-30ma-rccb#411852',1,'approved','brand-sku'),
  ('leg-411851','legrand','dp-25a-30ma-rccb#411851',1,'approved','brand-sku'),
  ('leg-411336','legrand','rcbo-dp-16a-300ma#411336',1,'approved','brand-sku'),
  ('leg-573471','legrand','catalog/product/view/id/3231/s/legrand-arteor-6-16a-3pin-shutter-skt-2m#573471',1,'approved','brand-sku'),
  ('leg-411374','legrand','rcbo-fp-63a-100ma#411374',1,'approved','brand-sku'),
  ('leg-411862','legrand','dp-40-300ma-rccb#411862',1,'approved','brand-sku'),
  ('leg-411326','legrand','rcbo-dp-32a-30ma#411326',1,'approved','brand-sku'),
  ('leg-411883','legrand','fp-63a-100ma-rccb#411883',1,'approved','brand-sku'),
  ('leg-675503','legrand','mylinc-6a-switch-sp-1-way-with-indicator-1-module-white#675503',1,'approved','brand-sku'),
  ('leg-679230','legrand','catalog/product/view/id/4758/s/legrand-myrius-nextgen-6-16a-socket-2m-white#679230',1,'approved','brand-sku'),
  ('leg-679572','legrand','catalog/product/view/id/5376/s/legrand-myrius-nextgen-plate-frame-12m-pearl-champagne#679572',1,'approved','brand-sku'),
  ('leg-573401','legrand','catalog/product/view/id/3141/s/legrand-arteor-6ax-switch-ind-sp-1w1m#573401',1,'approved','brand-sku'),
  ('leg-408737','legrand','dp-d4a-ac-mcb#408737',1,'approved','brand-sku'),
  ('leg-675966','legrand','mylinc-information-socket-rj45-cat-5e-with-shutter-1-module-white#675966',1,'approved','brand-sku'),
  ('leg-679288','legrand','catalog/product/view/id/4866/s/legrand-myrius-nextgen-usb-charger-1500-ma-1-mod-type-a-white#679288',1,'approved','brand-sku'),
  ('leg-679466','legrand','catalog/product/view/id/5211/s/legrand-myrius-nextgen-rj-45-utp-cat-6-tooless-with-shutter-2m-graphite#679466',1,'approved','brand-sku'),
  ('leg-679211','legrand','catalog/product/view/id/4701/s/legrand-myrius-nextgen-16a-switch-1-way-1m-ind-white#679211',1,'approved','brand-sku'),
  ('leg-679203','legrand','catalog/product/view/id/4677/s/legrand-myrius-nextgen-6a-switch-1-way-1m-light-white#679203',1,'approved','brand-sku')
on conflict (product_id, source) do update set competitor_code = excluded.competitor_code, updated_at = now();

select count(*) filter (where in_stock) as orderable, count(*) filter (where not in_stock) as listed_oos
from public.products where brand = 'Legrand';
