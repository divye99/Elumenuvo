/**
 * Invoice engine - GST-compliant PDFs for the admin orders console.
 *
 * Two documents, one layout:
 *  - TAX INVOICE (CGST Rules, Rule 46): sequential FY-wise number
 *    (EN/2026-27/0001 via assign_invoice_no RPC, migration 0111), HSN/SAC per
 *    line, taxable value + tax split, rate-wise tax summary, amount in words.
 *  - PROFORMA INVOICE: same body, numbered PI/<order-id>, explicitly marked
 *    "not a tax invoice". Never consumes a sequential number.
 *
 * Tax arithmetic mirrors the checkout exactly (order-actions.ts):
 *  - item prices are GST-INCLUSIVE; taxable value = incl / (1 + rate)
 *  - a discount applies to goods only, scaling every line proportionally
 *  - shipping is its own line (SAC 9968, courier) at 18%, never in the split
 *  - place of supply = delivery state; intra-UP orders split CGST+SGST,
 *    everything else is IGST (supplier registered in Uttar Pradesh, code 09)
 *  - a round-off line absorbs paise drift so the grand total equals
 *    orders.total to the paisa - what Razorpay actually captured.
 *
 * Amounts print as "Rs." - the PDF standard fonts (WinAnsi) cannot encode the
 * rupee glyph, and embedding a font for one symbol is not worth the bytes.
 */
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { COMPANY, officeLine } from "@/lib/company";
import { gstRateFor } from "@/lib/pricing";
import { GST_STATE_BY_CODE } from "@/lib/gstin";

/* ── Model ─────────────────────────────────────────────────────────── */

export type InvoiceOrder = {
  id: string;
  created_at: string;
  name: string | null;
  email: string;
  phone: string | null;
  gstin: string | null;
  billing_address: string | null;
  shipping_address: string | null;
  payment_method: string | null;
  items: { id: string; name: string; qty: number; price?: number; cat?: string; gstRate?: number; hsn?: string }[];
  total: number | null;
  shipping_fee?: number | null;
  discount_code?: string | null;
  discount_amount?: number | null;
  address_details?: { shipping?: { state?: string }; billing?: { state?: string } } | null;
};

export type InvoiceLine = {
  name: string;
  hsn: string;
  qty: number;
  rateEx: number;     // per-unit ex-GST, after discount scaling
  taxable: number;    // line taxable value
  gstRate: number;    // 0.18
  tax: number;        // line tax amount
  total: number;      // line GST-inclusive total
};

export type InvoiceModel = {
  kind: "tax" | "proforma";
  number: string;
  date: Date;
  order: InvoiceOrder;
  intraState: boolean;
  placeOfSupply: string;      // "Uttar Pradesh (09)"
  lines: InvoiceLine[];
  taxableTotal: number;
  cgst: number; sgst: number; igst: number;
  rateSummary: { rate: number; taxable: number; tax: number }[];
  discountNote: string | null;
  roundOff: number;
  grandTotal: number;
};

const SELLER_STATE_CODE = "09"; // Uttar Pradesh (registered office, Hapur)
const SHIPPING_SAC = "9968";    // postal & courier services
const SHIPPING_GST = 0.18;

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Financial year label for a date in IST, e.g. "2026-27". */
export function fyLabel(d: Date): string {
  const ist = new Date(d.getTime() + 330 * 60 * 1000);
  const y = ist.getUTCFullYear();
  const start = ist.getUTCMonth() + 1 >= 4 ? y : y - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}

/** Delivery-state GST code: structured address first, then a state-name scan
 *  of the free-text address, then the buyer GSTIN's own registration state. */
function placeOfSupplyCode(o: InvoiceOrder): string | null {
  const stated = o.address_details?.shipping?.state?.trim();
  const hay = (stated || o.shipping_address || "").toLowerCase();
  if (hay) {
    // Longest name first so "Dadra and Nagar Haveli and Daman and Diu" beats "Daman and Diu".
    const entries = Object.entries(GST_STATE_BY_CODE).sort((a, b) => b[1].length - a[1].length);
    for (const [code, name] of entries) if (hay.includes(name.toLowerCase())) return code;
  }
  const g = o.gstin?.trim();
  if (g && g.length >= 2 && GST_STATE_BY_CODE[g.slice(0, 2)]) return g.slice(0, 2);
  return null;
}

