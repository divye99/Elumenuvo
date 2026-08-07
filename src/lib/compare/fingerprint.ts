/**
 * Compare-engine fingerprints: "which products are the same thing in a
 * different brand?"
 *
 * Every product is reduced to a canonical fingerprint of its KEY
 * specifications (never colour). Products sharing a fingerprint key form a
 * compare group - a 1.5 sqmm 90 m FRLS house wire only ever groups with
 * another 1.5 sqmm 90 m FRLS house wire, whatever the brand calls it. This
 * is the hard gate the whole feature stands on: a wrong pair is structurally
 * impossible, because pairing IS key equality.
 *
 * Three layers:
 *   1. Structured attrs (Size / Length / Quality / Sweep / Wattage...) are
 *      read first - highest confidence.
 *   2. Text extraction from name + spec fills the gaps (Switchgear and
 *      Modular mostly live here; their rows carry source: "extracted" so the
 *      admin console can spot-check them).
 *   3. A curated equivalence dictionary canonicalises brand dialects:
 *      FR-LSH = FRLS = LSH, HFFR = HF FR = ZHFR, "Cool daylight" = 6500 K,
 *      "Double Pole" = DP. Genuinely different things (FR vs FRLS vs HRFR)
 *      stay different.
 *
 * Output per product:
 *   key       - the group id, e.g. "wires|1.5|90|frls|1c". null = never map.
 *   conflicts - softer specs that must not CONTRADICT between two paired
 *               products (missing = wildcard): curve, colour temp, base...
 *   display   - the 5 key specs the compare table shows, in row order.
 *   source    - "structured" (attrs) vs "extracted" (text) for admin QA.
 *
 * Self-improvement lives around this file, not inside it: behavioural
 * signals rank the rail (src/lib/compare/signals.ts), admin rejections
 * permanently block pairs (compare_rejections), and every catalogue import
 * re-fingerprints, so a new brand's offerings snap into existing groups
 * automatically.
 */

export type Fingerprint = {
  key: string;
  conflicts: Record<string, string>;
  display: [string, string][]; // [label, value] x 5
  source: "structured" | "extracted";
};

export type FingerprintInput = {
  category: string;
  name: string;
  spec?: string | null;
  attrs?: Record<string, string> | null;
};

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

/** Match against name+spec text (lowercased). */
const rx = (text: string, re: RegExp): string | null => {
  const m = text.match(re);
  return m ? (m[1] ?? m[0]) : null;
};

/* ── Equivalence dictionary: polymer / insulation dialects ──
 * Same class → same canon token; different class stays different.
 *   frls: flame-retardant low-smoke (FR-LSH, FRLSH, LSH, LS)
 *   hffr: halogen-free flame-retardant (HF FR, HFFR, ZHFR, LSZH, LS0H)
 *   hrfr: heat-resistant flame-retardant (HR FR, HRFR)
 *   fr:   plain flame-retardant PVC
 *   pvc:  plain PVC (no FR claim)
 */
function polymerOf(text: string, attr?: string): string | null {
  const t = norm(`${attr ?? ""} ${text}`);
  if (/\b(hffr|hf\s*fr|zhfr|lszh|ls0h|zero\s*halogen|halogen[\s-]*free)\b/.test(t)) return "hffr";
  if (/\b(frls|fr[\s-]*lsh?|lsh)\b/.test(t)) return "frls";
  if (/\b(hrfr|hr[\s-]*fr|heat[\s-]*resistant)\b/.test(t)) return "hrfr";
  if (/\bfr\b|\bflame[\s-]*retardant\b/.test(t)) return "fr";
  if (/\bpvc\b/.test(t)) return "pvc";
  return null;
}

const POLYMER_LABEL: Record<string, string> = {
  hffr: "HFFR (halogen-free)", frls: "FRLS (low smoke)", hrfr: "HRFR (heat resistant)", fr: "FR", pvc: "PVC",
};

