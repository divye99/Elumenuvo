import Link from "next/link";
import { requireAdmin } from "@/lib/admin/auth";
import { listImportLog } from "@/lib/admin/data";
import ImportClient from "@/app/admin/products/import/ImportClient";

export const dynamic = "force-dynamic";

export default async function ImportPage() {
  await requireAdmin();
  const log = await listImportLog(15);

  return (
    <div style={{ maxWidth: 820 }}>
      <Link href="/admin/products" style={{ fontSize: 13, color: "#8A93A6" }}>← Products</Link>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: "8px 0 4px" }}>Excel import</h1>
      <p style={{ fontSize: 13.5, color: "#56627A", margin: "0 0 20px" }}>
        Bulk add, update or remove products in one go. Download → edit in Excel → upload → review → confirm.
      </p>

      <ImportClient />

      {/* Change log */}
      <div style={{ marginTop: 24 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 10px" }}>Import history</h2>
        {log.length === 0 ? (
          <div style={{ fontSize: 13, color: "#8A93A6", background: "#fff", border: "1px solid #E8EBF1", borderRadius: 12, padding: "16px 18px" }}>
            No imports yet. (Run <code>supabase/migrations/0011_import-log.sql</code> to enable the log.)
          </div>
        ) : (
          <div style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 12, overflow: "hidden" }}>
            {log.map((l, i) => (
              <div key={l.id} style={{ padding: "12px 16px", borderTop: i ? "1px solid #F0F2F6" : undefined, display: "flex", justifyContent: "space-between", gap: 14, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 600 }}>
                    {l.added > 0 && <span style={{ color: "#137a4b" }}>+{l.added} added </span>}
                    {l.updated > 0 && <span style={{ color: "#3a41b5" }}>~{l.updated} updated </span>}
                    {l.removed > 0 && <span style={{ color: "#9a3b16" }}>−{l.removed} removed</span>}
                  </div>
                  <div style={{ fontSize: 11.5, color: "#8A93A6", marginTop: 2 }}>{l.filename} · {l.actor}</div>
                </div>
                <div style={{ fontSize: 12, color: "#8A93A6" }}>
                  {new Date(l.created_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
