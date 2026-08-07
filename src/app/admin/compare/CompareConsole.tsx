"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { fmt } from "@/lib/format";
import { rejectFromGroup, restorePair, rebuildCompareAction, type CompareGroup, type RejectedPair } from "@/lib/admin/compare-actions";

export default function CompareConsole({ groups, rejected, coverage }: { groups: CompareGroup[]; rejected: RejectedPair[]; coverage: { keyed: number; total: number } }) {
  const router = useRouter();
  const [cat, setCat] = useState("All");
  const [q, setQ] = useState("");
  const [extractedOnly, setExtractedOnly] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [, start] = useTransition();

  const cats = useMemo(() => ["All", ...[...new Set(groups.map((g) => g.category))].sort()], [groups]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return groups
      .filter((g) => cat === "All" || g.category === cat)
      .filter((g) => !extractedOnly || g.members.some((m) => m.source === "extracted"))
      .filter((g) => !needle || g.key.includes(needle) || g.members.some((m) => `${m.brand} ${m.name}`.toLowerCase().includes(needle)))
      .slice(0, 120);
  }, [groups, cat, q, extractedOnly]);

  const evict = (g: CompareGroup, id: string) => {
    if (!confirm("Remove this product from the group? It will never pair with these products again (until you restore it below).")) return;
    setBusy(id);
    start(async () => {
      const res = await rejectFromGroup(id, g.members.map((m) => m.id).filter((x) => x !== id));
      setNote(res.ok ? null : res.error ?? "Failed.");
      setBusy(null);
      router.refresh();
    });
  };

  const rebuild = () => {
    setBusy("rebuild");
    start(async () => {
      // Route, not server action: the full rebuild needs the long deadline.
      let note = "Failed.";
      try {
        const r = await fetch("/api/admin/rebuild-compare", { method: "POST" });
        const d = await r.json();
        note = d.ok
          ? `Rebuilt: ${d.scanned} scanned, ${d.keyed} fingerprinted, ${d.groups} groups, ${d.updated} rows updated.`
          : d.error ?? "Failed.";
      } catch { /* note stays Failed */ }
      setNote(note);
      setBusy(null);
      router.refresh();
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Toolbar */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <select value={cat} onChange={(e) => setCat(e.target.value)} style={sel}>
          {cats.map((c) => <option key={c}>{c}</option>)}
        </select>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search product, brand or key…" style={{ ...sel, flex: "1 1 220px" }} />
        <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 600, color: "#56627A", cursor: "pointer" }}>
          <input type="checkbox" checked={extractedOnly} onChange={(e) => setExtractedOnly(e.target.checked)} />
          Needs spot-check (extracted)
        </label>
        <span style={{ fontSize: 12.5, color: "#8A93A6" }}>
          {groups.length} groups · {coverage.keyed}/{coverage.total} products fingerprinted
        </span>
        <button onClick={rebuild} disabled={busy === "rebuild"} style={{ marginLeft: "auto", background: "#4E5BDC", color: "#fff", fontWeight: 700, fontSize: 13, border: "none", padding: "9px 16px", borderRadius: 9, cursor: "pointer", opacity: busy === "rebuild" ? 0.6 : 1 }}>
          {busy === "rebuild" ? "Rebuilding…" : "↻ Rebuild mappings now"}
        </button>
      </div>
      {note && <div style={{ background: "#EEF0FE", color: "#3A46B8", borderRadius: 10, padding: "10px 14px", fontSize: 13 }}>{note}</div>}

      {/* Groups */}
      {shown.length === 0 ? (
        <div style={{ border: "1px dashed #D5DAE4", borderRadius: 12, padding: 22, fontSize: 13, color: "#8A93A6" }}>
          No groups match. If the whole list is empty, run the 0095 migration and hit &quot;Rebuild mappings now&quot;.
        </div>
      ) : (
        shown.map((g) => (
          <div key={g.key} style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 14, overflow: "hidden" }}>
            <div style={{ padding: "10px 16px", borderBottom: "1px solid #F0F2F6", display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
              <span style={{ fontFamily: "var(--space-mono)", fontSize: 12, fontWeight: 700, color: "#3A4358" }}>{g.key}</span>
              <span style={{ fontSize: 11.5, color: "#8A93A6" }}>{g.category} · {g.members.length} products</span>
              <span style={{ fontSize: 11.5, color: "#8A93A6", marginLeft: "auto" }}>
                {g.members[0]?.display.map(([l, v]) => `${l}: ${v}`).join(" · ")}
              </span>
            </div>
            {g.members.map((m) => (
              <div key={m.id} style={{ display: "flex", gap: 12, alignItems: "center", padding: "9px 16px", borderTop: "1px solid #F7F8FB" }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, flex: "none", background: m.image ? `center/contain no-repeat url(${m.image}) #fff` : "#F0F2F6", border: "1px solid #EEF0F4" }} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <a href={`/catalogue/${m.id}`} target="_blank" rel="noreferrer" style={{ fontSize: 13, fontWeight: 600, color: "#19202E" }}>
                    {m.name} <span style={{ color: "#4E5BDC", fontSize: 11.5 }}>↗</span>
                  </a>
                  <div style={{ fontSize: 11, color: "#8A93A6" }}>
                    {m.brand} · {fmt(m.price)} incl.
                    {m.source === "extracted" && <span style={{ marginLeft: 6, fontSize: 9.5, fontWeight: 800, color: "#C77700", background: "#FFF3E0", padding: "1px 6px", borderRadius: 5 }}>EXTRACTED</span>}
                    {m.in_stock === false && <span style={{ marginLeft: 6, fontSize: 9.5, fontWeight: 800, color: "#C0392B", background: "#FBE9E4", padding: "1px 6px", borderRadius: 5 }}>OOS</span>}
                  </div>
                </div>
                <button onClick={() => evict(g, m.id)} disabled={busy === m.id} title="Never pair this product with the rest of this group" style={{ background: "#fff", border: "1px solid #F0C8C0", color: "#C0392B", fontWeight: 700, fontSize: 11.5, padding: "6px 12px", borderRadius: 8, cursor: "pointer" }}>
                  ✕ Doesn&apos;t belong
                </button>
              </div>
            ))}
          </div>
        ))
      )}

      {/* Rejections */}
      <section>
        <h2 style={{ fontSize: 15, fontWeight: 700, margin: "8px 0 10px" }}>Rejected pairs ({rejected.length})</h2>
        {rejected.length === 0 ? (
          <div style={{ border: "1px dashed #D5DAE4", borderRadius: 12, padding: 18, fontSize: 13, color: "#8A93A6" }}>None yet. Evicting a product from a group records its pairs here.</div>
        ) : (
          <div style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 14, overflow: "hidden" }}>
            {rejected.map((r) => (
              <div key={`${r.a}|${r.b}`} style={{ display: "flex", gap: 10, alignItems: "center", padding: "9px 16px", borderTop: "1px solid #F7F8FB", fontSize: 12.5 }}>
                <span style={{ minWidth: 0, flex: 1, color: "#3A4358" }}>{r.aName} <span style={{ color: "#C0392B", fontWeight: 700 }}>≠</span> {r.bName}</span>
                <button
                  onClick={() => { setBusy(`${r.a}|${r.b}`); start(async () => { await restorePair(r.a, r.b); setBusy(null); router.refresh(); }); }}
                  disabled={busy === `${r.a}|${r.b}`}
                  style={{ background: "#fff", border: "1px solid #E0E4ED", fontWeight: 700, fontSize: 11.5, padding: "6px 12px", borderRadius: 8, cursor: "pointer" }}
                >
                  Restore
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

const sel: React.CSSProperties = { border: "1px solid #E0E4ED", borderRadius: 10, padding: "9px 12px", fontSize: 13.5, background: "#fff", outline: "none" };
