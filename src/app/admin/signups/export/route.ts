import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin/auth";
import { loadSignups } from "@/lib/admin/signups-data";

/** CSV export of every registered account (Excel-friendly). */
export const dynamic = "force-dynamic";

const esc = (v: unknown) => {
  const s = v == null ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const rows = await loadSignups();
  const cols = ["created_at", "name", "email", "phone", "account_type", "company", "gstin", "confirmed", "last_sign_in_at"] as const;
  const lines = [cols.join(","), ...rows.map((r) => cols.map((c) => esc((r as Record<string, unknown>)[c])).join(","))];
  const csv = "﻿" + lines.join("\r\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="elume-signups-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
