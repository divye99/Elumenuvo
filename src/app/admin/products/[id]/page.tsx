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

        {/* Packaging & variant attributes (map to attrs jsonb) */}
        <div style={{ border: "1px solid #EEF0F4", borderRadius: 12, padding: "14px 16px", background: "#FBFCFE" }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: "#3A4358", marginBottom: 4 }}>Packaging &amp; variant options</div>
          <div style={{ fontSize: 11.5, color: "#8A93A6", marginBottom: 12 }}>
            These drive the swatch pickers and make length/pack pricing clear. <b>Length</b> for wire coils
            (90 m, 180 m, 45 m…), <b>Pack</b> for multi-packs (e.g. 4 = pack of 4).
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <Field label="Size" name="attr_size" defaultValue={row?.attrs?.Size ?? ""} list="sizes" placeholder="2.5 sq mm" />
            <Field label="Length" name="attr_length" defaultValue={row?.attrs?.Length ?? ""} list="lengths" placeholder="90 m" />
            <Field label="Pack (qty)" name="attr_pack" defaultValue={row?.attrs?.Pack ?? ""} placeholder="4" />
            <Field label="Colour" name="attr_colour" defaultValue={row?.attrs?.Colour ?? ""} placeholder="Red" />
            <Field label="Quality" name="attr_quality" defaultValue={row?.attrs?.Quality ?? ""} placeholder="FRLS" />
            <Field label="Variant of (parent id)" name="parent_id" defaultValue={row?.parent_id ?? ""} list="parents" placeholder="e.g. poly25" />
          </div>
          <datalist id="lengths"><option value="45 m" /><option value="90 m" /><option value="180 m" /><option value="200 m" /><option value="270 m" /><option value="300 m" /></datalist>
          <datalist id="sizes"><option value="1.0 sq mm" /><option value="1.5 sq mm" /><option value="2.5 sq mm" /><option value="4.0 sq mm" /><option value="6.0 sq mm" /><option value="10 sq mm" /></datalist>
          <datalist id="parents">{all.filter((p) => !p.parent_id).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</datalist>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
          <Field label="MRP (₹)" name="mrp" type="number" defaultValue={row?.mrp} required />
          <Field label="Elume price (₹)" name="elume_price" type="number" defaultValue={row?.elume_price} required />
          <Field label="Sort order" name="sort_order" type="number" defaultValue={row?.sort_order ?? all.length} />
        </div>
        <div style={{ display: "flex", gap: 22, flexWrap: "wrap" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, color: "#19202e" }}>
            <input type="checkbox" name="is_active" defaultChecked={row?.is_active ?? true} /> Active (visible in the catalogue)
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, color: "#19202e" }}>
            <input type="checkbox" name="is_recommended" defaultChecked={row?.is_recommended ?? false} /> Recommended (featured in sort)
          </label>
        </div>
        <div>
          <label style={labelStyle}>Product photo</label>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <div style={{ width: 64, height: 64, borderRadius: 10, background: row?.image_url ? `center/cover no-repeat url(${row.image_url})` : "#F0F2F6", border: "1px solid #E8EBF1", flex: "none" }} />
            <div style={{ flex: 1 }}>
              <input type="hidden" name="current_image_url" value={row?.image_url ?? ""} />
              <input type="file" name="image" accept="image/*" style={{ fontSize: 13 }} />
              <div style={{ fontSize: 11.5, color: "#8A93A6", marginTop: 3 }}>JPG / PNG / WebP. Leave empty to keep the current photo.</div>
            </div>
          </div>
        </div>
        <div style={{ fontSize: 12, color: "#8A93A6" }}>Wholesale is automatic: 5% below the Elume price at 15+ units.</div>
        <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
          <button style={{ background: "#4E5BDC", color: "#fff", fontWeight: 600, fontSize: 14, border: "none", padding: "11px 22px", borderRadius: 10, cursor: "pointer" }}>{isNew ? "Create product" : "Save changes"}</button>
          <Link href="/admin/products" style={{ fontSize: 14, color: "#56627A", padding: "11px 18px" }}>Cancel</Link>
        </div>
      </form>
    </div>
  );
}
