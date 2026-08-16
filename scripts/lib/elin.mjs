// ELIN generator for import scripts - MUST mirror the SQL in migration 0116:
//   'E' || translate(upper(substr(md5(id), 1+9*depth, 9)),
//                    '0123456789ABCDEF', '234679CDFGHJKMPR')
// so a product's ELIN is identical whether assigned by backfill or by an
// import generator working from the same seed string.
import { createHash } from "node:crypto";

const HEX = "0123456789ABCDEF";
const MAP = "234679CDFGHJKMPR";

export function elinFromId(seed, depth = 0) {
  const hex = createHash("md5").update(seed).digest("hex").toUpperCase();
  const seg = hex.slice(depth * 9, depth * 9 + 9);
  if (seg.length < 9) throw new Error(`elin depth ${depth} exhausted for ${seed}`);
  let out = "E";
  for (const ch of seg) out += MAP[HEX.indexOf(ch)];
  return out;
}

/** Assign unique ELINs for a list of seed strings; deepens the hash segment on
 *  the (astronomically rare) collision. Returns Map(seed -> elin). */
export function assignElins(seeds, taken = new Set()) {
  const out = new Map();
  for (const seed of seeds) {
    let depth = 0;
    let e = elinFromId(seed, depth);
    while (taken.has(e)) e = elinFromId(seed, ++depth);
    taken.add(e);
    out.set(seed, e);
  }
  return out;
}
