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
 *      "Double Pole" = DP. Genuinely different things (FR ≠ FRLS ≠ HRFR)
 *      stay different.
 *
 * Conflict fields come in two flavours, chosen deliberately per spec:
 *   - one-sided (emitted only when detected): absence is a wildcard. Used
 *     where absence genuinely means "unknown" (trip curve, colour temp).
 *   - two-sided (always emitted, with a default): used where absence means
 *     the NORMAL variant, so a special product can never wildcard next to a
 *     normal one - inverter lamps, smart devices, twin switches, mini MCBs,
 *     EBXL wires, underlight fans. This closed the wildcard leaks found in
 *     the 196-group adversarial audit of the live catalogue.
 *
 * Output per product:
 *   key       - the group id, e.g. "wires|1.5|90|frls|1c". null = never map.
 *   conflicts - softer specs that must not CONTRADICT between two paired
 *               products (missing = wildcard).
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

/** Catalogue names arrive with stray HTML entities ("&#x2B;", "&amp;") that
 *  would break both extraction ("+ Blank" twins) and display. */
export function decodeEntities(s: string): string {
  return s
    .replace(/&#x2b;/gi, "+")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#x27;|&apos;/gi, "'")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'");
}

const norm = (s: string) => decodeEntities(s).toLowerCase().replace(/\s+/g, " ").trim();

/** Match against name+spec text (lowercased). */
const rx = (text: string, re: RegExp): string | null => {
  const m = text.match(re);
  return m ? (m[1] ?? m[0]) : null;
};

const isSmart = (text: string) => /\bsmart\b|\bble\b|\bwi-?fi\b|\bmesh\b|\balexa\b/.test(text);

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
  // Two-sided: electron-beam cross-linked (EBXL, 105°C) insulation is a
  // higher heat class than thermoplastic PVC - never co-surface them.
  const tech = /\bebxl\b|cross[\s-]*link|\be-?beam\b|105\s*°?\s*c/.test(text) ? "ebxl" : "std";
  // HR prefix on FR-LSH/FRLS is the brand's higher-heat premium line: same
  // commercial segment (shared group is sanctioned) but the table must not
  // show them as identical strings.
  const hr = polymer === "frls" && /\bhr\b|hr[\s-]*fr/.test(text);
  const structured = Boolean(attrs.Size && attrs.Length && (attrs.Quality || attrs.Grade));
  return {
    key: `wires|${size}|${length}|${polymer}|${cores}c`,
    conflicts: { tech, ...(voltage ? { voltage } : {}) },
    display: [
      ["Size", `${size} sq mm`],
      ["Coil length", `${length} m`],
      ["Insulation", tech === "ebxl" ? "EBXL cross-linked (105°C)" : hr ? "HR FR-LSH (higher heat)" : POLYMER_LABEL[polymer]],
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
  const watts = rx(text, /(\d+(?:\.\d+)?)\s*w\b/);
  // BLDC by name OR by signature: a 5-star ceiling fan at ≤45 W is BLDC even
  // when the listing forgets to say so (audit caught the Crista Under Light).
  const tech = /\bbldc\b/.test(text) || (type === "ceiling" && /5[\s-]*star/.test(text) && watts != null && Number(watts) <= 45) ? "bldc" : "ac";
  const blades = rx(text, /(\d)\s*(?:n\b|blade)/);
  // Two-sided: an underlight/decorative-light fan is its own product class.
  const light = /under\s*light|underlight/.test(text) ? "underlight" : "plain";
  const TYPE_LABEL: Record<string, string> = { exhaust: "Exhaust fan", pedestal: "Pedestal fan", table: "Table fan", wall: "Wall fan", tower: "Tower fan", ceiling: "Ceiling fan" };
  return {
    key: `fans|${type}|${sweep}|${tech}`,
    conflicts: { light, ...(isSmart(text) ? { smart: "smart" } : {}) },
    display: [
      ["Type", light === "underlight" ? `${TYPE_LABEL[type]} (underlight)` : TYPE_LABEL[type]],
      ["Sweep", `${sweep} mm`],
      ["Motor", tech === "bldc" ? "BLDC (energy saving)" : "Induction (AC)"],
      ["Power", watts ? `${watts} W` : "-"],
      ["Blades", blades ? `${blades}` : "-"],
    ],
    source: attrs.Sweep ? "structured" : "extracted",
  };
}

/* ── Lighting ── */
function colourTempBucket(text: string, attrColour?: string, attrTemp?: string): { bucket: string; label: string } | null {
  const t = norm(`${attrTemp ?? ""} ${text}`);
  // Saturated light colours are decorative lighting, not white-light tints -
  // a red panel must never surface beside a warm-white one.
  const colour = norm(attrColour ?? "");
  if (/^(red|pink|blue|green|amber|rgb|multi[\s-]*colou?r)$/.test(colour) || /\brgb\b/.test(t)) {
    return { bucket: "decor", label: `Decorative (${attrColour ?? "RGB"})` };
  }
  const k = rx(t, /(\d{4})\s*k\b/);
  const kelvin = k ? Number(k)
    : /warm\s*white/.test(t) ? 3000
    : /cool\s*day\s*white|cool\s*daylight|\bcdl\b|\bcdw\b|cool\s*white|day\s*white|daylight/.test(t) ? 6500
    : /neutral|natural\s*white/.test(t) ? 4000
    : null;
  if (kelvin == null) return null;
  if (kelvin <= 3500) return { bucket: "warm", label: `Warm (${kelvin} K)` };
  if (kelvin <= 5000) return { bucket: "neutral", label: `Neutral (${kelvin} K)` };
  return { bucket: "cool", label: `Cool daylight (${kelvin} K)` };
}

function lighting(text: string, attrs: Record<string, string>): Fingerprint | null {
  let type: string | null = null;
  // Portable/decor forms FIRST: a "solar lantern + torch" mentions "solar
  // panel" in its spec and must never land in the ceiling-panel bucket.
  const TYPES: [RegExp, string, string][] = [
    [/\blantern\b|\blighthouse\b|solar\s*(?:lantern|light\b)/, "lantern", "Lantern"],
    [/\btorch\b|flash\s*light|head\s*lamp/, "torch", "Torch"],
    [/portable\s*lamp|table\s*lamp|floor\s*lamp|\bfloor\s*standing/, "lamp", "Portable / floor lamp"],
    [/home\s*art|gate\s*light|wall\s*light|facade/, "wallart", "Wall / art light"],
    [/street\s*light/, "street", "Street light"],
    [/flood\s*light/, "flood", "Flood light"],
    [/\bbatten\b|tube\s*light|\btubelight\b/, "batten", "LED batten"],
    [/down\s*light|\bdownlight\b/, "downlight", "Downlight"],
    [/\bcob\b|spot\s*light|\bspotlight\b/, "spot", "Spotlight / COB"],
    [/\bstrip\b|\brope\b/, "strip", "Strip light"],
    [/\bpanel\b/, "panel", "Panel light"],
    [/\bbulb\b|\blamp\b/, "bulb", "LED bulb"],
  ];
  let typeLabel = "";
  for (const [re, slug, label] of TYPES) if (re.test(text)) { type = slug; typeLabel = label; break; }
  if (!type) return null;

  const wRaw = attrs.Wattage ?? rx(text, /(\d+(?:\.\d+)?)\s*w\b/);
  const watts = wRaw ? String(Number(String(wRaw).match(/\d+(?:\.\d+)?/)?.[0])) : null;
  if (!watts) return null;
  // Sanity: when the NAME states a wattage that disagrees with the keyed one
  // by >25%, the record is suspect - refuse to map rather than mis-group.
  const nameW = rx(norm(text.split("·")[0] ?? text), /(\d+(?:\.\d+)?)\s*w\b/);
  if (nameW && Math.abs(Number(nameW) - Number(watts)) / Number(watts) > 0.25) return null;

  // Multi-lamp fixtures ("2 x 7.5 W") count as packs of lamps.
  const multi = rx(text, /(\d+)\s*x\s*\d+(?:\.\d+)?\s*w\b/);
  const pack = multi ?? rx(text, /pack\s*of\s*(\d+)/) ?? "1";
  // Emergency/inverter lamps are their own product class - key, not conflict.
  const inverter = /inverter|intellicharge|backup|rechargeable\s*(?:bulb|batten|lamp)/.test(text) && (type === "bulb" || type === "batten");
  // Strip/rope reels: keyed wattage is per-metre, so reel length is a key.
  let reel: string | null = null;
  if (type === "strip") {
    reel = rx(text, /length\s*(\d+(?:\.\d+)?)\s*m\b/) ?? rx(text, /(\d+(?:\.\d+)?)\s*m(?:etre|tr)?\s*(?:reel|roll|rope)/);
    if (!reel) return null;
    reel = String(Number(reel));
  }

  const temp = colourTempBucket(text, attrs.Colour, attrs["Colour temp"]);
  const base = rx(text, /\b(b22|e27|e14|gu10)\b/);
  const feet = rx(text, /(\d)\s*ft\b/);
  const envelope = rx(text, /\b(g\d{2,3}|t\d{2})\b/);
  const shape = type === "panel" || type === "downlight"
    ? (/l\s*[\s-]?shape/.test(text) ? "lshape" : /i\s*[\s-]?shape|linear/.test(text) ? "linear" : /\bround\b|\brd\b/.test(text) ? "round" : /\bsquare\b|\bsq\b/.test(text) ? "square" : null)
    : null;
  const mount = ["panel", "downlight", "spot"].includes(type) ? (/recess/.test(text) ? "recess" : /surface/.test(text) ? "surface" : null) : null;
  const sensor = type === "street" || type === "flood" ? (/\bsensor\b|dusk\s*to\s*dawn|motion/.test(text) ? "sensor" : "plain") : null;

  return {
    key: `lighting|${type}|${watts}w|p${pack}${inverter ? "|inv" : ""}${reel ? `|${reel}m` : ""}`,
    conflicts: {
      ...(temp ? { colourtemp: temp.bucket } : {}),
      ...(base ? { base } : {}),
      ...(feet ? { feet } : {}),
      ...(envelope ? { envelope } : {}),
      ...(shape ? { shape } : {}),
      ...(mount ? { mount } : {}),
      ...(sensor ? { sensor } : {}),
      ...(isSmart(text) ? { smart: "smart" } : {}),
    },
    display: [
      ["Type", inverter ? `${typeLabel} (battery backup)` : typeLabel],
      ["Wattage", type === "strip" ? `${watts} W/m · ${reel} m reel` : `${watts} W`],
      ["Light colour", temp ? temp.label : "-"],
      ["Base / size", base ? base.toUpperCase() : envelope ? envelope.toUpperCase() : feet ? `${feet} ft` : "-"],
      ["Pack", pack === "1" ? "Single" : multi ? `${pack} lamps` : `Pack of ${pack}`],
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
  // "Rating 16 A to 63 A" is a series RANGE, not this variant's rating -
  // keying the lower bound merged different-amp variants (audit finding).
  if (/\d+\s*a\s*(?:to|-)\s*\d+\s*a\b/.test(text)) return null;
  // "C16A" carries curve+rating together; otherwise take attrs.Rating / "32 A".
  const curveAmp = text.match(/\b([bcd])\s*(\d+(?:\.\d+)?)\s*a\b/);
  const ampRaw = attrs.Rating ?? curveAmp?.[2] ?? rx(text, /(\d+(?:\.\d+)?)\s*a(?:mp)?s?\b/);
  const amps = ampRaw ? String(Number(String(ampRaw).match(/\d+(?:\.\d+)?/)?.[0])) : null;
  if (!amps) return null;
  // Form factor is part of the KEY: a plate-mount mini/tiny MCB and a
  // DIN-rail distribution-board breaker are different physical products.
  const form = /\bmini\b|\btiny\b|\bmodular\b|\breo\b/.test(text) ? "mini" : "din";
  // Curve: "C16A", "'C' curve", "C Series", "SP C MCB", and the X7 range
  // (a C-curve line). Breakers only - isolators/changeovers have no curve.
  const hasCurve = type === "mcb" || type === "mccb" || type === "rcbo";
  const curve = !hasCurve ? null
    : curveAmp?.[1]
    ?? rx(text, /['"’]?([bcd])['"’]?\s*(?:curve|series)/)
    ?? rx(text, /\b([bcd])\s+(?:mini\s+|micro\s+)?mcb\b/)
    ?? rx(text, /\b(?:sp|dp|tp|fp|spn|tpn)\s+([bcd])\b/)
    ?? (/\bx7\b/.test(text) ? "c" : null);
  const ma = rx(text, /(\d+)\s*ma\b/);
  // Earth-leakage devices are safety-rated by sensitivity: never pair them blind.
  if ((type === "rccb" || type === "rcbo") && !ma) return null;
  const kA = rx(text, /(\d+(?:\.\d+)?)\s*ka\b/);
  const POLE_LABEL: Record<string, string> = { sp: "SP", spn: "SPN", dp: "DP", tp: "TP", tpn: "TPN", fp: "FP (4 pole)" };
  return {
    key: `switchgear|${type}|${p}|${amps}a|${form}${ma ? `|${ma}ma` : ""}`,
    conflicts: { ...(curve ? { curve } : {}), ...(kA ? { ka: kA } : {}) },
    display: [
      ["Type", `${type.toUpperCase()}${form === "mini" ? " · mini (plate mount)" : ""}`],
      ["Poles", POLE_LABEL[p]],
      ["Rating", `${amps} A`],
      ["Curve", hasCurve ? (curve ? curve.toUpperCase() : "-") : "n/a"],
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
  const ampRaw = attrs.Rating ?? rx(text, /(\d+(?:\.\d+)?)\s*a\b/);
  const amps = ampRaw ? String(Number(String(ampRaw).match(/\d+(?:\.\d+)?/)?.[0])) : null;
  // 6 A vs 16 A switches are different products: rating is part of the key
  // for current-carrying devices, and one without a rating never maps.
  if ((type === "switch" || type === "socket") && !amps) return null;

  // Word-form ways too: Norisys writes "One Way" / "Two Way".
  const ways = rx(text, /(\d)\s*[- ]?way/) ?? (/(?:^|\s)one\s*[- ]?way/.test(text) ? "1" : /(?:^|\s)two\s*[- ]?way/.test(text) ? "2" : null);
  const dimW = type === "dimmer" ? rx(text, /(\d{3,4})\s*w(?:atts)?\b/) : null;
  const series = attrs.Series ?? null;
  const smart = isSmart(text);

  const conflicts: Record<string, string> = {};
  if (ways) conflicts.ways = ways;
  if (dimW) conflicts.watts = dimW;
  // Two-sided fields: a special variant must never wildcard beside a normal
  // one (all were live leaks in the audit).
  if (type === "switch") {
    conflicts.twin = /\btwin\b/.test(text) ? "twin" : "single";
    if (conflicts.twin === "twin") conflicts.twincfg = /\+\s*blank/.test(text) ? "with-blank" : "dual";
    conflicts.indicator = /indicator/.test(text) ? "yes" : "no";
    const pole = /\bdp\b|double\s*pole/.test(text) ? "dp" : /\bsp\b|single\s*pole/.test(text) ? "sp" : null;
    if (pole) conflicts.pole = pole;
  }
  if (type === "socket" && amps === "16") {
    // A 6/16 A universal socket accepts both plug tops; a 16 A-only does not.
    conflicts.pins = /6\s*[\/&-]\s*16|universal|3\s*\+\s*2/.test(text) ? "combo" : "16a-only";
  }
  if (type === "usb") {
    const aOut = rx(text, /(\d+(?:\.\d+)?)\s*a\b/) ?? (rx(text, /(\d{3,4})\s*ma\b/) ? String(Number(rx(text, /(\d{3,4})\s*ma\b/)) / 1000) : null);
    if (aOut) conflicts.output = aOut;
  }
  if (type === "dimmer" || type === "regulator" || type === "switch" || type === "socket") {
    conflicts.smart = smart ? "smart" : "std";
  }
  if (type === "plate") {
    // Material vocabulary from the live catalogue; acrylic checked FIRST so
    // "ACR Walnut Wood" (an acrylic plate in walnut finish) is never "wood",
    // and colour phrases ("Steel Grey") never become materials.
    const material = /\bacr\b|acrylic/.test(text) ? "acrylic"
      : /marble/.test(text) ? "marble"
      : /glass/.test(text) ? "glass"
      : /solid\s*aluminium|\baluminium\b(?!\s*(?:grey|gray|finish))/.test(text) ? "aluminium"
      : /teakwood|pinewood|solid\s*wood|wooden/.test(text) ? "wood"
      : /polycarbonate|\bpc\b/.test(text) ? "pc"
      : /\bsteel\b(?!\s*(?:grey|gray))/.test(text) ? "steel"
      : null;
    if (material) conflicts.material = material;
    const orient = /\(v\)|vertical/.test(text) ? "v" : /\(h\)|horizontal/.test(text) ? "h" : null;
    if (orient) conflicts.orient = orient;
  }

  const ratingShown = type === "usb" && conflicts.output ? `${conflicts.output} A output` : amps ? `${amps} A` : dimW ? `${dimW} W` : "-";
  return {
    key: `modular|${type}|${modules}m${type === "switch" || type === "socket" ? `|${amps}a` : ""}`,
    conflicts,
    display: [
      ["Type", `${typeLabel}${conflicts.twin === "twin" ? " (twin)" : ""}${smart ? " · smart" : ""}${conflicts.indicator === "yes" ? " · indicator" : ""}`],
      ["Modules", `${modules} M`],
      ["Rating", ratingShown],
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
