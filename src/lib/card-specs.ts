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
  // A bullet must ADD information: anything the title already states
  // ("Type 1+2", "SP+N", "1200 mm") is wasted card space (owner rule,
  // Aug 2026). A bullet is redundant when (nearly) all its meaningful
  // tokens already appear in the product name, stem-tolerantly, so
  // "Surge protector" dies against "...Surge Protection Device" too.
  const nameLow = p.name.toLowerCase();
  const inTitle = (bullet: string) => {
    const toks = bullet.toLowerCase().split(/[^a-z0-9.+]+/).filter((t) => t.length >= 2);
    if (!toks.length) return false;
    const nameWords = nameLow.split(/[^a-z0-9.+]+/).filter(Boolean);
    const hit = toks.filter((t) =>
      nameLow.includes(t) || nameWords.some((w) => w.length >= 5 && t.length >= 5 && w.slice(0, 5) === t.slice(0, 5))
    );
    return hit.length >= Math.max(1, Math.ceil(toks.length * 0.65));
  };
  const push = (v: string | null | undefined) => {
    const t = (v ?? "").replace(/\s+/g, " ").trim();
    if (!t || t.length > 34 || out.length >= 3) return;
    // Junk that tells a buyer nothing (owner escalation, Aug 2026: an SPD
    // card read "Surge protector / Surge Protection Device / Imported By
    // Havells India Ltd."). Importer, packaging and origin lines are label
    // compliance, not decision specs; and a bullet must never just repeat
    // the category or another bullet in different words.
    if (/imported by|country of origin|marketed by|manufactured by|net contents|net quantity|customer care|per google demand data/i.test(t)) return;
    if (inTitle(t)) return;
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
      if (type === "Surge protector") {
        // SPD cards differentiate on type class + pole config + discharge
        // capacity - never on generic "Surge Protection Device" repeats.
        push(rx(/type\s*(\d\s*\+\s*\d|\d)\b/i) ? `Type ${rx(/type\s*(\d\s*\+\s*\d|\d)\b/i)!.replace(/\s+/g, "")}` : null);
        push(attrs.Poles ?? rx(/\b(SP\+N|TP\+N|DP|FP|1P\+N|3P\+N)\b/i));
        push(rx(/imax\s*:?\s*(\d+)\s*ka/i) ? `Imax ${rx(/imax\s*:?\s*(\d+)\s*ka/i)} kA` : null);
        break;
      }
      push(g("Rating", "Rated Current") ?? (rx(/(\d+)\s*A\b/) && `${rx(/(\d+)\s*A\b/)} A`));
      const poles = g("Execution pole") ?? attrs.Poles ?? rx(/\b(SP|DP|TP|FP|SPN|TPN|4P)\b/);
      const sens = g("Senstivity", "Sensitivity") ?? (/(RCCB|RCBO)/i.test(text) ? rx(/(\d+)\s*mA/) && `${rx(/(\d+)\s*mA/)} mA` : null);
      push([poles, sens].filter(Boolean).join(" · ") || null);
      // Depth facts for when the title already says type/rating/poles:
      const brk = g("Breaking Capacity", "Breaking capacity") ?? rx(/(\d+)\s*kA\b/);
      push(brk ? `${String(brk).replace(/\s*ka.*/i, "")} kA breaking` : null);
      push(g("Curve") ?? (rx(/\b([BCD])[\s-]*curve/i) && `${rx(/\b([BCD])[\s-]*curve/i)}-curve`));
      push(g("Warranty") ? `${g("Warranty")} warranty` : null);
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
    case "Water Heaters": {
      const litres = attrs.Size ?? g("Capacity") ?? rx(/(\d+(?:\.\d+)?)\s*-?\s*l(?:itres?|tr)?\b/i);
      push(litres ? `${String(litres).replace(/[^\d.]/g, "")} L` : /immersion/i.test(text) ? "Immersion rod" : null);
      const watts = g("Wattage", "Power") ?? rx(/(\d{3,4})\s*w\b/i);
      push(watts ? `${String(watts).replace(/[^\d]/g, "")} W` : null);
      const star = g("Star Rating") ?? rx(/(\d)\s*star/i);
      push(star ? `${String(star).replace(/[^\d]/g, "")}★ BEE rated` : /instant/i.test(text) ? "Instant" : /storage/i.test(text) ? "Storage" : null);
      break;
    }
  }

  // Norisys rows have no imported spec table, so their cards were bare. The
  // catalogue documents real engineering facts per product type; surface the
  // 2-3 that the name doesn't already state (Norisys only - owner, Aug 2026).
  if (p.brand === "Norisys" && out.length < 3) {
    const n = p.name;
    if (/\b(plate|cover)\b/i.test(n)) {
      if (/solid glass/i.test(n)) push("Tempered, toughened glass");
      else if (/solid wood/i.test(n)) push("Seasoned wood, hardened surface");
      else if (/solid marble|solid aluminium|solid metal/i.test(n)) push("Machined from a solid block");
      else push("UV-stable virgin polycarbonate");
      push("Snaps on after wall painting");
      push("Steel-cored bi-material frame");
    } else if (/usb|charger/i.test(n)) {
      push("Flame-proof thermoset body");
      push("Snap-fit module mounting");
    } else if (/socket/i.test(n)) {
      push("Child-protected safety shutters");
      push("Ring-spring grip, spark-free");
      push("Flame-proof thermoset body");
    } else if (/switch|regulator|dimmer|bell/i.test(n)) {
      push("Silver-rich contacts, low arcing");
      push("Snap action, spark-free life");
      push("Flame-proof thermoset body");
    } else {
      push("Flame-proof thermoset body");
      push("Snap-fit module mounting");
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
      if (/^(suitable|net |warranty|manufactured|imported|marketed|country of|applications?|product range|ambient|base \d)/i.test(t)) continue;
      push(t);
    }
  }
  // Never a bare card: if the title said everything the category logic knew,
  // surface any remaining honest fact from the spec table.
  if (out.length === 0) {
    for (const [k, v] of Object.entries(s)) {
      if (out.length >= 2) break;
      if (!/breaking|warranty|guarantee|curve|voltage|frequency|material|mount|width|module|capacity|ip\b/i.test(k)) continue;
      push(/warranty|guarantee/i.test(k) ? `${v} warranty` : v);
    }
  }
  return out.slice(0, 3);
}