/* ── Wires & Cables ── */
function wires(text: string, attrs: Record<string, string>): Fingerprint | null {
  const sizeRaw = attrs.Size ?? rx(text, /(\d+(?:\.\d+)?)\s*sq\.?\s*mm|(\d+(?:\.\d+)?)\s*sqmm/);
  const size = sizeRaw ? String(Number(String(sizeRaw).match(/\d+(?:\.\d+)?/)?.[0])) : null;
  const lenRaw = attrs.Length ?? rx(text, /(\d+(?:\.\d+)?)\s*m\b(?!m)/);
  const length = lenRaw ? String(Number(String(lenRaw).match(/\d+(?:\.\d+)?/)?.[0])) : null;
  const polymer = polymerOf(text, attrs.Quality ?? attrs.Grade);
  if (!size || !length || !polymer || Number(size) <= 0 || Number(length) <= 0) return null;
  const cores = rx(text, /(\d+)\s*(?:core|c\s*x)\b/) ?? "1";
  const voltage = rx(text, /(\d{3,4})\s*v\b/);
  const structured = Boolean(attrs.Size && attrs.Length && (attrs.Quality || attrs.Grade));
  return {
    key: `wires|${size}|${length}|${polymer}|${cores}c`,
    conflicts: { ...(voltage ? { voltage } : {}) },
    display: [
      ["Size", `${size} sq mm`],
      ["Coil length", `${length} m`],
      ["Insulation", POLYMER_LABEL[polymer]],
      ["Cores", cores === "1" ? "Single core" : `${cores} core`],
      ["Voltage grade", voltage ? `${voltage} V` : "1100 V"],
    ],
    source: structured ? "structured" : "extracted",
  };
}

/* ── Fans ── */
function fans(text: string, attrs: Record<string, string>): Fingerprint | null {
  const sweepRaw = attrs.Sweep ?? rx(text, /(\d{3,4})\s*mm\b/);
  const sweep = sweepRaw ? String(Number(String(sweepRaw).match(/\d+/)?.[0])) : null;
  if (!sweep) return null;
  let type: string | null = null;
  if (/\bexhaust|ventilat/.test(text)) type = "exhaust";
  else if (/\bpedestal\b/.test(text)) type = "pedestal";
  else if (/\btable\b/.test(text)) type = "table";
  else if (/\bwall\b/.test(text)) type = "wall";
  else if (/\btower\b/.test(text)) type = "tower";
  else if (/\bceiling\b/.test(text)) type = "ceiling";
  else if (Number(sweep) >= 900) type = "ceiling"; // 900mm+ sweep is a ceiling fan even when unsaid
  if (!type) return null;
  const tech = /\bbldc\b/.test(text) ? "bldc" : "ac";
  const watts = rx(text, /(\d+(?:\.\d+)?)\s*w\b/);
  const blades = rx(text, /(\d)\s*(?:n\b|blade)/);
  const TYPE_LABEL: Record<string, string> = { exhaust: "Exhaust fan", pedestal: "Pedestal fan", table: "Table fan", wall: "Wall fan", tower: "Tower fan", ceiling: "Ceiling fan" };
  return {
    key: `fans|${type}|${sweep}|${tech}`,
    conflicts: {},
    display: [
      ["Type", TYPE_LABEL[type]],
      ["Sweep", `${sweep} mm`],
      ["Motor", tech === "bldc" ? "BLDC (energy saving)" : "Induction (AC)"],
      ["Power", watts ? `${watts} W` : "-"],
      ["Blades", blades ? `${blades}` : "-"],
    ],
    source: attrs.Sweep ? "structured" : "extracted",
  };
}

/* ── Lighting ── */
function colourTempBucket(text: string, attr?: string): { bucket: string; label: string } | null {
  const t = norm(`${attr ?? ""} ${text}`);
  const k = rx(t, /(\d{4})\s*k\b/);
  const kelvin = k ? Number(k) : /warm\s*white/.test(t) ? 3000 : /cool\s*daylight|\bcdl\b|cool\s*white|daylight/.test(t) ? 6500 : /neutral|natural\s*white/.test(t) ? 4000 : null;
  if (kelvin == null) return null;
  if (kelvin <= 3500) return { bucket: "warm", label: `Warm (${kelvin} K)` };
  if (kelvin <= 5000) return { bucket: "neutral", label: `Neutral (${kelvin} K)` };
  return { bucket: "cool", label: `Cool daylight (${kelvin} K)` };
}

