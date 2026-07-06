import Link from "next/link";
import { requireAdmin } from "@/lib/admin/auth";
import { listProductRows } from "@/lib/admin/data";
import PricingTable from "@/app/admin/products/PricingTable";

export const dynamic = "force-dynamic";

export default async function AdminProducts({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  await requireAdmin();
  const rows = await listProductRows();
  const { ok, error } = await searchParams;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 6, flexWrap: "wrap" }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Products &amp; pricing</h1>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link href="/admin/products/import" style={{ background: "#fff", border: "1px solid #E0E4ED", color: "#19202e", fontWeight: 600, fontSize: 13.5, padding: "8px 15px", borderRadius: 10 }}>⇅ Excel import</Link>
          <Link href="/admin/products/new" style={{ background: "#4E5BDC", color: "#fff", fontWeight: 600, fontSize: 13.5, padding: "9px 16px", borderRadius: 10 }}>+ New product</Link>
        </div>
      </div>
      <p style={{ fontSize: 13.5, color: "#56627A", margin: "0 0 18px" }}>
        Edit MRP &amp; Elume price inline — change any cell, then save all at once. Wholesale (−5% at 15+) and %-off update live.
      </p>

      {ok && <div style={{ background: "#E6F5EE", color: "#137a4b", borderRadius: 10, padding: "10px 14px", fontSize: 13, marginBottom: 14 }}>Saved{ok === "deleted" ? " — product deleted" : ""}.</div>}
      {error && <div style={{ background: "#FBE9E4", color: "#9a3b16", borderRadius: 10, padding: "10px 14px", fontSize: 13, marginBottom: 14 }}>{error}</div>}

      <PricingTable rows={rows} />
    </div>
  );
}