export function buildInvoiceModel(o: InvoiceOrder, kind: "tax" | "proforma", number: string, date: Date): InvoiceModel {
  const items = (o.items ?? []).filter((i) => i.price != null && i.price > 0);
  const shippingFee = r2(Number(o.shipping_fee ?? 0));
  const discount = r2(Number(o.discount_amount ?? 0));
  const goodsGross = r2(items.reduce((s, i) => s + i.price! * i.qty, 0));
  const scale = discount > 0 && goodsGross > 0 ? (goodsGross - discount) / goodsGross : 1;

  const posCode = placeOfSupplyCode(o);
  const intraState = posCode === SELLER_STATE_CODE;
  const placeOfSupply = posCode ? `${GST_STATE_BY_CODE[posCode]} (${posCode})` : "As per delivery address";

  const lines: InvoiceLine[] = items.map((i) => {
    const rate = gstRateFor(i.cat, i.gstRate);
    const incl = r2(i.price! * i.qty * scale);
    const taxable = r2(incl / (1 + rate));
    return {
      name: i.name, hsn: i.hsn?.trim() || "-", qty: i.qty,
      rateEx: r2(taxable / i.qty), taxable, gstRate: rate, tax: r2(incl - taxable), total: incl,
    };
  });
  if (shippingFee > 0) {
    const taxable = r2(shippingFee / (1 + SHIPPING_GST));
    lines.push({
      name: "Delivery & freight (courier)", hsn: SHIPPING_SAC, qty: 1,
      rateEx: taxable, taxable, gstRate: SHIPPING_GST, tax: r2(shippingFee - taxable), total: shippingFee,
    });
  }

  const taxableTotal = r2(lines.reduce((s, l) => s + l.taxable, 0));
  const taxTotal = r2(lines.reduce((s, l) => s + l.tax, 0));
  const linesTotal = r2(lines.reduce((s, l) => s + l.total, 0));
  const grandTotal = o.total != null ? r2(Number(o.total)) : linesTotal;
  const roundOff = r2(grandTotal - linesTotal);

  const byRate = new Map<number, { taxable: number; tax: number }>();
  for (const l of lines) {
    const e = byRate.get(l.gstRate) ?? { taxable: 0, tax: 0 };
    e.taxable = r2(e.taxable + l.taxable); e.tax = r2(e.tax + l.tax);
    byRate.set(l.gstRate, e);
  }

  return {
    kind, number, date, order: o, intraState, placeOfSupply, lines,
    taxableTotal,
    cgst: intraState ? r2(taxTotal / 2) : 0,
    sgst: intraState ? r2(taxTotal - r2(taxTotal / 2)) : 0,
    igst: intraState ? 0 : taxTotal,
    rateSummary: [...byRate.entries()].map(([rate, e]) => ({ rate, ...e })).sort((a, b) => a.rate - b.rate),
    discountNote: discount > 0 ? `Line values are net of discount${o.discount_code ? ` ${o.discount_code}` : ""} (Rs. ${fmtAmt(discount)} off goods).` : null,
    roundOff, grandTotal,
  };
}

/* ── Formatting ────────────────────────────────────────────────────── */

/** Indian-grouped amount: 123456.7 -> "1,23,456.70". */
export function fmtAmt(n: number): string {
  const neg = n < 0; const v = Math.abs(n);
  const [int, dec] = v.toFixed(2).split(".");
  const head = int.slice(0, -3); const tail = int.slice(-3);
  const grouped = head ? head.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + tail : tail;
  return `${neg ? "-" : ""}${grouped}.${dec}`;
}

const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
function twoDigits(n: number): string { return n < 20 ? ONES[n] : `${TENS[Math.floor(n / 10)]}${n % 10 ? " " + ONES[n % 10] : ""}`; }
function threeDigits(n: number): string {
  const h = Math.floor(n / 100); const rest = n % 100;
  return [h ? `${ONES[h]} Hundred` : "", twoDigits(rest)].filter(Boolean).join(" ");
}
/** Indian-system amount in words: 1234567.89 -> "Rupees Twelve Lakh Thirty Four Thousand ... and Eighty Nine Paise Only". */
export function amountInWords(n: number): string {
  const rupees = Math.floor(Math.abs(n));
  const paise = Math.round((Math.abs(n) - rupees) * 100);
  if (rupees === 0 && paise === 0) return "Rupees Zero Only";
  const crore = Math.floor(rupees / 1e7);
  const lakh = Math.floor((rupees % 1e7) / 1e5);
  const thousand = Math.floor((rupees % 1e5) / 1e3);
  const rest = rupees % 1e3;
  const words = [
    crore ? `${twoDigits(crore)} Crore` : "",
    lakh ? `${twoDigits(lakh)} Lakh` : "",
    thousand ? `${twoDigits(thousand)} Thousand` : "",
    rest ? threeDigits(rest) : "",
  ].filter(Boolean).join(" ");
  const paiseWords = paise ? `${twoDigits(paise)} Paise` : "";
  return `Rupees ${[words || "Zero", paiseWords].filter(Boolean).join(" and ")} Only`;
}

