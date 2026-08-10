/**
 * BOQ line-item parser (v1: pasted text + CSV). Fully homegrown - no model
 * calls anywhere in this pipeline (owner rule, Aug 2026).
 *
 * Real contractor BOQs are messy: serial-number columns, merged description
 * cells, quantities written as "500 Mtr", "12 nos", "6 coil", header rows,
 * amount columns that look like quantities. The parser's one job is to turn
 * each line into { description, qty, unit } and STRIP the quantity from the
 * description - the matcher must never see "500 m" inside a wire line, or
 * 500 would be read as a coil length (the recon-documented trap).
 */

export type BoqParsedLine = {
  position: number;
  raw: string;          // the original line, untouched (shown in review UI)
  description: string;  // qty/serial-stripped text the matcher works on
  qty: number | null;
  unit: string | null;  // as written, lowercased: m | nos | coil | set | box...
};

/** Quantity units seen in Indian BOQs, longest-first so "mtrs" wins over "m". */
const UNIT_WORDS = [
  "metres", "meters", "metre", "meter", "mtrs", "mtr", "rmt", "rm",
  "numbers", "number", "nos.", "nos", "no.", "no", "pcs", "pc", "pieces", "piece",
  "coils", "coil", "boxes", "box", "sets", "set", "pkts", "pkt", "packs", "pack",
  "pairs", "pair", "rolls", "roll", "lengths", "length", "units", "unit", "each", "ea",
  "kg", "litres", "ltr", "m",
];
const UNIT_RE = new RegExp(`\\b(${UNIT_WORDS.map((u) => u.replace(".", "\\.")).join("|")})\\b`, "i");

/** Canonical unit buckets the matcher cares about. */
export function canonicalUnit(u: string | null): "m" | "count" | "coil" | "other" | null {
  if (!u) return null;
  const x = u.toLowerCase().replace(/\./g, "");
  if (["m", "mtr", "mtrs", "metre", "metres", "meter", "meters", "rmt", "rm"].includes(x)) return "m";
  if (["nos", "no", "number", "numbers", "pc", "pcs", "piece", "pieces", "unit", "units", "each", "ea"].includes(x)) return "count";
  if (["coil", "coils", "roll", "rolls", "length", "lengths"].includes(x)) return "coil";
  return "other";
}

/** Header rows name columns instead of products - skip them. */
function isHeaderRow(line: string): boolean {
  const l = line.toLowerCase();
  const headerWords = ["description", "qty", "quantity", "unit", "rate", "amount", "sl no", "sl.no", "s.no", "sr no", "sr.no", "item", "particulars", "uom"];
  const hits = headerWords.filter((w) => l.includes(w)).length;
  // Two or more column-name words and no real quantity = a header.
  return hits >= 2 && !/\b\d{2,}\b/.test(l.replace(/\b(sl|sr|s)\.?\s*no\.?\s*\d*\b/g, ""));
}

/** Pull qty+unit out of one line; returns the stripped description too. */
function extractQty(line: string): { description: string; qty: number | null; unit: string | null } {
  let text = line;

  // Leading serial numbers: "12.", "3)", "04 " (only 1-2 digits, else it could be a size).
  text = text.replace(/^\s*\(?\d{1,2}[.)]\s+/, " ");

  // Pattern A: "<qty> <unit>" anywhere - "500 mtr", "12 nos", "6 coil".
  // Prefer the LAST occurrence: descriptions carry sizes early ("2.5 sq mm"),
  // quantities usually trail. "sq mm"/"sqmm" right after the number disqualifies
  // a match - that is a SIZE, not a quantity.
  const qtyUnit = new RegExp(`(\\d+(?:\\.\\d+)?)\\s*(${UNIT_WORDS.map((u) => u.replace(".", "\\.")).join("|")})\\b(?!\\s*(?:sq|²))`, "gi");
  let m: RegExpExecArray | null;
  let last: RegExpExecArray | null = null;
  while ((m = qtyUnit.exec(text)) !== null) {
    const before = text.slice(Math.max(0, m.index - 8), m.index).toLowerCase();
    const after = text.slice(m.index + m[0].length, m.index + m[0].length + 8).toLowerCase();
    // "2.5 sq mm" -> the "mm"/"m" here is part of a size; "sq" sits just before
    // or just after the captured unit. Skip those.
    if (/sq\.?\s*$/.test(before) || /^\s*m\b/.test(after) && m[2].toLowerCase() === "sq") continue;
    if (/^\s*(sq|²)/.test(after)) continue;
    last = m;
  }
  if (last) {
    const qty = Number(last[1]);
    const unit = last[2].toLowerCase();
    // Guard: "1100 v" style ratings never match (v is not a unit word), but a
    // bare "90 m" inside a product name ("90 m coil") could. Only treat it as
    // the quantity when it is not immediately followed by "coil"-like words
    // that mark it as a pack description.
    const tail = text.slice(last.index + last[0].length).trimStart().toLowerCase();
    if (!tail.startsWith("coil") && !tail.startsWith("roll")) {
      text = (text.slice(0, last.index) + " " + text.slice(last.index + last[0].length)).trim();
      return { description: tidy(text), qty: Number.isFinite(qty) ? qty : null, unit };
    }
  }

  // Pattern B: trailing bare number - "MCB 32A C curve   25".
  const bare = text.match(/[\s,;|-](\d{1,4})\s*$/);
  if (bare) {
    return { description: tidy(text.slice(0, bare.index)), qty: Number(bare[1]), unit: null };
  }

  return { description: tidy(text), qty: null, unit: null };
}

