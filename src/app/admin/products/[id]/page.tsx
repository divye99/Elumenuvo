import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/auth";
import { getProductRow, listProductRows } from "@/lib/admin/data";
import { upsertProduct } from "@/lib/admin/actions";

export const dynamic = "force-dynamic";

const fieldStyle = { width: "100%", boxSizing: "border-box" as const, border: "1px solid #E0E4ED", borderRadius: 9, padding: "9px 11px", fontSize: 13.5, outline: "none", background: "#fff" };
const labelStyle = { fontSize: 12, fontWeight: 600, color: "#56627A", display: "block", marginBottom: 5 };

function Field({ label, name, defaultValue, type = "text", required = false, readOnly = false, list, placeholder }: { label: string; name: string; defaultValue?: string | number; type?: string; required?: boolean; readOnly?: boolean; list?: string; placeholder?: string }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <input name={name} type={type} defaultValue={defaultValue} required={required} readOnly={readOnly} list={list} placeholder={placeholder} step={type === "number" ? "any" : undefined}
        style={{ ...fieldStyle, background: readOnly ? "#F5F6F9" : "#fff", color: readOnly ? "#8A93A6" : "#19202e" }} />
    </div>
  );
}

export default async function ProductForm({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const isNew = id === "new";
  const row = isNew ? null : await getProductRow(id);
  if (!isNew && !row) notFound();

  const all = await listProductRows();
  const brands = [...new Set(all.map((p) => p.brand))].sort();
  const cats = [...new Set(all.map((p) => p.category))].sort();

  return (
    <div style={{ maxWidth: 640 }}>
      <Link href="/admin/products" style={{ fontSize: 13, color: "#8A93A6" }}>← Products</Link>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: "8px 0 18px" }}>{isNew ? "New product" : `Edit · ${row!.name}`}</h1>

      <form action={upsertProduct} style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 14, padding: 22, display: "grid", gap: 14 }}>
        <Field label="ID (slug, unique)" name="id" defaultValue={row?.id} required readOnly={!isNew} placeholder="e.g. cmi-gs-15-grn" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <Field label="SKU" name="sku" defaultValue={row?.sku} required placeholder="CMI-GS-1.5-GRN" />
          <Field label="Unit" name="unit" defaultValue={row?.unit ?? "pc"} placeholder="coil / pc / pack" />
        </div>
        <Field label="Name" name="name" defaultValue={row?.name} required />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <Field label="Brand" name="brand" defaultValue={row?.brand} required list="brands" />
          <Field label="Category" name="category" defaultValue={row?.category} required list="cats" />
        </div>
        <datalist id="brands">{brands.map((b) => <option key={b} value={b} />)}</datalist>
        <datalist id="cats">{cats.map((c) => <option key={c} value={c} />)}</datalist>
        <Field label="Spec" name="spec" defaultValue={row?.spec ?? ""} placeholder="90 m coil · single-core copper · FR PVC" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
          <Field label="MRP (₹)" name="mrp" type="number" defaultValue={row?.mrp} required />
          <Field label="Elume price (₹)" name="elume_price" type="number" defaultValue={row?.elume_price} required />
          <Field label="Sort order" name="sort_order" type="number" defaultValue={row?.sort_order ?? all.length} />
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, color: "#19202e" }}>
          <input type="checkbox" name="is_active" defaultChecked={row?.is_active ?? true} /> Active (visible in the catalogue)
        </label>
        <div style={{ fontSize: 12, color: "#8A93A6" }}>Wholesale is automatic: 5% below the Elume price at 15+ units.</div>
        <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
          <button style={{ background: "#4E5BDC", color: "#fff", fontWeight: 600, fontSize: 14, border: "none", padding: "11px 22px", borderRadius: 10, cursor: "pointer" }}>{isNew ? "Create product" : "Save changes"}</button>
          <Link href="/admin/products" style={{ fontSize: 14, color: "#56627A", padding: "11px 18px" }}>Cancel</Link>
        </div>
      </form>
    </div>
  );
}
