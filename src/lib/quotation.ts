/**
 * Quotation (.docx) generator - the RFQ reply format (owner spec, Aug 2026,
 * replacing the v1 PDF quote that was "too bulky"):
 *
 *  - EVERY figure is EXCLUSIVE of GST: the table shows the manufacturer's
 *    MRP (ex-GST) next to the Elume price (ex-GST), and the discount is
 *    computed between those two - that column IS our contribution.
 *  - GST is added once, at the bottom (IGST, or CGST+SGST when intra-state).
 *  - Generous spacing throughout; terms carry NO documents/specification
 *    rows; no delivery-deadline/address flourishes.
 *  - Output is Word so the owner can edit before making his own PDF.
 *
 * Used by /api/admin/boq/quotation (the BOQ tool's quotation export).
 */
import {
  AlignmentType, BorderStyle, Document, ImageRun, Packer, Paragraph, Table,
  TableCell, TableRow, TextRun, VerticalAlign, WidthType,
} from "docx";
import { COMPANY, addressLine } from "@/lib/company";
import { amountInWords } from "@/lib/invoice";

export type QuotationItem = {
  description: string;      // product name
  catNo?: string;           // manufacturer catalogue number
  code?: string;            // Elume SKU / ELIN
  qty: number;
  unit?: string;            // "Nos", "coil"...
  mrpEx: number;            // manufacturer MRP, EXCLUSIVE of GST
  priceEx: number;          // Elume unit price, EXCLUSIVE of GST
};

export type QuotationInput = {
  ref: string;              // "EQ/2026-27/RFQ-13438"
  dateLabel: string;        // "21 August 2026"
  company: string;
  address?: string;
  attn?: string;            // "Mr. Neminath Jain"
  email?: string;
  rfqNo?: string;
  rfqDate?: string;
  subject: string;
  gstRate?: number;         // default 0.18
  intraState?: boolean;     // true -> CGST+SGST split (default false -> IGST)
  bestOffer?: boolean;      // prints "This is our best offer."
  items: QuotationItem[];
  terms?: Partial<Record<"Delivery" | "Freight" | "Payment" | "Warranty" | "Validity", string>>;
  orderNote?: string;       // optional extra line under HOW TO PLACE THE ORDER
};

const INK = "19202E";
const MUTED = "56627A";
const ACCENT = "1D2F8A";
const LINE_CLR = "D8DCE6";

const fmt = (n: number) =>
  n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const DEFAULT_TERMS: Record<string, string> = {
  Delivery: "Within 10 days of confirmed order with payment.",
  Freight: "Freight/transport charges are extra at actuals. Quoted prices are ex-freight.",
  Payment: "100% advance along with the purchase order.",
  Warranty: "As per the manufacturer's standard warranty for the quoted product.",
  Validity: "This quotation is valid for 15 days from the date above.",
};

function p(text: string, opts: { size?: number; bold?: boolean; color?: string; before?: number; after?: number; align?: (typeof AlignmentType)[keyof typeof AlignmentType] } = {}) {
  return new Paragraph({
    alignment: opts.align,
    spacing: { before: opts.before ?? 0, after: opts.after ?? 120 },
    children: [new TextRun({ text, size: (opts.size ?? 10.5) * 2, bold: opts.bold, color: opts.color ?? INK, font: "Calibri" })],
  });
}

function cell(children: Paragraph[], opts: { width?: number; fill?: string } = {}) {
  return new TableCell({
    children,
    verticalAlign: VerticalAlign.CENTER,
    shading: opts.fill ? { fill: opts.fill } : undefined,
    width: opts.width ? { size: opts.width, type: WidthType.PERCENTAGE } : undefined,
    margins: { top: 140, bottom: 140, left: 140, right: 140 },
  });
}

const thinBorders = {
  top: { style: BorderStyle.SINGLE, size: 4, color: LINE_CLR },
  bottom: { style: BorderStyle.SINGLE, size: 4, color: LINE_CLR },
  left: { style: BorderStyle.SINGLE, size: 4, color: LINE_CLR },
  right: { style: BorderStyle.SINGLE, size: 4, color: LINE_CLR },
  insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: LINE_CLR },
  insideVertical: { style: BorderStyle.SINGLE, size: 4, color: LINE_CLR },
};