/* ── PDF rendering ─────────────────────────────────────────────────── */

const A4: [number, number] = [595.28, 841.89];
const MARGIN = 40;
const INK = rgb(0.098, 0.125, 0.18);      // #19202E
const MUTED = rgb(0.42, 0.46, 0.55);
const LINE = rgb(0.88, 0.9, 0.94);
const PANEL = rgb(0.955, 0.965, 0.98);

export async function renderInvoicePdf(m: InvoiceModel): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const title = m.kind === "tax" ? "TAX INVOICE" : "PROFORMA INVOICE";
  doc.setTitle(`${title} ${m.number} - ${COMPANY.legalName}`);

  let page = doc.addPage(A4);
  let y = A4[1] - MARGIN;
  const W = A4[0] - MARGIN * 2;

  const text = (p: PDFPage, s: string, x: number, yy: number, size: number, f: PDFFont = font, color = INK) =>
    p.drawText(s, { x, y: yy, size, font: f, color });
  const right = (p: PDFPage, s: string, xEnd: number, yy: number, size: number, f: PDFFont = font, color = INK) =>
    p.drawText(s, { x: xEnd - f.widthOfTextAtSize(s, size), y: yy, size, font: f, color });
  const hr = (p: PDFPage, yy: number, x1 = MARGIN, x2 = A4[0] - MARGIN, color = LINE) =>
    p.drawLine({ start: { x: x1, y: yy }, end: { x: x2, y: yy }, thickness: 0.7, color });
  const clip = (s: string, f: PDFFont, size: number, max: number) => {
    if (f.widthOfTextAtSize(s, size) <= max) return s;
    let out = s;
    while (out.length > 1 && f.widthOfTextAtSize(out + "...", size) > max) out = out.slice(0, -1);
    return out + "...";
  };
  // WinAnsi cannot encode every glyph that reaches an order (product names
  // carry ², Ø, arrows...); replace what the font cannot draw.
  const safe = (s: string) => s.replace(/²/g, "2").replace(/[^\x20-\x7E -ÿ]/g, "-");

  /* Header */
  text(page, COMPANY.tradingName.toUpperCase(), MARGIN, y - 16, 21, bold);
  text(page, COMPANY.legalName, MARGIN, y - 30, 9.5, bold);
  text(page, officeLine(COMPANY.registeredOffice), MARGIN, y - 42, 8, font, MUTED);
  text(page, `GSTIN: ${COMPANY.gstin || "-"}    CIN: ${COMPANY.cin}`, MARGIN, y - 53, 8, font, MUTED);
  text(page, `${COMPANY.email}  ·  ${COMPANY.phoneDisplay}  ·  elumenuvo.com`, MARGIN, y - 64, 8, font, MUTED);
  right(page, title, A4[0] - MARGIN, y - 18, 15, bold);
  right(page, m.kind === "tax" ? "ORIGINAL FOR RECIPIENT" : "NOT A TAX INVOICE", A4[0] - MARGIN, y - 31, 7.5, font, MUTED);
  y -= 74;
  hr(page, y);

  /* Meta grid */
  const meta: [string, string][] = [
    ["Invoice no.", m.number],
    ["Invoice date", m.date.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric" })],
    ["Order no.", m.order.id],
    ["Order date", new Date(m.order.created_at).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric" })],
    ["Place of supply", m.placeOfSupply],
    ["Reverse charge", "No"],
    ["Payment", m.order.payment_method === "online" ? "Paid online (Razorpay)" : m.order.payment_method || "-"],
  ];
  y -= 14;
  meta.forEach(([k, v], i) => {
    const col = i % 2; const row = Math.floor(i / 2);
    const x = MARGIN + col * (W / 2);
    text(page, k, x, y - row * 13, 7.5, font, MUTED);
    text(page, clip(safe(v), bold, 8.5, W / 2 - 80), x + 78, y - row * 13, 8.5, bold);
  });
  y -= Math.ceil(meta.length / 2) * 13 + 6;
  hr(page, y);

  /* Bill to / Ship to */
  y -= 15;
  const addrBlock = (label: string, name: string | null, addr: string | null, gstin: string | null, x: number) => {
    text(page, label, x, y, 7.5, bold, MUTED);
    let yy = y - 12;
    if (name) { text(page, clip(safe(name), bold, 9, W / 2 - 20), x, yy, 9, bold); yy -= 11; }
    for (const lineTxt of wrap(safe(addr ?? "-"), font, 8, W / 2 - 24).slice(0, 4)) { text(page, lineTxt, x, yy, 8, font, MUTED); yy -= 10; }
    if (gstin) { text(page, `GSTIN: ${gstin}`, x, yy, 8, bold); yy -= 10; }
    return yy;
  };
  const wrap = (s: string, f: PDFFont, size: number, max: number): string[] => {
    const words = s.split(/\s+/); const out: string[] = []; let cur = "";
    for (const w of words) {
      const next = cur ? `${cur} ${w}` : w;
      if (f.widthOfTextAtSize(next, size) > max && cur) { out.push(cur); cur = w; } else cur = next;
    }
    if (cur) out.push(cur);
    return out;
  };
  const y1 = addrBlock("BILL TO", m.order.name, m.order.billing_address, m.order.gstin, MARGIN);
  const y2 = addrBlock("SHIP TO", m.order.name, m.order.shipping_address, null, MARGIN + W / 2 + 8);
  y = Math.min(y1, y2) - 6;
  hr(page, y);

  /* Items table */
  const cols = m.intraState
    ? [
        { h: "#", w: 16, align: "l" }, { h: "Description", w: 141, align: "l" }, { h: "HSN/SAC", w: 40, align: "l" },
        { h: "Qty", w: 26, align: "r" }, { h: "Rate", w: 50, align: "r" }, { h: "Taxable", w: 54, align: "r" },
        { h: "GST%", w: 28, align: "r" }, { h: "CGST", w: 50, align: "r" }, { h: "SGST", w: 50, align: "r" }, { h: "Total", w: 60, align: "r" },
      ]
    : [
        { h: "#", w: 16, align: "l" }, { h: "Description", w: 169, align: "l" }, { h: "HSN/SAC", w: 42, align: "l" },
        { h: "Qty", w: 28, align: "r" }, { h: "Rate", w: 54, align: "r" }, { h: "Taxable", w: 58, align: "r" },
        { h: "GST%", w: 30, align: "r" }, { h: "IGST", w: 56, align: "r" }, { h: "Total", w: 62, align: "r" },
      ];
  const colX: number[] = []; { let x = MARGIN; for (const c of cols) { colX.push(x); x += c.w; } }
  const cell = (p: PDFPage, i: number, s: string, yy: number, f: PDFFont = font, color = INK, size = 7.8) => {
    const c = cols[i];
    if (c.align === "r") right(p, s, colX[i] + c.w - 3, yy, size, f, color);
    else text(p, clip(s, f, size, c.w - 6), colX[i] + (i === 0 ? 0 : 2), yy, size, f, color);
  };
  const tableHead = (p: PDFPage, yy: number) => {
    p.drawRectangle({ x: MARGIN - 2, y: yy - 4, width: W + 4, height: 15, color: PANEL });
    cols.forEach((c, i) => cell(p, i, c.h, yy, bold, MUTED, 7.3));
    return yy - 16;
  };
  y -= 16;
  y = tableHead(page, y);
  let n = 0;
  for (const l of m.lines) {
    if (y < 150) { // room for totals? new page for remaining rows
      page = doc.addPage(A4); y = A4[1] - MARGIN;
      text(page, `${title} ${m.number} (continued)`, MARGIN, y - 10, 9, bold); y -= 26;
      y = tableHead(page, y);
    }
    n += 1;
    const half = r2(l.tax / 2);
    cell(page, 0, String(n), y);
    cell(page, 1, safe(l.name), y);
    cell(page, 2, l.hsn, y);
    cell(page, 3, String(l.qty), y);
    cell(page, 4, fmtAmt(l.rateEx), y);
    cell(page, 5, fmtAmt(l.taxable), y);
    cell(page, 6, `${Math.round(l.gstRate * 100)}%`, y);
    if (m.intraState) {
      cell(page, 7, fmtAmt(half), y);
      cell(page, 8, fmtAmt(r2(l.tax - half)), y);
      cell(page, 9, fmtAmt(l.total), y);
    } else {
      cell(page, 7, fmtAmt(l.tax), y);
      cell(page, 8, fmtAmt(l.total), y);
    }
    y -= 13;
  }
  hr(page, y + 9);

  /* Totals - right block; rate summary - left block */
  y -= 6;
  const totalsX = MARGIN + W * 0.55;
  const trow = (k: string, v: string, emph = false) => {
    text(page, k, totalsX, y, emph ? 9.5 : 8.2, emph ? bold : font, emph ? INK : MUTED);
    right(page, v, A4[0] - MARGIN, y, emph ? 9.5 : 8.2, emph ? bold : font);
    y -= emph ? 15 : 12;
  };
  const sumY = y;
  trow("Taxable value", `Rs. ${fmtAmt(m.taxableTotal)}`);
  if (m.intraState) {
    trow("CGST", `Rs. ${fmtAmt(m.cgst)}`);
    trow("SGST/UTGST", `Rs. ${fmtAmt(m.sgst)}`);
  } else {
    trow("IGST", `Rs. ${fmtAmt(m.igst)}`);
  }
  if (m.roundOff !== 0) trow("Round off", `Rs. ${fmtAmt(m.roundOff)}`);
  page.drawRectangle({ x: totalsX - 6, y: y - 4, width: A4[0] - MARGIN - totalsX + 8, height: 16, color: PANEL });
  trow("Grand total", `Rs. ${fmtAmt(m.grandTotal)}`, true);

  // Rate-wise tax summary (left of the totals block)
  let ly = sumY;
  text(page, "TAX SUMMARY", MARGIN, ly, 7.5, bold, MUTED); ly -= 11;
  for (const rsum of m.rateSummary) {
    const label = m.intraState
      ? `${Math.round(rsum.rate * 100)}% (CGST ${(rsum.rate * 50).toFixed(1)}% + SGST ${(rsum.rate * 50).toFixed(1)}%)`
      : `IGST ${Math.round(rsum.rate * 100)}%`;
    text(page, `${label}  on Rs. ${fmtAmt(rsum.taxable)}  =  Rs. ${fmtAmt(rsum.tax)}`, MARGIN, ly, 7.8, font, MUTED);
    ly -= 10;
  }
  if (m.discountNote) { text(page, m.discountNote, MARGIN, ly, 7.8, font, MUTED); ly -= 10; }
  y = Math.min(y, ly) - 8;

  /* Amount in words */
  hr(page, y + 4);
  y -= 8;
  text(page, "Amount in words:", MARGIN, y, 7.5, bold, MUTED);
  for (const lineTxt of wrap(amountInWords(m.grandTotal), bold, 8.5, W - 90)) { text(page, lineTxt, MARGIN + 78, y, 8.5, bold); y -= 11; }
  y -= 4;

  /* Footer: declaration + signatory */
  const decl = m.kind === "tax"
    ? "Declaration: We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct. Goods once sold are subject to our published return policy (elumenuvo.com/returns). Subject to Hapur, Uttar Pradesh jurisdiction. E. & O. E."
    : "This proforma invoice is issued for confirmation and advance-payment purposes only. It is not a tax invoice and does not entitle the recipient to claim input tax credit. A tax invoice follows at the time of supply. E. & O. E.";
  for (const lineTxt of wrap(decl, font, 7.3, W - 170)) { text(page, lineTxt, MARGIN, y, 7.3, font, MUTED); y -= 9; }
  const sigY = Math.min(y + 9, 108);
  right(page, `For ${COMPANY.legalName}`, A4[0] - MARGIN, sigY, 8.5, bold);
  right(page, "Authorised Signatory", A4[0] - MARGIN, sigY - 30, 8, font, MUTED);
  text(page, "This is a computer-generated document and does not require a physical signature.", MARGIN, 46, 7, font, MUTED);
  hr(page, 60, MARGIN, A4[0] - MARGIN);

  return doc.save();
}
