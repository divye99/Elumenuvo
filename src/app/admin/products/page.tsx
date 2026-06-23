import Link from "next/link";
import { requireAdmin } from "@/lib/admin/auth";
import { listProductRows } from "@/lib/admin/data";
import { deleteProduct } from "@/lib/admin/actions";
import { fmt } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminProducts({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  await requireAdmin();
  const rows = await listProductRows();
  const { ok, error } = await searchParams;

  const th = { textAlign: "left" as const, fontSize: 11, textTransform: "uppercase" as const, letterSpacing: "0.4px", color: "#8A93A6", padding: "10px 12px", fontWeight: 600 };
  const td = { fontSize: 13, padding: "10px 12px", borderTop: "1px solid #F0F2F6" };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Products & pricing</h1>
        <Link href="/admin/products/new" style={{ background: "#4E5BDC", color: "#fff", fontWeight: 600, fontSize: 13.5, padding: "9px 16px", borderRadius: 10 }}>+ New product</Link>
      </div>

      {ok && <div style={{ background: "#E6F5EE", color: "#137a4b", borderRadius: 10, padding: "10px 14px", fontSize: 13, marginBottom: 14 }}>Saved{ok === "deleted" ? " — product deleted" : ""}.</div>}
      {error && <div style={{ background: "#FBE9E4", color: "#9a3b16", borderRadius: 10, padding: "10px 14px", fontSize: 13, marginBottom: 14 }}>{error}</div>}

      <div style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 14, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={th}>Product</th><th style={th}>Brand</th><th style={th}>Category</th>
              <th style={th}>MRP</th><th style={th}>Elume</th><th style={th}>Unit</th><th style={th}></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td style={td}>
                  <div style={{ fontWeight: 600 }}>{r.name}{!r.is_active && <span style={{ fontSize: 11, color: "#E0612A", marginLeft: 8 }}>hidden</span>}</div>
                  <div style={{ fontFamily: "var(--space-mono)", fontSize: 11, color: "#8A93A6" }}>{r.sku}</div>
                </td>
                <td style={td}>{r.brand}</td>
                <td style={td}>{r.category}</td>
                <td style={td}>{fmt(r.mrp)}</td>
                <td style={{ ...td, fontWeight: 600 }}>{fmt(r.elume_price)}</td>
                <td style={td}>{r.unit}</td>
                <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>
                  <Link href={`/admin/products/${r.id}`} style={{ color: "#4E5BDC", fontWeight: 600, marginRight: 12 }}>Edit</Link>
                  <form action={deleteProduct} style={{ display: "inline" }}>
                    <input type="hidden" name="id" value={r.id} />
                    <button style={{ color: "#E0612A", background: "none", border: "none", cursor: "pointer", fontSize: 13 }}>Delete</button>
                  </form>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td style={{ ...td, color: "#8A93A6", padding: 24, textAlign: "center" }} colSpan={7}>No products. Run supabase/catalogue.sql, or add one.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