const tidy = (s: string) =>
  s.replace(/[|,;]+/g, " ").replace(/\s+/g, " ").trim().replace(/[\s·:–—-]+$/g, "").trim();

/** Parse pasted free text: one BOQ line per text line. */
export function parseBoqText(text: string): BoqParsedLine[] {
  const out: BoqParsedLine[] = [];
  let pos = 0;
  for (const rawLine of text.split(/\r?\n/)) {
    const raw = rawLine.trim();
    if (!raw || raw.length < 3) continue;
    if (isHeaderRow(raw)) continue;
    const { description, qty, unit } = extractQty(raw);
    if (!description || description.length < 3) continue;
    out.push({ position: pos++, raw, description, qty, unit });
    if (out.length >= 200) break; // sanity cap, mirrors the cart's 200-line cap
  }
  return out;
}

/**
 * Parse tabular rows (from CSV via parseCsv, or XLSX via the client-side
 * sheet reader). Column inference: the description column is the one with
 * the longest average text; qty is the most numeric column to its right;
 * unit is a short-text column near qty whose values look like unit words.
 */
export function parseBoqRows(rows: string[][]): BoqParsedLine[] {
  const body = rows.filter((r) => r.some((c) => c && c.trim()));
  if (!body.length) return [];

  // Drop a header row if the first row looks like one.
  const start = isHeaderRow(body[0].join(" ")) ? 1 : 0;
  const data = body.slice(start);
  if (!data.length) return [];

  const cols = Math.max(...data.map((r) => r.length));
  const stats = Array.from({ length: cols }, (_, c) => {
    const vals = data.map((r) => (r[c] ?? "").trim()).filter(Boolean);
    const numeric = vals.filter((v) => /^\d+(?:\.\d+)?$/.test(v)).length;
    const unitish = vals.filter((v) => UNIT_RE.test(v) && v.length <= 8).length;
    const avgLen = vals.length ? vals.reduce((a, v) => a + v.length, 0) / vals.length : 0;
    return { c, n: vals.length, numeric, unitish, avgLen };
  });

  const descCol = stats.reduce((a, b) => (b.avgLen > a.avgLen ? b : a)).c;
  const qtyCol = stats
    .filter((s) => s.c !== descCol && s.n > 0 && s.numeric / s.n > 0.6)
    // rightmost mostly-numeric column BEFORE any rate/amount pair: prefer the
    // one closest to the description to dodge rate/amount columns.
    .sort((a, b) => Math.abs(a.c - descCol) - Math.abs(b.c - descCol))[0]?.c;
  const unitCol = stats.filter((s) => s.c !== descCol && s.c !== qtyCol && s.n > 0 && s.unitish / s.n > 0.5)[0]?.c;

  const out: BoqParsedLine[] = [];
  let pos = 0;
  for (const r of data) {
    const rawDesc = (r[descCol] ?? "").trim();
    if (!rawDesc || rawDesc.length < 3 || isHeaderRow(rawDesc)) continue;
    const qtyRaw = qtyCol != null ? (r[qtyCol] ?? "").trim() : "";
    const unitRaw = unitCol != null ? (r[unitCol] ?? "").trim() : "";
    // The description cell may still embed its own qty when columns are messy.
    const inCell = extractQty(rawDesc);
    const qty = qtyRaw && /^\d+(?:\.\d+)?$/.test(qtyRaw) ? Number(qtyRaw) : inCell.qty;
    const unit = (unitRaw || inCell.unit || null)?.toLowerCase() ?? null;
    // Always use the qty-stripped description: stripping is idempotent, and a
    // messy sheet can carry the qty both in its own column AND in the cell.
    out.push({ position: pos++, raw: r.filter(Boolean).join(" | "), description: inCell.description, qty, unit });
    if (out.length >= 200) break;
  }
  return out;
}
