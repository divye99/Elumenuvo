import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin/auth";
import { adminClient } from "@/lib/supabase/admin";

/** CSV export of metals enquiries (Excel-friendly: BOM + CRLF). */
export const dynamic = "force-dynamic";

const esc = (v: unknown) => {
  let s = v == null ? "" : String(v);
  // Neutralise spreadsheet formula injection: these fields are written by an
  // anonymous public form, and a leading = + - @ would execute in Excel.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const db = adminClient();
  if (!db) return NextResponse.json({ error: "Service key missing." }, { status: 500 });

  const { data } = await db
    .from("metal_enquiries")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(5000);
  const rows = data ?? [];

  const cols = ["created_at", "company", "gstin", "name", "email", "phone", "metal", "message"];
  const lines = [cols.join(","), ...rows.map((r: Record<string, unknown>) => cols.map((c) => esc(r[c])).join(","))];
  const csv = "﻿" + lines.join("\r\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="elume-metal-enquiries-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