function lighting(text: string, attrs: Record<string, string>): Fingerprint | null {
  const wRaw = attrs.Wattage ?? rx(text, /(\d+(?:\.\d+)?)\s*w\b/);
  const watts = wRaw ? String(Number(String(wRaw).match(/\d+(?:\.\d+)?/)?.[0])) : null;
  if (!watts) return null;
  let type: string | null = null;
  const TYPES: [RegExp, string, string][] = [
    [/street\s*light/, "street", "Street light"],
    [/flood\s*light/, "flood", "Flood light"],
    [/\bbatten\b|tube\s*light|\btubelight\b/, "batten", "LED batten"],
    [/\bpanel\b/, "panel", "Panel light"],
    [/down\s*light|\bdownlight\b/, "downlight", "Downlight"],
    [/\bcob\b|spot\s*light|\bspotlight\b/, "spot", "Spotlight / COB"],
    [/\bstrip\b|\brope\b/, "strip", "Strip light"],
    [/\blantern\b|\blighthouse\b/, "lantern", "Lantern"],
    [/\btorch\b|flash\s*light/, "torch", "Torch"],
    [/\bbulb\b|\blamp\b/, "bulb", "LED bulb"],
  ];
  let typeLabel = "";
  for (const [re, slug, label] of TYPES) if (re.test(text)) { type = slug; typeLabel = label; break; }
  if (!type) return null;
  const pack = rx(text, /pack\s*of\s*(\d+)/) ?? "1";
  const temp = colourTempBucket(text, attrs["Colour temp"]);
  const base = rx(text, /\b(b22|e27|e14|gu10)\b/);
  const feet = rx(text, /(\d)\s*ft\b/);
  // Panels/downlights: a round recess panel is not a square surface panel.
  const shape = type === "panel" || type === "downlight" ? (/\bround\b|\brd\b/.test(text) ? "round" : /\bsquare\b|\bsq\b/.test(text) ? "square" : null) : null;
  const mount = type === "panel" || type === "downlight" ? (/recess/.test(text) ? "recess" : /surface/.test(text) ? "surface" : null) : null;
  return {
    key: `lighting|${type}|${watts}w|p${pack}`,
    conflicts: {
      ...(temp ? { colourtemp: temp.bucket } : {}),
      ...(base ? { base } : {}),
      ...(feet ? { feet } : {}),
      ...(shape ? { shape } : {}),
      ...(mount ? { mount } : {}),
    },
    display: [
      ["Type", typeLabel],
      ["Wattage", `${watts} W`],
      ["Light colour", temp ? temp.label : "-"],
      ["Base / size", base ? base.toUpperCase() : feet ? `${feet} ft` : "-"],
      ["Pack", pack === "1" ? "Single" : `Pack of ${pack}`],
    ],
    source: attrs.Wattage ? "structured" : "extracted",
  };
}

/* ── Switchgear ── */
function poles(text: string): string | null {
  if (/\bfp\b|4\s*p(?:ole)?\b|four\s*pole/.test(text)) return "fp";
  if (/\btpn\b/.test(text)) return "tpn";
  if (/\btp\b|3\s*p(?:ole)?\b|triple\s*pole/.test(text)) return "tp";
  if (/\bspn\b/.test(text)) return "spn";
  if (/\bdp\b|2\s*p(?:ole)?\b|double\s*pole/.test(text)) return "dp";
  if (/\bsp\b|1\s*p(?:ole)?\b|single\s*pole/.test(text)) return "sp";
  return null;
}

function switchgear(text: string, attrs: Record<string, string>): Fingerprint | null {
  let type: string | null = null;
  if (/changeover/.test(text)) type = "changeover";
  else if (/\brcbo\b/.test(text)) type = "rcbo";
  else if (/\brccb\b|\belcb\b/.test(text)) type = "rccb";
  else if (/isolator/.test(text)) type = "isolator";
  else if (/\bmccb\b/.test(text)) type = "mccb";
  else if (/\bmcb\b/.test(text)) type = "mcb";
  if (!type) return null;
  const p = poles(text);
  if (!p) return null;
  // "C16A" carries curve+rating together; otherwise take attrs.Rating / "32 A".
  const curveAmp = text.match(/\b([bcd])\s*(\d+(?:\.\d+)?)\s*a\b/);
  const ampRaw = attrs.Rating ?? curveAmp?.[2] ?? rx(text, /(\d+(?:\.\d+)?)\s*a(?:mp)?s?\b/);
  const amps = ampRaw ? String(Number(String(ampRaw).match(/\d+(?:\.\d+)?/)?.[0])) : null;
  if (!amps) return null;
  const curve = curveAmp?.[1] ?? (/(?:^|\s)([bcd])\s*(?:&\s*d\s*)?curve/.exec(text)?.[1] ?? null);
  const ma = rx(text, /(\d+)\s*ma\b/);
  // Earth-leakage devices are safety-rated by sensitivity: never pair them blind.
  if ((type === "rccb" || type === "rcbo") && !ma) return null;
  const kA = rx(text, /(\d+(?:\.\d+)?)\s*ka\b/);
  const POLE_LABEL: Record<string, string> = { sp: "SP", spn: "SPN", dp: "DP", tp: "TP", tpn: "TPN", fp: "FP (4 pole)" };
  return {
    key: `switchgear|${type}|${p}|${amps}a${ma ? `|${ma}ma` : ""}`,
    conflicts: { ...(curve ? { curve } : {}), ...(kA ? { ka: kA } : {}) },
    display: [
      ["Type", type.toUpperCase()],
      ["Poles", POLE_LABEL[p]],
      ["Rating", `${amps} A`],
      ["Curve", curve ? curve.toUpperCase() : "-"],
      [type === "rccb" || type === "rcbo" ? "Sensitivity" : "Breaking capacity", ma ? `${ma} mA` : kA ? `${kA} kA` : "-"],
    ],
    source: attrs.Rating ? "structured" : "extracted",
  };
}

