import type { Product } from "@/lib/data";

/**
 * The 2-3 decision-driving facts shown on a product card, per category.
 *
 * A card's job is to let a buyer shortlist WITHIN a grid, so these are the
 * specs that differentiate neighbouring products (sweep/wattage/star rating
 * for fans, size/grade/coil for wires, type/rating/poles for switchgear),
 * not the category name, which the shelf title and filters already state.
 *
 * Sources, in order: the manufacturer spec table (tech_specs.specs, from the
 * brand-site import), variant attrs, then regexes over name+spec. Falls back
 * to the first segments of the legacy spec string so old rows keep a line.
 */
export function cardHighlights(p: Product): string[] {
  const s: Record<string, string> = p.techSpecs?.specs ?? {};
  const attrs = p.attrs ?? {};
  const text = `${p.name} · ${p.spec ?? ""}`;
  const out: string[] = [];
  const push = (v: string | null | undefined) => {
    const t = (v ?? "").replace(/\s+/g, " ").trim();
    if (!t || t.length > 34 || out.length >= 3) return;
    // Containment dedupe: "Amperes 25 A" adds nothing next to "25 A".
    const low = t.toLowerCase();
    if (out.some((x) => low.includes(x.toLowerCase()) || x.toLowerCase().includes(low))) return;
    out.push(t);
  };
  const g = (...keys: string[]) => {
    for (const k of keys) if (s[k]?.trim()) return s[k].trim();
    return null;
  };
  const rx = (re: RegExp) => text.match(re)?.[1] ?? null;

  switch (p.cat) {
    case "Fans": {
      const sweep = attrs.Sweep ?? g("Sweep Size");
      push(sweep ? `${sweep.replace(/\s*mm.*/i, "")} mm sweep` : null);
      const power = g("Power Consumption") ?? (rx(/(\d+(?:\.\d+)?)\s*W\b/) && `${rx(/(\d+(?:\.\d+)?)\s*W\b/)} W`);
      const motor = /BLDC/i.test(text) || /BLDC/i.test(g("Motor Type") ?? "") ? "BLDC" : null;
      push([power, motor].filter(Boolean).join(" · ") || motor);
      const star = g("Star Rating");
      push(star ? star.replace(/\s*Star.*/i, "★ BEE rated") : g("Air Delivery") ? `${g("Air Delivery")} air delivery` : g("Rated Speed")?.replace(/\s*Revolution.*/i, " RPM"));
      break;
    }
    case "Lighting": {
      const w = g("Wattage (W)", "Wattage") ?? (rx(/(\d+(?:\.\d+)?)\s*W\b/) && `${rx(/(\d+(?:\.\d+)?)\s*W\b/)} W`);
      push(w);
      const cct = attrs["Colour temp"] ?? (rx(/(\d{4})\s*K/) && `${rx(/(\d{4})\s*K/)} K`);
      push(cct ? `${cct}${/6500/.test(cct) ? " cool daylight" : /(2700|3000)/.test(cct) ? " warm" : ""}` : g("Rated Lumens") ? `${g("Rated Lumens")} brightness` : null);
      push(g("Warranty") ? `${g("Warranty")} warranty` : g("Colour Rendering Index (CRI)") ? `CRI ${g("Colour Rendering Index (CRI)")}` : null);
      // Fixtures without a wattage key still deserve substance on the card.
      push(g("Material"));
      push(g("Mounting Type", "Shape Type"));
      break;
    }
    case "Modular": {
      const amp = g("Amperes", "Rating") ?? (rx(/(\d+)\s*AX?\b/i) && `${rx(/(\d+)\s*AX?\b/i)} A`);
      push(amp ? `${amp.replace(/\s*(amp|a)\b.*/i, "")} A rated` : null);
      push(g("FR Grade", "Fr Grade Material", "Material") ? `${(g("FR Grade", "Fr Grade Material", "Material") ?? "").replace(/polycarbonate/i, "polycarbonate")}` : null);
      push(g("Warranty") ? `${g("Warranty")} warranty` : /modular/i.test(text) ? "Modular fit" : null);
      break;
    }
    case "Switchgear": {
      const type = /RCBO/i.test(text) ? "RCBO" : /RCCB/i.test(text) ? "RCCB" : /isolator|disconnector/i.test(text) ? "Isolator" : /surge|SPD/i.test(text) ? "Surge protector" : /motor starter/i.test(text) ? "Motor starter" : /changeover/i.test(text) ? "Changeover switch" : /energy saver/i.test(text) ? "Energy saver" : /MCB|breaker/i.test(text) ? "MCB" : g("Type");
      push(type);
      push(g("Rating", "Rated Current") ?? (rx(/(\d+)\s*A\b/) && `${rx(/(\d+)\s*A\b/)} A`));
      const poles = g("Execution pole") ?? rx(/\b(SP|DP|TP|FP|SPN|TPN|4P)\b/);
      const sens = g("Senstivity", "Sensitivity") ?? (/(RCCB|RCBO)/i.test(text) ? rx(/(\d+)\s*mA/) && `${rx(/(\d+)\s*mA/)} mA` : null);
      push([poles, sens].filter(Boolean).join(" · ") || null);
      break;
    }
    case "DB & Panels": {
      const ways = g("Number of Ways", "Ways") ?? rx(/(\d+)[\s-]*way/i);
      push(ways ? `${String(ways).replace(/\s*ways?.*/i, "")}-way` : null);
      push(g("Execution pole") ?? rx(/\b(SPN|TPN|VTPN)\b/));
      push(g("Type") ?? (/double door/i.test(text) ? "Double door" : /metal|CRCA/i.test(text) ? "CRCA steel" : null));
      break;
    }
    case "Wires & Cables": {
      push(attrs.Size ?? (rx(/(\d+(?:\.\d+)?)\s*sq\.?\s*mm/i) && `${rx(/(\d+(?:\.\d+)?)\s*sq\.?\s*mm/i)} sq mm`));
      const grade = attrs.Quality ?? rx(/\b(HR ?FR-?LSH|FR-?LSH|HRFR|HFFR|FRLS|FR PVC|FR)\b/i);
      push(grade ? `${grade.toUpperCase().replace(/\s+/g, " ")} insulation` : null);
      // Coil length: attrs first, then the spec table, then the name ("... 180 m"
      // is part of the product name when the family has no length variant).
      const coil = attrs.Length ?? g("Standard Length in Coil") ?? rx(/\b(\d{2,4})\s*(?:m|mtr|metre|meter)s?\b/i);
      push(coil ? `${String(coil).replace(/\s*m.*$/i, "")} m coil` : null);
      break;
    }
    case "Pumps": {
      push(rx(/(\d+(?:\.\d+)?)\s*HP/i) ? `${rx(/(\d+(?:\.\d+)?)\s*HP/i)} HP` : g("Power"));
      push(g("Motor Speed") ? `${(g("Motor Speed") ?? "").replace(/\s*(rpm|revolution.*)$/i, "")} RPM` : null);
      push(g("Guarantee", "Warranty") ? `${g("Guarantee", "Warranty")} warranty` : /submersible/i.test(text) ? "Submersible" : /monoblock/i.test(text) ? "Monoblock" : null);
      break;
    }
    case "EV Charging": {
      push(g("Current limiter") ? `Up to ${g("Current limiter")}` : rx(/(\d+(?:\.\d+)?)\s*kW/i) && `${rx(/(\d+(?:\.\d+)?)\s*kW/i)} kW`);
      push(g("Execution pole"));
      push(g("Warranty") ? `${g("Warranty")} warranty` : null);
      break;
    }
    case "Electrical Accessories": {
      push(g("Rating", "Rated Voltage"));
      push(g("Warranty") ? `${g("Warranty")} warranty` : null);
      break;
    }
  }

  // Fallback: reuse the legacy spec line's leading segments (curated rows have
  // hand-written short specs; noisy import keys are skipped).
  if (out.length < 2 && p.spec) {
    const range = (s["Product range"] ?? "").toLowerCase(); // leaf category name: shelf-title noise, not a spec
    for (const seg of p.spec.split("·")) {
      if (out.length >= 3) break;
      const t = seg.trim();
      if (t.length < 3 || t.length > 34) continue;
      if (t.toLowerCase() === range) continue;
      if (/^(suitable|net |warranty|manufactured|applications?|product range|ambient|base \d)/i.test(t)) continue;
      push(t);
    }
  }
  return out.slice(0, 3);
}
