#!/usr/bin/env python3
"""Generate 0035_wire-tech-specs.sql from the official-catalogue data.
Each product (matched by brand + Quality attr + size) gets a tech_specs jsonb
with conductor / insulation / dimensions / current rating / fire-test data,
sourced verbatim from the manufacturer house-wire catalogues."""
import json

# per-size rows: size -> [strands, ins_thk_mm, overall_dia_mm, dc_res_ohm_km, rating_clipped_a, rating_conduit_a]
LINES = {
 # ── KEI (House Wires Catalogue 2024) ─────────────────────────────
 ("KEI","HR FR-LSH"): dict(  # Conflame Green+
   line="Conflame Green+", material="HR FR-LSH LF PVC", op_temp=85, cond_class="5",
   src="KEI House Wires Catalogue 2024",
   rows={"0.75":["24/0.2",0.6,2.8,26.0,9,10],"1":["32/0.2",0.6,3.0,19.5,14,16],
         "1.5":["30/0.25",0.6,3.4,13.3,17,21],"2.5":["50/0.25",0.7,4.1,7.98,23,28],
         "4":["56/0.3",0.8,4.8,4.95,31,38],"6":["84/0.3",0.8,5.3,3.30,40,48]},
   fire=[("Critical Oxygen Index","ASTM-D 2863","min 31%"),("Temperature Index","ASTM-D 2863","min 250°C"),
         ("Acid Gas Generation","IEC 60754-1","max 20%"),("Smoke Density Rating","ASTM-D 2843","max 60%")]),
 ("KEI","HFFR"): dict(  # Banfire
   line="Banfire", material="HFFR (halogen-free)", op_temp=70, cond_class="5",
   src="KEI House Wires Catalogue 2024",
   rows={"0.75":["24/0.2",0.6,2.8,26.0,7,8],"1":["32/0.2",0.6,3.0,19.5,12,13],
         "1.5":["30/0.25",0.6,3.4,13.3,14,17],"2.5":["50/0.25",0.7,4.1,7.98,19,23],
         "4":["56/0.3",0.8,4.8,4.95,25,31],"6":["84/0.3",0.8,5.3,3.30,33,39]},
   fire=[("Critical Oxygen Index","ASTM-D 2863","min 29%"),("Temperature Index","ASTM-D 2863","min 250°C"),
         ("Acid Gas Generation","IEC 60754-1","max 0.5%"),("Smoke Density Rating","ASTM-D 2843","max 20%")]),
 ("KEI","FR-LSH"): dict(  # Conflame
   line="Conflame", material="FR-LSH PVC", op_temp=None, cond_class="5",
   src="KEI House Wires Catalogue 2024",
   rows={"0.75":["24/0.2",0.6,2.8,26.0,7.5,7.0],"1":["32/0.2",0.6,3.0,19.5,12,11],
         "1.5":["30/0.25",0.6,3.4,13.3,16,14],"2.5":["50/0.25",0.7,4.1,7.98,22,19],
         "4":["56/0.3",0.8,4.8,4.95,29,26],"6":["84/0.3",0.8,5.3,3.30,37,31]},
   fire=[("Critical Oxygen Index","ASTM-D 2863","min 29%"),("Temperature Index","ASTM-D 2863","min 250°C"),
         ("Acid Gas Generation","IEC 60754-1","max 20%"),("Smoke Density Rating","ASTM-D 2843","max 60%")]),
 ("KEI","FR"): dict(  # HomeCab
   line="HomeCab", material="FR PVC (anti-rodent)", op_temp=None, cond_class="5",
   src="KEI House Wires Catalogue 2024",
   rows={"0.5":["16/0.2",0.6,2.6,39.0,4,4],"0.75":["24/0.2",0.6,2.8,26.0,7,8],"1":["32/0.2",0.6,3.0,19.5,12,13],
         "1.5":["30/0.25",0.6,3.4,13.3,14,17],"2.5":["50/0.25",0.7,4.1,7.98,19,23],
         "4":["56/0.3",0.8,4.8,4.95,25,31],"6":["84/0.3",0.8,5.3,3.30,33,39]},
   fire=[("Critical Oxygen Index","ASTM-D 2863","min 29%"),("Temperature Index","ASTM-D 2863","min 250°C")]),
 # ── Havells (Consumer Cable Catalogue) ───────────────────────────
 ("Havells","HRFR"): dict(  # Life Line Plus S3
   line="Life Line Plus S3", material="HRFR PVC", op_temp=None, cond_class="II (1.0-2.5), V (rest)",
   src="Havells Consumer Cable Catalogue",
   rows={"0.5":["16/0.2",0.6,2.1,39.0,5,5],"0.75":["24/0.2",0.6,2.3,26.0,9,9],"1":["14/0.3",0.7,2.7,18.10,15,16],
         "1.5":["22/0.3",0.7,3.0,12.10,19,21],"2.5":["36/0.3",0.8,3.6,7.41,25,28],
         "4":["56/0.3",0.8,4.1,4.95,32,35],"6":["84/0.3",0.8,4.6,3.30,43,47]},
   fire=[]),
 # ── RR Kabel (Integrated Brochure) ───────────────────────────────
 ("RR Kabel","FR"): dict(  # Superex
   line="Superex", material="FR PVC", op_temp=None, cond_class="5",
   src="RR Kabel Integrated Brochure",
   rows={"0.75":["24/0.2",0.6,2.3,26.0,9,8],"1":["14/0.3",0.7,2.7,18.1,14,13],
         "1.5":["22/0.3",0.7,3.0,12.1,18,16],"2.5":["36/0.3",0.8,3.7,7.41,24,20],
         "4":["56/0.3",0.8,4.1,4.95,30,26],"6":["84/0.3",0.8,4.6,3.30,38,33]},
   fire=[("Limited Oxygen Index","IS 10810 P-58","> 29%"),("Limited Temperature Index","IS 10810 P-64","> 250°C")]),
 # ── Polycab (House Wires Catalogue Mar-25) ───────────────────────
 ("Polycab","HR FR-LSH"): dict(  # Maxima+ Green Wire
   line="Maxima+ Green Wire", material="HR FR-LSH LF PVC", op_temp=85, cond_class="5",
   src="Polycab House Wires Catalogue (Mar-25)",
   rows={"0.75":["24/0.21",0.6,2.25,26.0,8.0,8.54],"1":["14/0.31",0.6,2.44,18.1,13.5,14.64],
         "1.5":["22/0.31",0.7,2.9,12.1,17.1,19.52],"2.5":["36/0.31",0.8,3.52,7.41,23.2,26.84],
         "4":["56/0.31",0.8,3.95,4.95,31.2,34.8],"6":["84/0.31",0.8,4.48,3.30,37.2,44.4]},
   fire=[]),
 # ── APAR (grade-level; no per-size electrical table available) ───
 ("APAR","EBXL HR FR"): dict(  # Anushakti
   line="Anushakti", material="EBXL HR FR PVC (e-beam)", op_temp=105, cond_class="5",
   src="APAR / aparwiresandcables.com", rows={},
   fire=[("Critical Oxygen Index","","≥ 30%"),("Temperature Index","","> 250°C")]),
 ("APAR","HR FR-LSH"): dict(  # Green Wire (Shakti Green Wire)
   line="Shakti Green Wire", material="HR FR-LSH PVC", op_temp=None, cond_class="5",
   src="APAR", rows={}, fire=[]),
 ("APAR","FR PVC"): dict(  # Shakti
   line="Shakti", material="FR PVC", op_temp=None, cond_class="5", src="APAR", rows={}, fire=[]),
}