/* ── Modular ── */
function modular(text: string, attrs: Record<string, string>): Fingerprint | null {
  let type: string | null = null;
  const TYPES: [RegExp, string, string][] = [
    [/dimmer/, "dimmer", "Dimmer"],
    [/regulator/, "regulator", "Fan regulator"],
    [/bell\s*push|\bbell\b/, "bell", "Bell push"],
    [/\busb\b/, "usb", "USB charger"],
    [/socket/, "socket", "Socket"],
    [/switch/, "switch", "Switch"],
    [/plate|cover/, "plate", "Plate"],
    [/\btv\b|coax/, "tv", "TV outlet"],
    [/\brj\s*\d+|telephone|data/, "data", "Data / telephone"],
  ];
  let typeLabel = "";
  for (const [re, slug, label] of TYPES) if (re.test(text)) { type = slug; typeLabel = label; break; }
  if (!type) return null;
  const modRaw = attrs.Modules ?? rx(text, /(\d+)\s*(?:m\b|module)/);
  const modules = modRaw ? String(Number(String(modRaw).match(/\d+/)?.[0])) : null;
  if (!modules) return null;
  const ampRaw = attrs.Rating ?? rx(text, /(\d+)\s*a\b/);
  const amps = ampRaw ? String(Number(String(ampRaw).match(/\d+/)?.[0])) : null;
  // 6 A vs 16 A switches are different products: rating is part of the key
  // for current-carrying devices, and one without a rating never maps.
  if ((type === "switch" || type === "socket") && !amps) return null;
  const ways = rx(text, /(\d)\s*[- ]?way/);
  const dimW = type === "dimmer" ? rx(text, /(\d{3,4})\s*w(?:atts)?\b/) : null;
  const series = attrs.Series ?? null;
  // A twin (two switches in one module) is not a single switch; a solid-glass
  // plate is not an aluminium or wood one. Missing stays a wildcard.
  const twin = /\btwin\b/.test(text) ? "twin" : null;
  const material = type === "plate"
    ? (/glass/.test(text) ? "glass" : /alumini/.test(text) ? "aluminium" : /\bwood\b|pinewood|teakwood/.test(text) ? "wood" : /steel/.test(text) ? "steel" : null)
    : null;
  return {
    key: `modular|${type}|${modules}m${type === "switch" || type === "socket" ? `|${amps}a` : ""}`,
    conflicts: { ...(ways ? { ways } : {}), ...(dimW ? { watts: dimW } : {}), ...(twin ? { twin } : {}), ...(material ? { material } : {}) },
    display: [
      ["Type", typeLabel],
      ["Modules", `${modules} M`],
      ["Rating", amps ? `${amps} A` : dimW ? `${dimW} W` : "-"],
      ["Ways", ways ? `${ways}-way` : "-"],
      ["Series", series ?? "-"],
    ],
    source: attrs.Modules ? "structured" : "extracted",
  };
}

const ENGINES: Record<string, (text: string, attrs: Record<string, string>) => Fingerprint | null> = {
  "Wires & Cables": wires,
  "Fans": fans,
  "Lighting": lighting,
  "Switchgear": switchgear,
  "Modular": modular,
};

export const COMPARE_CATEGORIES = Object.keys(ENGINES);

export function fingerprintProduct(p: FingerprintInput): Fingerprint | null {
  const engine = ENGINES[p.category];
  if (!engine) return null; // category unsupported → element stays hidden
  const text = norm(`${p.name} ${p.spec ?? ""}`);
  try {
    return engine(text, p.attrs ?? {});
  } catch {
    return null;
  }
}

/** Two same-key products still must not contradict on softer specs: a C-curve
 *  MCB never pairs with a D-curve one, warm light never with cool. A spec
 *  missing on either side is a wildcard - absence is not a contradiction. */
export function conflictsCompatible(a: Record<string, string>, b: Record<string, string>): boolean {
  for (const k of Object.keys(a)) {
    if (k in b && norm(a[k]) !== norm(b[k])) return false;
  }
  return true;
}
