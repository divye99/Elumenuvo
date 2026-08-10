/**
 * Smart BOM matcher smoke test - run with:
 *   npx tsx scripts/test-boq-matcher.ts
 * Feeds realistic messy BOQ lines through the REAL parse+match pipeline
 * against the LIVE catalogue and prints what each line resolves to, so
 * accuracy is inspected line by line before anything ships.
 */
import { parseBoqText } from "../src/lib/boq/parse";
import { buildBoqIndex, matchBoqLine } from "../src/lib/boq/match";
import { fetchProducts } from "../src/lib/products";

const SAMPLE = `
Sl No | Description | Qty
1. 2.5 sqmm FRLS copper wire red Polycab - 500 mtr
2. 1.5 sq mm FR house wire green earth - 270 m
3. MCB 32A C curve SP Havells - 12 nos
4. RCCB 40A 30mA double pole - 2 nos
5. 6A one way switch white Roma - 48 nos
6. Cieling fan 1200mm BLDC with remote - 6 no
7. LED bulb 9w b22 - 24 pcs
8. geyser 15 ltr storage 5 star - 2 nos
9. ABB SB201 C32 mini circuit breaker - 4 nos
10. 20W LED batten 4ft coolwhite - 10 nos
11. PVC casing capping 25mm - 40 lengths
12. 1SDA066725R1 - 1 no
`;

(async () => {
  const products = await fetchProducts();
  console.log(`catalogue: ${products.length} products`);
  const index = buildBoqIndex(products);
  const lines = parseBoqText(SAMPLE);
  console.log(`parsed: ${lines.length} lines\n`);
  for (const line of lines) {
    const m = matchBoqLine(line, index, new Map());
    const p = m.productId ? index.byId.get(m.productId) : null;
    console.log(`LINE: ${line.raw}`);
    console.log(`  parsed -> desc="${line.description}" qty=${line.qty} unit=${line.unit}`);
    console.log(`  match  -> ${p ? `${p.name} [${p.brand}] ₹${p.price}/${p.unit}` : "UNMATCHED"}`);
    console.log(`  conf=${(m.confidence * 100).toFixed(0)}% method=${m.method} finalQty=${m.finalQty}${m.qtyNote ? ` (${m.qtyNote})` : ""} alts=${m.alternates.length}\n`);
  }
})();
