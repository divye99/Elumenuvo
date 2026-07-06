/**
 * Bulk catalogue import/export via CSV (opens natively in Excel / Google
 * Sheets — no dependency). One canonical column order; the first column is the
 * Action (Add / Update / Remove / blank=skip). Attribute columns (size, length,
 * colour, quality, pack) map into the product's `attrs` jsonb so packaging is
 * first-class in the sheet.
 */
import type { ProductRow } from "@/lib/admin/data";

/** Canonical spreadsheet columns, in order. */
export const IMPORT_COLUMNS = [
  "action",
  "id",
  "sku",
  "name",
  "brand",
  "category",
  "spec",
  "mrp",
  "elume_price",
  "unit",
  "size",
  "length",
  "colour",
  "quality",
  "pack",
  "parent_id",
  "sort_order",
  "is_active",
  "image_url",
] as const;

export type ImportColumn = (typeof IMPORT_COLUMNS)[number];
export type Action = "add" | "update" | "remove";

/** attrs keys that get their own spreadsheet column. */
const ATTR_COLUMNS: Record<string, string> = {
  size: "Size",
  length: "Length",
  colour: "Colour",
  quality: "Quality",
  pack: "Pack",
};

export type ParsedRow = {
  action: Action | "";
  values: Record<ImportColumn, string>;
  rowNumber: number; // 1-based data row (excludes header)
};

/* ─────────────────────────── CSV primitives ─────────────────────────── */

function csvCell(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** RFC-4180-ish parser: handles quoted fields, escaped quotes, CRLF. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  // Strip a UTF-8 BOM if Excel added one.
  const s = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') { cell += '"'; i++; }
        else inQuotes = false;
      } else cell += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
    else if (c === "\r") { /* handled by \n; ignore lone CR */ }
    else cell += c;
  }
  // trailing cell/row (no final newline)
  if (cell.length > 0 || row.length > 0) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((v) => v.trim() !== ""));
}

/* ─────────────────────────── Export ─────────────────────────── */

function rowToCsvValues(p: ProductRow, action: string): (string | number)[] {
  const a = p.attrs ?? {};
  return [
    action,
    p.id,
    p.sku,
    p.name,
    p.brand,
    p.category,
    p.spec ?? "",
    p.mrp,
    p.elume_price,
    p.unit,
    a.Size ?? "",
    a.Length ?? "",
    a.Colour ?? "",
    a.Quality ?? "",
    a.Pack ?? "",
    p.parent_id ?? "",
    p.sort_order,
    p.is_active ? "yes" : "no",
    p.image_url ?? "",
  ];
}

/** Whole catalogue as a CSV string, one row per product, Action blank (so an
 *  untouched download is a no-op if re-uploaded). */
export function catalogueToCsv(rows: ProductRow[]): string {
  const lines = [IMPORT_COLUMNS.join(",")];
  for (const p of rows) lines.push(rowToCsvValues(p, "").map(csvCell).join(","));
  return lines.join("\r\n");
}

/** A tiny starter template with one example of each action. */
export function sampleCsv(rows: ProductRow[]): string {
  const example = rows[0];
  const lines = [IMPORT_COLUMNS.join(",")];
  if (example) {
    lines.push(rowToCsvValues({ ...example }, "update").map(csvCell).join(","));
  }
  // A blank Add template row + a Remove example (commented via example id).
  lines.push(
    ["add", "poly-frls-2.5-org", "POLY-FRLS-2.5-ORG", "FRLS Wire 2.5 sq mm — Orange", "Polycab", "Wires & Cables", "90 m coil · 1100 V", "1995", "1842", "coil", "2.5 sq mm", "90 m", "Orange", "FRLS", "", "poly25", "250", "yes", ""].map(csvCell).join(",")
  );
  return lines.join("\r\n");
}

/* ─────────────────────────── Import parse ─────────────────────────── */

const NORMALISE_ACTION: Record<string, Action | ""> = {
  add: "add", new: "add", create: "add", insert: "add",
  update: "update", edit: "update", change: "update", upsert: "update",
  remove: "remove", delete: "remove", del: "remove",
  "": "",
};

export type Diff = {
  action: Action;
  id: string;
  rowNumber: number;
  /** Human summary of what changes (for the confirm screen). */
  summary: string;
  /** Field-level before→after for update/add. */
  changes: { field: string; from: string; to: string }[];
  /** The db row to upsert (add/update) — assembled, or null for remove. */
  payload: Record<string, unknown> | null;
  error?: string;
};

