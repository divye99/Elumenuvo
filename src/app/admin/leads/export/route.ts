import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin/auth";
import { adminClient } from "@/lib/supabase/admin";

/** CSV export of a leads tab (Excel-friendly: BOM + CRLF). */
export const dynamic = "force-dynamic";

const esc = (v: unknown) => {
  const s = v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export async function GET(request: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const db = adminClient();
  if (!db) return NextResponse.json({ error: "Service key missing." }, { status: 500 });

  const tab = new URL(request.url).searchParams.get("tab") ?? "credit";
  let rows: Record<string, unknown>[] = [];
  if (tab === "credit") rows = (await db.from("waitlist").select("*").order("created_at", { ascending: false }).limit(5000)).data ?? [];
  else if (tab === "business") rows = (await db.from("profiles").select("*").eq("account_type", "business").order("updated_at", { ascending: false }).limit(5000)).data ?? [];
  else {
    const all = (await db.from("partner_leads").select("*").order("created_at", { ascending: false }).limit(5000)).data ?? [];
    rows = tab === "sellers" ? all.filter((l: any) => l.kind === "seller") : all.filter((l: any) => l.kind !== "seller");
  }

  const cols = Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
  const lines = [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))];
  const csv = "﻿" + lines.join("\r\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="elume-leads-${tab}-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
