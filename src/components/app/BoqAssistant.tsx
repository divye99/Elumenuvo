"use client";

/**
 * Smart BOM review UI (v1). Paste a BOQ or drop a CSV/XLSX, the homegrown
 * matcher proposes a product per line with confidence + alternates, the user
 * reviews and pushes confirmed lines to the cart. Every decision posts to
 * /api/boq/feedback - the learning loop that makes the next match better.
 * Nothing reaches the cart without explicit confirmation (owner accuracy bar).
 */
import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useCartOptional } from "@/lib/cart";
import { GROTESK, MONO } from "@/lib/fonts";

type LineResult = {
  position: number;
  raw: string;
  description: string;
  qty: number | null;
  unit: string | null;
  productId: string | null;
  confidence: number;
  method: string | null;
  alternates: string[];
  finalQty: number | null;
  qtyNote: string | null;
};
type Summary = { id: string; name: string; brand: string; sku: string; price: number; mrp: number; unit: string; cat: string; gstRate?: number; image?: string };
type MatchResponse = { ok: boolean; error?: string; uploadId: string | null; lines: LineResult[]; products: Record<string, Summary> };

type Decision = { productId: string | null; qty: number; state: "pending" | "accepted" | "rejected" | "not_stocked" };

const fmt = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

/** admin: the console variant (/admin/boq). Same matcher, same learning
 *  loop, but the finish line is a shareable cart LINK for the customer
 *  instead of a push into the visitor's own cart, and the self-rating
 *  prompt is skipped (the owner rating their own tool is noise). */
