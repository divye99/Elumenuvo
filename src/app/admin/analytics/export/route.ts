import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin/auth";
import { fetchEvents } from "@/lib/admin/analytics-data";

/** Raw event export (Excel-friendly CSV): the analysis-ready database dump.
 *  One row per event with sid, identity, type, path, detail JSON, device,
 *  IP, geo, duration and timestamp. */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const esc = (v: unknown) => {
  const s = v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export async function GET(request: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const days = Math.min(90, Math.max(1, Number(new URL(request.url).searchParams.get("days")) || 30));
  const events = await fetchEvents(days);

  const istOf = (v: string) => new Date(v).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "medium" });
  const cols = ["created_at_ist", "created_at", "sid", "email", "name", "type", "path", "detail", "referrer", "device", "ip", "country", "region", "city", "duration_ms"];
  const lines = [cols.join(","), ...events.map((e) => cols.map((c) => esc(c === "created_at_ist" ? istOf((e as any).created_at) : (e as any)[c])).join(","))];
  const csv = "﻿" + lines.join("\r\n");
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="elume-analytics-${days}d-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