def spec_json(meta, size):
    d = {"line": meta["line"], "insulation": {"material": meta["material"]},
         "conductor": {"material": "bright annealed electrolytic copper", "class": meta["cond_class"]},
         "voltage_grade_v": 1100, "standards": ["IS 694:2010", "IS 8130"],
         "packing": "90 m coil, protective cartons",
         "colours": ["Red","Yellow","Blue","Black","Green","Grey"], "source": meta["src"]}
    if meta["op_temp"]: d["max_operating_temp_c"] = meta["op_temp"]
    if meta["fire"]: d["fire_tests"] = [{"test":t,"method":m,"value":v} for t,m,v in meta["fire"]]
    r = meta["rows"].get(size)
    if r:
        strands, ins, dia, dc, ra, rb = r
        d["conductor"]["strands"] = strands
        d["conductor"]["resistance_ohm_km"] = dc
        d["insulation"]["thickness_mm"] = ins
        d["dimensions"] = {"overall_diameter_mm": dia}
        lo, hi = sorted([ra, rb])
        d["current_rating_a"] = {"min": lo, "max": hi, "raw": [ra, rb]}
    return d

out = ["""-- ═══════════════════════════════════════════════════════════════
-- 0035 · Wire technical specifications from official brand catalogues
--
-- Adds products.tech_specs (jsonb) and populates it for house wires from the
-- manufacturer catalogues (Polycab Mar-25, KEI 2024, RR Kabel, Havells): per
-- size the strand construction, insulation thickness, overall diameter, DC
-- conductor resistance, current-carrying capacity, plus per-line fire-test
-- results (oxygen index, temperature index, acid-gas, smoke density) with the
-- test method and specified value. Matched by brand + Quality grade + size.
-- Idempotent. Generated by scripts/gen_techspecs.py.
-- ═══════════════════════════════════════════════════════════════

alter table public.products add column if not exists tech_specs jsonb;
comment on column public.products.tech_specs is 'Structured technical data (conductor/insulation/dimensions/current-rating/fire-tests) from the manufacturer catalogue.';
"""]

n = 0
for (brand, quality), meta in LINES.items():
    sizes = meta["rows"].keys() or ["__all__"]
    for size in sizes:
        js = json.dumps(spec_json(meta, None if size == "__all__" else size), ensure_ascii=False).replace("'", "''")
        if size == "__all__":
            out.append(
f"""update public.products set tech_specs = '{js}'::jsonb
where brand = '{brand}' and category = 'Wires & Cables' and attrs->>'Quality' = '{quality}';""")
        else:
            out.append(
f"""update public.products set tech_specs = '{js}'::jsonb
where brand = '{brand}' and category = 'Wires & Cables' and attrs->>'Quality' = '{quality}'
  and split_part(attrs->>'Size', ' ', 1)::numeric = {size};""")
        n += 1

out.append("""
-- Review: coverage by brand + grade
select brand, attrs->>'Quality' as grade, count(*) as skus,
       count(tech_specs) as with_tech_specs
from public.products where category = 'Wires & Cables'
group by brand, attrs->>'Quality' order by brand, grade;
""")
open("0035_wire-tech-specs.sql","w").write("\n\n".join(out))
print(f"wrote 0035_wire-tech-specs.sql with {n} update statements")