export function diffFromCsv(text: string, existing: ProductRow[]): { diffs: Diff[]; errors: string[] } {
  const grid = parseCsv(text);
  const errors: string[] = [];
  if (grid.length === 0) return { diffs: [], errors: ["The file is empty."] };

  const header = grid[0].map((h) => h.trim().toLowerCase());
  const colIndex = (name: ImportColumn) => header.indexOf(name);
  if (colIndex("action") === -1) errors.push('Missing an "action" column in the header row.');
  if (colIndex("id") === -1) errors.push('Missing an "id" column in the header row.');
  if (errors.length) return { diffs: [], errors };

  const byId = new Map(existing.map((p) => [p.id, p]));
  const get = (cells: string[], name: ImportColumn) => {
    const i = colIndex(name);
    return i === -1 ? "" : (cells[i] ?? "").trim();
  };

  const diffs: Diff[] = [];
  for (let r = 1; r < grid.length; r++) {
    const cells = grid[r];
    const rowNumber = r; // 1-based data row
    const rawAction = get(cells, "action").toLowerCase();
    const action = NORMALISE_ACTION[rawAction];
    if (action === "" || action === undefined) {
      if (action === undefined) errors.push(`Row ${rowNumber}: unknown action "${rawAction}" (use Add / Update / Remove).`);
      continue; // blank action = skip
    }
    const id = get(cells, "id");
    if (!id) { errors.push(`Row ${rowNumber}: missing id.`); continue; }
    const current = byId.get(id);

    if (action === "remove") {
      if (!current) { errors.push(`Row ${rowNumber}: can't remove "${id}" — not in the catalogue.`); continue; }
      diffs.push({ action, id, rowNumber, summary: `Remove ${current.name} (${id})`, changes: [], payload: null });
      continue;
    }

    if (action === "add" && current) { errors.push(`Row ${rowNumber}: "${id}" already exists — use Update, not Add.`); continue; }
    if (action === "update" && !current) { errors.push(`Row ${rowNumber}: "${id}" doesn't exist — use Add, not Update.`); continue; }

    // Assemble attrs from the attribute columns (fall back to current attrs).
    const attrs: Record<string, string> = { ...(current?.attrs ?? {}) };
    for (const [col, key] of Object.entries(ATTR_COLUMNS)) {
      const v = get(cells, col as ImportColumn);
      if (v) attrs[key] = v;
      else if (colIndex(col as ImportColumn) !== -1 && v === "") delete attrs[key];
    }

    const num = (name: ImportColumn, fallback: number) => {
      const v = get(cells, name);
      if (v === "") return fallback;
      const n = Number(v.replace(/[₹,]/g, ""));
      return Number.isFinite(n) ? n : fallback;
    };
    const str = (name: ImportColumn, fallback: string) => {
      const i = colIndex(name);
      if (i === -1) return fallback;
      const v = (cells[i] ?? "").trim();
      return v === "" && action === "update" ? fallback : v;
    };
    const boolCell = (name: ImportColumn, fallback: boolean) => {
      const v = get(cells, name).toLowerCase();
      if (v === "") return fallback;
      return ["yes", "true", "1", "active", "y"].includes(v);
    };

    const payload = {
      id,
      sku: str("sku", current?.sku ?? id.toUpperCase()),
      name: str("name", current?.name ?? ""),
      brand: str("brand", current?.brand ?? ""),
      category: str("category", current?.category ?? ""),
      spec: str("spec", current?.spec ?? "") || null,
      mrp: num("mrp", current?.mrp ?? 0),
      elume_price: num("elume_price", current?.elume_price ?? 0),
      unit: str("unit", current?.unit ?? "pc") || "pc",
      parent_id: str("parent_id", current?.parent_id ?? "") || null,
      sort_order: num("sort_order", current?.sort_order ?? 0),
      is_active: boolCell("is_active", current?.is_active ?? true),
      image_url: str("image_url", current?.image_url ?? "") || null,
      attrs: Object.keys(attrs).length ? attrs : null,
    };

    // Validation for adds.
    const missing: string[] = [];
    if (!payload.name) missing.push("name");
    if (!payload.brand) missing.push("brand");
    if (!payload.category) missing.push("category");
    if (!(payload.mrp > 0)) missing.push("mrp");
    if (!(payload.elume_price > 0)) missing.push("elume_price");
    if (missing.length) { errors.push(`Row ${rowNumber} (${id}): missing/invalid ${missing.join(", ")}.`); continue; }

    // Field-level changes for the confirm screen.
    const changes: { field: string; from: string; to: string }[] = [];
    if (action === "update" && current) {
      const cmp: [string, string, string][] = [
        ["name", current.name, payload.name],
        ["brand", current.brand, payload.brand],
        ["category", current.category, payload.category],
        ["spec", current.spec ?? "", payload.spec ?? ""],
        ["mrp", String(current.mrp), String(payload.mrp)],
        ["elume_price", String(current.elume_price), String(payload.elume_price)],
        ["unit", current.unit, payload.unit],
        ["length", current.attrs?.Length ?? "", attrs.Length ?? ""],
        ["size", current.attrs?.Size ?? "", attrs.Size ?? ""],
        ["colour", current.attrs?.Colour ?? "", attrs.Colour ?? ""],
        ["pack", current.attrs?.Pack ?? "", attrs.Pack ?? ""],
        ["sort_order", String(current.sort_order), String(payload.sort_order)],
        ["is_active", current.is_active ? "yes" : "no", payload.is_active ? "yes" : "no"],
      ];
      for (const [field, from, to] of cmp) if (from !== to) changes.push({ field, from, to });
    }

    const summary =
      action === "add"
        ? `Add ${payload.name} (${id}) · MRP ₹${payload.mrp} · Elume ₹${payload.elume_price}`
        : changes.length
          ? `Update ${payload.name}: ${changes.map((c) => c.field).join(", ")}`
          : `No change to ${payload.name}`;

    diffs.push({ action, id, rowNumber, summary, changes, payload });
  }

  // Drop no-op updates so the confirm screen only shows real changes.
  const meaningful = diffs.filter((d) => d.action !== "update" || d.changes.length > 0);
  return { diffs: meaningful, errors };
}

/** Human-readable packaging label from a product's attrs + unit. */
export function packagingLabel(row: Pick<ProductRow, "attrs" | "unit">): string {
  const a = row.attrs ?? {};
  const bits: string[] = [];
  if (a.Length) bits.push(a.Length);
  if (a.Size) bits.push(a.Size);
  if (a.Pack) bits.push(`pack of ${a.Pack.replace(/[^0-9]/g, "") || a.Pack}`);
  if (bits.length === 0) return `per ${row.unit}`;
  return `${bits.join(" · ")} / ${row.unit}`;
}
