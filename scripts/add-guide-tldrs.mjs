#!/usr/bin/env node
/** One-time: add hand-written TL;DR bullets to every guide (owner ask, Aug
 *  2026). Each TL;DR answers the guide's core question in 3-4 lines for
 *  skimmers and featured snippets. Safe to re-run (overwrites tldr only). */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";

const TLDRS = {
  "6a-vs-16a-switches-sockets-guide": [
    "6 A points run lights, fans and electronics; 16 A points run heat: geyser, AC, kitchen appliances, iron.",
    "Kitchens need at least three 16 A counter points on 2.5 or 4 sq mm wiring.",
    "Universal 6/16 A shuttered sockets accept both plug sizes and are the safe default for new work.",
    "Never run a geyser or AC from a 6 A point; the switch becomes the weakest link on the circuit.",
  ],
  "bldc-vs-normal-fan-savings": [
    "A BLDC fan uses about 28 W against 70-75 W for a normal induction fan: roughly 60% less power.",
    "At 12 hours a day and Rs 8 per unit, one fan saves about Rs 1,600 a year; the price gap pays back in 1-2 years.",
    "Savings math: watts saved x daily hours x 365 / 1000 x your tariff.",
    "The more hours a fan runs, the stronger the BLDC case; for a rarely used room, a normal fan is fine.",
  ],
  "electrical-material-checklist-2bhk-3bhk": [
    "Fix the complete point count on paper with your electrician before buying anything.",
    "Big five: wire coils, DB with MCBs, one 30 mA RCCB (non-negotiable), modular switches and plates, fan and light fittings.",
    "A 2BHK typically needs 6-9 wire coils; a 3BHK needs 10-14.",
    "Buy 10-15% extra consumables (wire, tape, clips); returns cost more time than the surplus costs money.",
  ],
  "fr-frls-hrfr-hffr-wire-guide": [
    "FR resists catching fire; FRLS/FR-LSH adds low smoke for safer escape; HR adds heat resistance for hot, loaded runs.",
    "For homes, HR FR-LSH is the sweet spot in 2026; the price gap over plain FR is smaller than most buyers assume.",
    "HFFR/EBXL is halogen-free, the premium choice for enclosed or high-occupancy spaces.",
    "Same size and length, different grade: always compare per-coil prices before assuming premium is unaffordable.",
  ],
  "led-colour-temperature-guide": [
    "2700-3000K is warm and relaxing (bedrooms, living rooms); 4000K is neutral (kitchens, baths); 6500K is cool white (work areas).",
    "Pick one temperature per room and write it into the order; mixing temperatures in one ceiling looks broken.",
    "When unsure for living spaces, 3000K flatters interiors; 4000K is the versatile compromise.",
  ],
  "mcb-vs-rccb-vs-rcbo-guide": [
    "MCB protects wiring from overload; RCCB protects people from shock; RCBO does both in one module.",
    "MCCB is the MCB's big brother for 100 A+ mains and industrial panels; homes do not need one.",
    "RCD is the umbrella term; ELCB is the obsolete ancestor: if a shop says ELCB, buy an RCCB.",
    "Every home board needs both layers: MCBs per circuit plus one 30 mA RCCB (100 mA guards only wiring, not people).",
  ],
  "modular-plate-sizes-guide": [
    "Each switch is 1M, most sockets 2M, regulators and dimmers 2M; total the modules, then pick the plate.",
    "Common plates: 1M/2M/3M/4M/6M/8M/12M; count devices before the wall closes, not after.",
    "Leave one spare module per busy plate; future devices always arrive.",
  ],
  "top-10-bldc-ceiling-fans-india": [
    "Best overall: Atomberg Renesa 1200mm; best value alternatives from Crompton and Havells follow.",
    "A BLDC fan saves roughly 45 W per running hour over an induction fan; heavy-use rooms pay back fastest.",
    "1200mm sweep suits standard 10x10 to 12x12 ft rooms; go 1400mm for bigger rooms.",
    "All ranked fans include remotes; check star rating and warranty over paint finish.",
  ],
  "top-10-ceiling-fans-india": [
    "BLDC models top the rankings: Atomberg Renesa and Crompton Energion Hugo lead.",
    "BLDC saves about 47 W per hour over a 75 W induction fan; the premium pays back within two years of normal use.",
    "Match sweep to room: 1200mm for standard rooms, 900mm for small rooms and balconies.",
  ],
  "top-10-distribution-boards-india": [
    "Count final circuits, then add 25-30% spare ways; a full board on day one is a mistake.",
    "SPN boards for homes, TPN/VTPN for three-phase supplies and commercial use.",
    "Top ranges: Havells double-door, Schneider Acti9, Legrand Ekinoxe; match the DB brand to your breaker range.",
    "Double-door designs hide wiring and survive Indian dust; worth the small premium.",
  ],
  "top-10-exhaust-fans-india": [
    "150mm exhaust fans suit bathrooms and small kitchens; 250mm for full-size kitchens.",
    "Best overall: Atomberg Efficio 150mm BLDC; quietest running in its class.",
    "Mount as high as possible, opposite the air inlet, for real extraction.",
  ],
  "top-10-extension-boards-spike-guards-india": [
    "Best overall: Havells USB Star 4+1 with surge protection; GM Lemoid for built-in USB charging.",
    "6 A boards handle electronics up to about 1,200 W total; never run a geyser, iron or kettle from one.",
    "For heavy appliances, buy a 16 A board (Orient makes the pick on this list).",
    "Surge/spike protection is worth it for TVs, routers and PCs; plain boards are for lamps and chargers.",
  ],
  "top-10-house-wires-cables-india": [
    "Best value: APAR Anushakti EBXL HR FR; Polycab Maxima+ and KEI Conflame Green+ lead the branded pack.",
    "Match gauge to load: 1.0 sq mm lighting, 1.5 fans, 2.5 sockets, 4-6 for geyser/AC feeds.",
    "Buy HR FR-LSH or better for new wiring; the premium over plain FR is small.",
    "Compare per-coil prices across brands on the same size and grade; gaps of 20-30% are common.",
  ],
  "top-10-led-battens-tubelights-india": [
    "A 20W LED batten replaces an old 36-40W tube fitting with no choke or starter to ever replace.",
    "Best picks: Philips 20W 4ft, Havells Garnet, Wipro Austra Arc; all three near-identical light output.",
    "Buy 4000K for kitchens and work areas, 6500K for shops and garages.",
  ],
  "top-10-led-bulbs-india": [
    "Multi-packs win: per-bulb price drops 15-25% versus singles across brands.",
    "9W is the standard room bulb (about 900 lumens); 12W+ only for high ceilings or single-bulb rooms.",
    "Best value: Syska 4-pack (~Rs 135/bulb); best light quality: Philips.",
  ],
  "top-10-led-lights-india": [
    "Buy on lumens per watt, not watts: a genuine 100 lm/W 9W bulb beats a cheap 12W.",
    "Philips Ace Saver, Havells Adore and Syska Rocket lead the 9W class.",
    "Warm (3000K) for living spaces, cool (6500K) for task areas.",
  ],
  "top-10-led-panel-lights-india": [
    "One 10-12W panel per small-room zone; count coverage, not habit.",
    "Square panels read modern in living rooms; round panels suit passages and baths.",
    "Pick one colour temperature per ceiling: 3000K warm, 4000K neutral, 6500K cool.",
  ],
  "top-10-mcbs-rccbs-india": [
    "Never run a home without a 30 mA RCCB; MCBs protect wires, not people.",
    "Top picks: Schneider Acti9 40A/30mA, Havells FP rotary, ABB 63A 4P for three-phase homes.",
    "Size the RCCB at or above your main incomer rating; 40A suits most homes, 63A for large ones.",
  ],
  "top-10-mcbs-switchgear-india": [
    "Match the curve to the load: B-curve for heaters/geysers, C-curve for general household circuits.",
    "Top ranges: Schneider Acti9 iC60N, Havells Euro-II, Legrand DX3, ABB System Pro.",
    "Buy the DB, MCBs and RCCB from one range where possible; spacing and busbars line up cleanly.",
  ],
  "top-10-modular-switches-sockets-india": [
    "Top ranges: Anchor Roma (value), Legrand Myrius (mid), Schneider ZENcelo (premium).",
    "6 A switches for lights and fans; 16 A switches and 3-pin sockets for geyser, AC and kitchen points.",
    "Stay within one range per home; plates, modules and supports are not cross-compatible.",
  ],
  "top-10-outdoor-flood-lights-india": [
    "IP65 minimum outdoors, IP66 for fully exposed mountings; the rating is non-negotiable.",
    "20-30W LED flood covers a typical house front or yard; 50W+ only for large plots.",
    "Best picks: Havells Centura Neo 20W and Syska IP66 30W.",
  ],
  "top-10-water-pumps-india": [
    "Self-priming monoblock for sump-to-tank transfer (most homes); pressure booster for weak shower flow; submersible for borewells.",
    "Crompton Zinnia and Grace mini monoblocks top the home rankings.",
    "Match HP to head: 0.5 HP lifts to roughly 2-3 floors; 1 HP for higher or longer runs.",
  ],
  "water-heater-geyser-buying-guide-india": [
    "Capacity: 1-3 L instant for kitchen, 6 L for one person, 10 L for a couple, 15 L for a family of 3-4, 25 L for bucket-plus-tub homes.",
    "Best overall: Havells Monza Pro 10 L (about 40% under MRP); hard-water areas should pick a polymer tank (Orient Enamour/Cronos).",
    "5 star ratings pay back only if the geyser stays on for hours; switch-on-before-shower homes can buy 4 star.",
    "Every geyser needs its own 16 A point on 2.5 sq mm wiring, never a 6 A plug.",
  ],
  "which-mcb-rating-guide-india": [
    "6A for lighting, 10A for fan circuits, 16A for sockets and most geysers, 20-32A for AC and kitchen feeds.",
    "Pair the breaker to the WIRE first: 6-10A on 1.5 sq mm, 16-20A on 2.5 sq mm, 25-32A on 4 sq mm.",
    "An oversized MCB is dangerous: it protects nothing if the wire burns before it trips.",
  ],
  "which-wire-size-guide-india": [
    "1 sq mm for light points, 1.5 for lighting and fans, 2.5 for sockets, 4-6 for geyser/AC, per-appliance.",
    "Size for the circuit, not the house; each heavy appliance gets its own run.",
    "When a run is long (15 m+) or hot, step up one size; voltage drop is real.",
  ],
  "wire-coil-length-guide-2bhk-3bhk": [
    "A 2BHK needs roughly 6-9 coils of 90 m; a 3BHK needs 10-14, split across sizes.",
    "90 m is the standard coil; 180 m coils save money on big jobs but only for the volume sizes (1.5 and 2.5 sq mm).",
    "Get the electrician's measured estimate first, then sanity-check against these ranges.",
  ],
};

let patched = 0, missing = [];
for (const f of readdirSync("src/content/blog")) {
  const path = `src/content/blog/${f}`;
  const g = JSON.parse(readFileSync(path, "utf8"));
  const tldr = TLDRS[g.slug];
  if (!tldr) { missing.push(g.slug); continue; }
  g.tldr = tldr;
  writeFileSync(path, JSON.stringify(g, null, 2) + "\n");
  patched++;
}
console.log(JSON.stringify({ patched, missing }));
