/**
 * ELIN - Elume Identification Number. Our ASIN: the permanent, opaque,
 * never-reused identifier every product carries alongside the manufacturer's
 * brand_sku (migration 0116).
 *
 * Two namespaces, both 10 characters:
 *   - General:      "E" + 9 chars from ELIN_ALPHABET   e.g. E7K4M9XQ2B
 *   - Elume brand:  "ELUME" + 5-digit sequence         e.g. ELUME00001
 *
 * The alphabet has no 0/O, 1/I/L or U, so a code read over the phone or off a
 * printed invoice cannot be mistyped; L and U being absent also means a
 * general ELIN can never collide with the ELUME namespace.
 *
 * General ELINs derive deterministically from md5 of the product's original
 * id (SQL in 0116, scripts/lib/elin.mjs for import generators - the two
 * implementations MUST stay in lockstep). Elume-brand products number
 * sequentially: the next one is max(ELUME#####) + 1.
 *
 * This file is client-safe (validators only, no crypto import).
 */

export const ELIN_ALPHABET = "234679CDFGHJKMPR";

const GENERAL = /^E[234679CDFGHJKMPR]{9}$/;
const HOUSE = /^ELUME\d{5}$/;

/** True if the string is a well-formed ELIN (either namespace). */
export function isElin(s: string | null | undefined): boolean {
  if (!s) return false;
  const v = s.trim().toUpperCase();
  return GENERAL.test(v) || HOUSE.test(v);
}

/** Canonical form: trimmed, uppercased. */
export function normalizeElin(s: string): string {
  return s.trim().toUpperCase();
}

/** Loose code equality for search: ignores case and internal whitespace, so
 *  "r-fs 001" matches brand_sku "R-FS 001" and "e7k4m9xq2b" matches an ELIN. */
export function codeEquals(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const norm = (x: string) => x.replace(/\s+/g, "").toUpperCase();
  return norm(a) === norm(b);
}
