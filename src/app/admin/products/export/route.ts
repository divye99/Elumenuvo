import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin/auth";
import { listProductRows } from "@/lib/admin/data";
import { catalogueToCsv, sampleCsv } from "@/lib/admin/import";

export const dynamic = "force-dynamic";

/**
 * CSV download for the bulk editor.
 *   /admin/products/export            → full catalogue (Action blank)
 *   /admin/products/export?sample=1   → tiny starter template
 * Opens directly in Excel / Google Sheets.
 */
export async function GET(request: Request) {
  if (!(await isAdmin())) return new NextResponse("Unauthorized", { status: 401 });

  const rows = await listProductRows();
  const sample = new URL(request.url).searchParams.get("sample");
  const body = sample ? sampleCsv(rows) : catalogueToCsv(rows);
  const name = sample ? "elume-catalogue-template.csv" : "elume-catalogue.csv";

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  });
}
