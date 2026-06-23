import { requireAdmin } from "@/lib/admin/auth";
import { listContentRows } from "@/lib/admin/data";
import { updateContent } from "@/lib/admin/actions";

export const dynamic = "force-dynamic";

const LABELS: Record<string, string> = {
  homeCatalogue: "Home — catalogue showcase tiles",
  homeChart: "Home — price-history series (pricing engine)",
  homeCats: "Home — category chips",
  heroCats: "Home — hero category links",
  featureTags: "Home — differentiator tags",
  homeBrands: "Home — brand strip",
  steps: "Home — how-it-works steps",
  miniRows: "Home — hero mini project rows",
  categories: "App — catalogue category chips",
  autoPo: "App — auto-PO line items",
  projects: "App — portfolio projects",
  stages: "App — phased procurement stages",
  bomRows: "App — sample BOM rows",
  parsedRows: "App — Smart BOM parsed rows",
  trackSteps: "App — delivery tracking steps",
};

export default async function AdminContent({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  await requireAdmin();
  const rows = await listContentRows();
  const { ok, error } = await searchParams;

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 6px" }}>Site content</h1>
      <p style={{ fontSize: 13.5, color: "#56627A", margin: "0 0 18px" }}>Each block is editable JSON. Save validates the JSON and updates the live site.</p>

      {ok && <div style={{ background: "#E6F5EE", color: "#137a4b", borderRadius: 10, padding: "10px 14px", fontSize: 13, marginBottom: 14 }}>Saved “{ok}”.</div>}
      {error && <div style={{ background: "#FBE9E4", color: "#9a3b16", borderRadius: 10, padding: "10px 14px", fontSize: 13, marginBottom: 14 }}>{error}</div>}

      <div style={{ display: "grid", gap: 16 }}>
        {rows.map((r) => (
          <form key={r.key} action={updateContent} style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 14, padding: 16 }}>
            <input type="hidden" name="key" value={r.key} />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{LABELS[r.key] ?? r.key}</div>
                <div style={{ fontFamily: "var(--space-mono)", fontSize: 11, color: "#8A93A6" }}>{r.key}</div>
              </div>
              <button style={{ background: "#19202E", color: "#fff", fontWeight: 600, fontSize: 12.5, border: "none", padding: "8px 16px", borderRadius: 9, cursor: "pointer" }}>Save</button>
            </div>
            <textarea name="data" defaultValue={JSON.stringify(r.data, null, 2)} spellCheck={false}
              style={{ width: "100%", boxSizing: "border-box", minHeight: 120, fontFamily: "var(--space-mono)", fontSize: 12, lineHeight: 1.5, border: "1px solid #E8EBF1", borderRadius: 9, padding: 12, resize: "vertical", outline: "none", color: "#19202e" }} />
          </form>
        ))}
        {rows.length === 0 && <div style={{ color: "#8A93A6", fontSize: 14 }}>No content rows. Run supabase/content.sql first.</div>}
      </div>
    </div>
  );
}