export default function BoqAssistant({ company, admin = false }: { company?: string; admin?: boolean }) {
  const cart = useCartOptional();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<MatchResponse | null>(null);
  const [decisions, setDecisions] = useState<Record<number, Decision>>({});
  const [added, setAdded] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [reviewed, setReviewed] = useState(false);

  const runMatch = useCallback(async (payload: { source: string; text?: string; rows?: string[][]; name?: string }) => {
    setBusy(true); setError(null); setResult(null); setAdded(false);
    try {
      const res = await fetch("/api/boq/match", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const data: MatchResponse = await res.json();
      if (!res.ok || !data.ok) { setError(data.error ?? "Matching failed - try again."); return; }
      setResult(data);
      const d: Record<number, Decision> = {};
      for (const l of data.lines) d[l.position] = { productId: l.productId, qty: l.finalQty ?? l.qty ?? 1, state: "pending" };
      setDecisions(d);
    } catch {
      setError("Network error - try again.");
    } finally {
      setBusy(false);
    }
  }, []);

  const onFile = useCallback(async (file: File) => {
    const name = file.name;
    if (/\.csv$/i.test(name) || file.type === "text/csv") {
      runMatch({ source: "csv", text: await file.text(), name });
    } else if (/\.xlsx?$/i.test(name)) {
      const XLSX = await import("xlsx");
      const wb = XLSX.read(await file.arrayBuffer());
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, raw: false, defval: "" }) as unknown as string[][];
      runMatch({ source: "xlsx", rows: rows.map((r) => r.map(String)), name });
    } else {
      runMatch({ source: "paste", text: await file.text(), name });
    }
  }, [runMatch]);

  // CSV text goes through the server parser via rows=undefined text path; the
  // server treats source csv text as free lines - so pre-split CSV client-side.
  const submitPaste = () => runMatch({ source: "paste", text });

  const summaryOf = (id: string | null): Summary | null => (id && result ? result.products[id] ?? null : null);

  const stats = useMemo(() => {
    if (!result) return null;
    const lines = result.lines;
    const dec = Object.values(decisions);
    return {
      total: lines.length,
      matched: lines.filter((l) => l.productId).length,
      high: lines.filter((l) => l.confidence >= 0.85).length,
      accepted: dec.filter((d) => d.state === "accepted").length,
      value: dec.filter((d) => d.state === "accepted").reduce((a, d) => a + (summaryOf(d.productId)?.price ?? 0) * d.qty, 0),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, decisions]);

  const acceptAll = (minConf: number) => {
    if (!result) return;
    setDecisions((prev) => {
      const next = { ...prev };
      for (const l of result.lines) {
        if (l.productId && l.confidence >= minConf && next[l.position].state === "pending") {
          next[l.position] = { ...next[l.position], state: "accepted" };
        }
      }
      return next;
    });
  };

  const pushToCart = async () => {
    if (!result) return;
    const feedback: Array<{ position: number; description: string; action: "confirmed" | "swapped" | "rejected" | "unmatched_confirmed"; productId?: string | null; finalQty?: number | null }> = [];
    let count = 0;
    for (const l of result.lines) {
      const d = decisions[l.position];
      if (!d) continue;
      if (d.state === "accepted" && d.productId) {
        const p = summaryOf(d.productId);
        if (p) {
          if (!admin) cart?.add({ id: p.id, name: p.name, brand: p.brand, price: p.price, mrp: p.mrp, unit: p.unit, cat: p.cat, gstRate: p.gstRate, image: p.image }, Math.max(1, d.qty));
          count++;
          feedback.push({ position: l.position, description: l.description, action: d.productId === l.productId ? "confirmed" : "swapped", productId: d.productId, finalQty: d.qty });
        }
      } else if (d.state === "rejected") {
        feedback.push({ position: l.position, description: l.description, action: "rejected", productId: null });
      } else if (d.state === "not_stocked") {
        feedback.push({ position: l.position, description: l.description, action: "unmatched_confirmed", productId: null });
      }
    }
    if (feedback.length && result.uploadId) {
      fetch("/api/boq/feedback", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ uploadId: result.uploadId, lines: feedback }) }).catch(() => {});
    }
    if (count) setAdded(true);
  };

  const confBadge = (c: number) => {
    const [bg, fg, label] = c >= 0.85 ? ["#E7F6EE", "#1F9D63", "match"] : c >= 0.5 ? ["#FFF4E0", "#B7791F", "check"] : ["#FDECEC", "#C0392B", "low"];
    return <span style={{ fontSize: 10, fontWeight: 700, background: bg, color: fg, padding: "2px 7px", borderRadius: 6, textTransform: "uppercase", letterSpacing: "0.4px" }}>{Math.round(c * 100)}% {label}</span>;
  };

  // Admin finish line: the approved lines as a /admin/cart-links prefill.
  const itemsParam = useMemo(() => {
    if (!result) return "";
    return Object.values(decisions)
      .filter((d) => d.state === "accepted" && d.productId)
      .map((d) => `${d.productId}:${Math.max(1, d.qty)}`)
      .join(",");
  }, [result, decisions]);

  return (
    <div style={{ maxWidth: 1140, margin: "0 auto", padding: "26px 22px 80px" }}>
      <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "1.4px", textTransform: "uppercase", color: "#4E5BDC", marginBottom: 8 }}>
        Smart BOM · {admin ? "admin console" : "business beta"}{company ? ` · ${company}` : ""}
      </div>
      <h1 style={{ fontFamily: GROTESK, fontSize: 30, fontWeight: 600, letterSpacing: "-0.8px", margin: "0 0 6px" }}>
        {admin ? "Turn a customer's BOQ into a cart link" : "Turn your BOQ into a cart"}
      </h1>
      <p style={{ fontSize: 14.5, color: "#56627A", margin: "0 0 22px", maxWidth: 640, lineHeight: 1.6 }}>
        {admin
          ? "Paste the enquiry's line items or drop their CSV/Excel sheet. Approve the matches, then hand the result to the cart-link builder to send on WhatsApp. Your corrections train the matcher for everyone."
          : "Paste the line items or drop a CSV/Excel sheet. We match every line to the catalogue, convert quantities (metres to coils included), and flag anything we do not stock. Nothing is added until you approve it."}
      </p>

      {!result && (
        <section style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 16, padding: 22 }}>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={"Paste BOQ lines, one per line, e.g.\n2.5 sqmm FRLS copper wire red - 500 mtr\nMCB 32A C curve SP - 12 nos\nPolycab 1.5 sq mm green earth wire 180 m - 4 coil"}
            style={{ width: "100%", minHeight: 180, fontFamily: MONO, fontSize: 13, lineHeight: 1.7, border: "1px solid #E8EBF1", borderRadius: 12, padding: 14, resize: "vertical", color: "#19202E", background: "#FBFCFE" }}
          />
          <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 14, flexWrap: "wrap" }}>
            <button
              onClick={submitPaste}
              disabled={busy || !text.trim()}
              style={{ background: busy || !text.trim() ? "#C9CFDD" : "#4E5BDC", color: "#fff", fontSize: 14, fontWeight: 700, padding: "11px 22px", borderRadius: 10, border: "none", cursor: busy ? "wait" : "pointer" }}
            >
              {busy ? "Matching…" : "Match my BOQ"}
            </button>
            <label style={{ fontSize: 13.5, fontWeight: 600, color: "#4E5BDC", cursor: "pointer" }}>
              or upload CSV / Excel
              <input type="file" accept=".csv,.xlsx,.xls,text/csv" style={{ display: "none" }} onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
            </label>
          </div>
          {error && <div style={{ marginTop: 12, fontSize: 13, color: "#C0392B", fontWeight: 600 }}>{error}</div>}
        </section>
      )}

      {result && stats && (
        <>
          <section style={{ display: "flex", gap: 10, flexWrap: "wrap", margin: "6px 0 16px" }}>
            {[
              [`${stats.total}`, "lines parsed"],
              [`${stats.matched}`, "matched"],
              [`${stats.high}`, "high confidence"],
              [`${stats.accepted}`, "approved"],
              [fmt(stats.value), "approved value"],
            ].map(([v, l]) => (
              <div key={l} style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 12, padding: "10px 16px" }}>
                <div style={{ fontFamily: GROTESK, fontSize: 20, fontWeight: 600 }}>{v}</div>
                <div style={{ fontSize: 11, color: "#8A93A6" }}>{l}</div>
              </div>
            ))}
            <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center" }}>
              <button onClick={() => acceptAll(0.85)} style={{ background: "#EEF0FE", color: "#4E5BDC", border: "none", fontSize: 13, fontWeight: 700, padding: "10px 16px", borderRadius: 10, cursor: "pointer" }}>
                Approve all high-confidence
              </button>
              <button onClick={() => { setResult(null); setDecisions({}); }} style={{ background: "none", border: "1px solid #E8EBF1", fontSize: 13, fontWeight: 600, color: "#56627A", padding: "10px 16px", borderRadius: 10, cursor: "pointer" }}>
                Start over
              </button>
            </div>
          </section>

          <section style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 16, overflow: "hidden" }}>
            {result.lines.map((l) => {
              const d = decisions[l.position];
              const p = summaryOf(d?.productId ?? null);
              const unmatched = !l.productId;
              return (
                <div key={l.position} style={{ borderTop: l.position ? "1px solid #F0F2F6" : "none", padding: "14px 18px", display: "flex", gap: 14, alignItems: "flex-start", flexWrap: "wrap", background: d?.state === "accepted" ? "#F7FCF9" : d?.state === "rejected" || d?.state === "not_stocked" ? "#FAFAFB" : "#fff" }}>
                  <div style={{ flex: "1 1 240px", minWidth: 220 }}>
                    <div style={{ fontFamily: MONO, fontSize: 11.5, color: "#8A93A6", marginBottom: 3 }}>line {l.position + 1}</div>
                    <div style={{ fontSize: 13.5, color: "#19202E", lineHeight: 1.5 }}>{l.raw}</div>
                    {l.qty != null && <div style={{ fontSize: 11.5, color: "#8A93A6", marginTop: 3 }}>qty {l.qty}{l.unit ? ` ${l.unit}` : ""}{l.qtyNote ? ` · ${l.qtyNote}` : ""}</div>}
                  </div>

                  <div style={{ flex: "1 1 340px", minWidth: 300 }}>
                    {unmatched ? (
                      <div style={{ fontSize: 13, color: "#B7791F", fontWeight: 600 }}>
                        No catalogue match. Not something we stock yet?
                        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                          <button onClick={() => setDecisions((x) => ({ ...x, [l.position]: { ...x[l.position], state: "not_stocked" } }))} style={{ fontSize: 12, fontWeight: 700, border: "1px solid #E8EBF1", background: d?.state === "not_stocked" ? "#EEF0FE" : "#fff", color: "#4E5BDC", padding: "6px 12px", borderRadius: 8, cursor: "pointer" }}>
                            {d?.state === "not_stocked" ? "Reported ✓" : "Report as missing"}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                          {p?.image && <img src={p.image} alt="" style={{ width: 44, height: 44, objectFit: "contain", borderRadius: 8, border: "1px solid #EEF0F4", background: "#fff" }} />}
                          <div style={{ minWidth: 0 }}>
                            <Link href={`/catalogue/${p?.id}`} target="_blank" style={{ fontSize: 13.5, fontWeight: 600, color: "#3A46B8", lineHeight: 1.35, display: "block" }}>{p?.name}</Link>
                            <div style={{ fontSize: 11.5, color: "#8A93A6", marginTop: 2 }}>
                              {p ? `${fmt(p.price)} / ${p.unit}` : ""} {confBadge(l.confidence)}
                            </div>
                          </div>
                        </div>
                        {l.alternates.length > 0 && (
                          <select
                            value={d?.productId ?? ""}
                            onChange={(e) => setDecisions((x) => ({ ...x, [l.position]: { ...x[l.position], productId: e.target.value, state: "pending" } }))}
                            style={{ marginTop: 8, fontSize: 12.5, border: "1px solid #E8EBF1", borderRadius: 8, padding: "6px 8px", maxWidth: "100%", color: "#3A4358", background: "#fff" }}
                          >
                            <option value={l.productId!}>{summaryOf(l.productId)?.name.slice(0, 70)}</option>
                            {l.alternates.map((id) => (
                              <option key={id} value={id}>{summaryOf(id)?.name.slice(0, 70) ?? id}</option>
                            ))}
                          </select>
                        )}
                      </>
                    )}
                  </div>

                  {!unmatched && (
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flex: "0 0 auto" }}>
                      <input
                        type="number"
                        min={1}
                        value={d?.qty ?? 1}
                        onChange={(e) => setDecisions((x) => ({ ...x, [l.position]: { ...x[l.position], qty: Math.max(1, Number(e.target.value) || 1) } }))}
                        style={{ width: 64, fontSize: 13, border: "1px solid #E8EBF1", borderRadius: 8, padding: "7px 8px", textAlign: "center" }}
                      />
                      <span style={{ fontSize: 11.5, color: "#8A93A6" }}>{p?.unit ?? ""}</span>
                      <button onClick={() => setDecisions((x) => ({ ...x, [l.position]: { ...x[l.position], state: x[l.position].state === "accepted" ? "pending" : "accepted" } }))} style={{ fontSize: 12.5, fontWeight: 700, border: "none", background: d?.state === "accepted" ? "#1F9D63" : "#EEF0FE", color: d?.state === "accepted" ? "#fff" : "#4E5BDC", padding: "8px 14px", borderRadius: 8, cursor: "pointer" }}>
                        {d?.state === "accepted" ? "Approved ✓" : "Approve"}
                      </button>
                      <button onClick={() => setDecisions((x) => ({ ...x, [l.position]: { ...x[l.position], state: "rejected" } }))} style={{ fontSize: 12.5, fontWeight: 600, border: "1px solid #E8EBF1", background: d?.state === "rejected" ? "#F4F5F8" : "#fff", color: "#8A93A6", padding: "8px 12px", borderRadius: 8, cursor: "pointer" }}>
                        ✕
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </section>

          <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 18, flexWrap: "wrap" }}>
            <button
              onClick={pushToCart}
              disabled={stats.accepted === 0}
              style={{ background: stats.accepted ? "#1F9D63" : "#C9CFDD", color: "#fff", fontSize: 14.5, fontWeight: 700, padding: "12px 24px", borderRadius: 11, border: "none", cursor: stats.accepted ? "pointer" : "default" }}
            >
              {admin
                ? `Confirm ${stats.accepted} approved line${stats.accepted === 1 ? "" : "s"} · ${fmt(stats.value)}`
                : `Add ${stats.accepted} approved line${stats.accepted === 1 ? "" : "s"} to cart · ${fmt(stats.value)}`}
            </button>
            {added && (admin ? (
              <a href={`/admin/cart-links?items=${encodeURIComponent(itemsParam)}`} style={{ fontSize: 14, fontWeight: 700, color: "#1F9D63" }}>
                Confirmed ✓ · build the cart link →
              </a>
            ) : (
              <Link href="/cart" style={{ fontSize: 14, fontWeight: 700, color: "#1F9D63" }}>
                Added ✓ · review your cart →
              </Link>
            ))}
          </div>

          {/* Post-use feedback (owner ask): the tool is self-learning and so
              are we - ask for a rating right after the BOQ lands in the cart.
              Skipped on the admin console. */}
          {added && !admin && !reviewed && (
            <section style={{ marginTop: 20, background: "#fff", border: "1px solid #E8EBF1", borderRadius: 14, padding: "16px 20px", maxWidth: 560 }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>How did Smart BOM do?</div>
              <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} onClick={() => setRating(n)} aria-label={`${n} star`} style={{ fontSize: 22, background: "none", border: "none", cursor: "pointer", color: n <= rating ? "#F4B400" : "#D4D8E0" }}>★</button>
                ))}
              </div>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="What did it get wrong? What should it handle next? Every note trains it."
                style={{ width: "100%", minHeight: 64, fontSize: 13, border: "1px solid #E8EBF1", borderRadius: 10, padding: 10, resize: "vertical" }}
              />
              <button
                onClick={async () => {
                  if (!rating) return;
                  await fetch("/api/boq/review", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ rating, comment, uploadId: result?.uploadId }) }).catch(() => {});
                  setReviewed(true);
                }}
                disabled={!rating}
                style={{ marginTop: 10, background: rating ? "#4E5BDC" : "#C9CFDD", color: "#fff", fontSize: 13, fontWeight: 700, padding: "9px 18px", borderRadius: 9, border: "none", cursor: rating ? "pointer" : "default" }}
              >
                Send feedback
              </button>
            </section>
          )}
          {reviewed && <div style={{ marginTop: 16, fontSize: 13.5, fontWeight: 600, color: "#1F9D63" }}>Thank you - your feedback trains the matcher directly.</div>}
        </>
      )}
    </div>
  );
}