export async function buildQuotationDocx(q: QuotationInput, logo?: Uint8Array): Promise<Buffer> {
  const gst = q.gstRate ?? 0.18;
  const taxable = q.items.reduce((s, it) => s + it.qty * it.priceEx, 0);
  const tax = taxable * gst;
  const grand = taxable + tax;

  const head = (t: string, align?: (typeof AlignmentType)[keyof typeof AlignmentType]) =>
    new Paragraph({ alignment: align ?? AlignmentType.LEFT, spacing: { after: 0 }, children: [new TextRun({ text: t, size: 19, bold: true, color: "FFFFFF", font: "Calibri" })] });
  const num = (t: string, bold = false) =>
    new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { after: 0 }, children: [new TextRun({ text: t, size: 20, bold, color: INK, font: "Calibri" })] });

  const itemRows = q.items.map((it, i) => {
    const disc = it.mrpEx > 0 ? Math.round((1 - it.priceEx / it.mrpEx) * 100) : 0;
    const descLines: Paragraph[] = [
      new Paragraph({ spacing: { after: 40 }, children: [new TextRun({ text: it.description, size: 20, bold: true, color: INK, font: "Calibri" })] }),
    ];
    const sub = [it.catNo ? `Cat. No. ${it.catNo}` : null, it.code ? `Elume code ${it.code}` : null].filter(Boolean).join("  ·  ");
    if (sub) descLines.push(new Paragraph({ spacing: { after: 0 }, children: [new TextRun({ text: sub, size: 17, color: MUTED, font: "Calibri" })] }));
    return new TableRow({
      children: [
        cell([num(String(i + 1))], { width: 5 }),
        cell(descLines, { width: 37 }),
        cell([num(`${it.qty} ${it.unit ?? "Nos"}`)], { width: 10 }),
        cell([num(fmt(it.mrpEx))], { width: 13 }),
        cell([num(fmt(it.priceEx), true)], { width: 13 }),
        cell([num(`${disc}%`)], { width: 9 }),
        cell([num(fmt(it.qty * it.priceEx))], { width: 13 }),
      ],
    });
  });

  const totalRow = (label: string, value: string, bold = false) =>
    new TableRow({
      children: [
        cell([new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { after: 0 }, children: [new TextRun({ text: label, size: 20, bold, color: bold ? INK : MUTED, font: "Calibri" })] })], { width: 87 }),
        cell([num(value, bold)], { width: 13 }),
      ],
    });

  const termEntries = Object.entries({ ...DEFAULT_TERMS, ...(q.terms ?? {}) });

  const children: (Paragraph | Table)[] = [];

  // ── Letterhead ──
  if (logo) {
    children.push(new Paragraph({
      spacing: { after: 60 },
      children: [new ImageRun({ type: "png", data: logo, transformation: { width: 132, height: 20 } })],
    }));
  }
  children.push(p(COMPANY.legalName, { size: 9, color: MUTED, after: 20 }));
  children.push(p(`${addressLine()}  ·  GSTIN ${COMPANY.gstin}`, { size: 8.5, color: MUTED, after: 60 }));
  children.push(new Paragraph({
    spacing: { after: 260 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: ACCENT, space: 6 } },
    children: [new TextRun({ text: "QUOTATION", size: 52, bold: true, color: ACCENT, font: "Calibri" })],
  }));

  // ── Meta + addressee ──
  children.push(p(`Ref: ${q.ref}    ·    Date: ${q.dateLabel}`, { size: 10, color: MUTED, after: 200 }));
  children.push(p("To,", { after: 40 }));
  children.push(p(q.company, { bold: true, after: 40 }));
  if (q.address) children.push(p(q.address, { after: 40 }));
  if (q.attn || q.email) children.push(p(`Kind Attn: ${[q.attn, q.email].filter(Boolean).join("  ·  ")}`, { after: 40 }));
  if (q.rfqNo) children.push(p(`Against your RFQ No: ${q.rfqNo}${q.rfqDate ? ` dated ${q.rfqDate}` : ""}`, { color: MUTED, after: 200 }));

  children.push(p(`Subject: ${q.subject}`, { bold: true, before: 80, after: 200 }));
  children.push(p("Dear Sir, thank you for your enquiry. We are pleased to quote as under. All prices are in INR and EXCLUSIVE of GST; GST is shown separately below.", { after: 260 }));

  // ── Items table ──
  children.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: thinBorders,
    rows: [
      new TableRow({
        tableHeader: true,
        children: [
          cell([head("#")], { width: 5, fill: ACCENT }),
          cell([head("Description")], { width: 37, fill: ACCENT }),
          cell([head("Qty", AlignmentType.RIGHT)], { width: 10, fill: ACCENT }),
          cell([head("MRP (ex-GST)", AlignmentType.RIGHT)], { width: 13, fill: ACCENT }),
          cell([head("Elume Price (ex-GST)", AlignmentType.RIGHT)], { width: 13, fill: ACCENT }),
          cell([head("Discount", AlignmentType.RIGHT)], { width: 9, fill: ACCENT }),
          cell([head("Amount (ex-GST)", AlignmentType.RIGHT)], { width: 13, fill: ACCENT }),
        ],
      }),
      ...itemRows,
    ],
  }));

  children.push(p("", { after: 120 }));

  // ── Totals ──
  const totals: TableRow[] = [totalRow("Taxable value (ex-GST)", fmt(taxable))];
  if (q.intraState) {
    totals.push(totalRow(`CGST @ ${(gst * 50).toFixed(0)}%`, fmt(tax / 2)));
    totals.push(totalRow(`SGST @ ${(gst * 50).toFixed(0)}%`, fmt(tax / 2)));
  } else {
    totals.push(totalRow(`IGST @ ${(gst * 100).toFixed(0)}%`, fmt(tax)));
  }
  totals.push(totalRow("Grand total (incl. GST)", `Rs. ${fmt(grand)}`, true));
  children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: thinBorders, rows: totals }));

  children.push(p(`Amount in words: ${amountInWords(grand)}`, { size: 9.5, color: MUTED, before: 140, after: q.bestOffer ? 140 : 320 }));
  if (q.bestOffer) {
    children.push(new Paragraph({
      spacing: { before: 60, after: 320 },
      children: [new TextRun({ text: "This is our best offer.", size: 22, bold: true, color: ACCENT, font: "Calibri" })],
    }));
  }

  // ── Terms ──
  children.push(p("TERMS & CONDITIONS", { bold: true, size: 11, color: ACCENT, before: 120, after: 160 }));
  for (const [k, v] of termEntries) {
    children.push(new Paragraph({
      spacing: { after: 130 },
      children: [
        new TextRun({ text: `${k}:  `, size: 20, bold: true, color: INK, font: "Calibri" }),
        new TextRun({ text: v, size: 20, color: INK, font: "Calibri" }),
      ],
    }));
  }

  // ── How to order ──
  children.push(p("HOW TO PLACE THE ORDER", { bold: true, size: 11, color: ACCENT, before: 280, after: 160 }));
  children.push(p(`Pay by NEFT/RTGS:  A/c Name: ${COMPANY.legalName}  ·  Bank: State Bank of India  ·  A/c No: 44955533967  ·  IFSC: SBIN0011559`, { after: 130 }));
  children.push(p(`Please share the UTR on ${COMPANY.email} and dispatch is scheduled immediately. You can also order online at elumenuvo.com.`, { after: 130 }));
  if (q.orderNote) children.push(p(q.orderNote, { after: 130 }));
  children.push(p(`For any clarification, call ${COMPANY.phoneDisplay}.`, { after: 480 }));

  // ── Signature ──
  children.push(p(`For ${COMPANY.legalName}`, { bold: true, after: 700 }));
  children.push(p("Authorised Signatory", { color: MUTED, after: 0 }));

  const doc = new Document({
    styles: { default: { document: { run: { font: "Calibri", size: 21, color: INK } } } },
    sections: [{
      properties: { page: { margin: { top: 900, bottom: 900, left: 1000, right: 1000 } } },
      children,
    }],
  });
  return Packer.toBuffer(doc);
}
