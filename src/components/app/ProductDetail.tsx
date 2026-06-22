"use client";

import ImageSlot from "@/components/ImageSlot";
import { GROTESK, MONO } from "@/lib/fonts";
import { fmt } from "@/lib/format";
import { buildProductChart } from "@/lib/charts";
import { tileFor, type Product } from "@/lib/data";

/**
 * Shared product-detail view. Used by BOTH the signed-in dashboard (variant
 * "app" — add to PO / project) and the public catalogue (variant "public" —
 * sign-in to order). Visually identical; only the action row differs.
 */
export default function ProductDetail({
  p,
  qty,
  setQty,
  onCatalogue,
  variant = "app",
  onAdd,
  onProject,
  onSignIn,
}: {
  p: Product;
  qty: number;
  setQty: (n: number) => void;
  onCatalogue: () => void;
  variant?: "app" | "public";
  onAdd?: () => void;
  onProject?: () => void;
  onSignIn?: () => void;
}) {
  const chart = buildProductChart(p);
  const save = Math.round((1 - p.price / p.market) * 100) + "%";
  const specs = [
    { k: "Brand", v: p.brand },
    { k: "Category", v: p.cat },
    { k: "Specification", v: p.spec },
    { k: "SKU", v: p.sku },
    { k: "Availability", v: "In stock · ships in 24h" },
  ];
  return (
    <div style={{ padding: "22px 30px 40px", maxWidth: 1120, margin: "0 auto", animation: "elumeFade .35s ease" }}>
      <div style={{ fontSize: 12, color: "#8A93A6", marginBottom: 16 }}>
        <span onClick={onCatalogue} style={{ cursor: "pointer" }}>Catalogue</span> &nbsp;/&nbsp; {p.cat} &nbsp;/&nbsp; <span style={{ color: "#56627A" }}>{p.name}</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: 24, alignItems: "start" }}>
        {/* image + specs */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 16, overflow: "hidden" }}>
            <div style={{ height: 230, position: "relative" }}>
              <ImageSlot id={`img-${p.sku}`} tile={tileFor(p.cat)} />
              <span style={{ position: "absolute", left: 14, bottom: 14, zIndex: 2, pointerEvents: "none", fontFamily: MONO, fontSize: 10.5, color: "#6b748c", background: "rgba(255,255,255,0.9)", padding: "4px 8px", borderRadius: 6 }}>{p.sku}</span>
              <span style={{ position: "absolute", right: 14, bottom: 14, zIndex: 2, pointerEvents: "none", fontSize: 12, fontWeight: 700, color: "#1F9D63", background: "#fff", padding: "5px 10px", borderRadius: 7 }}>↓ {save} below market</span>
            </div>
          </div>
          <div style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 16, padding: "6px 18px" }}>
            {specs.map((r) => (
              <div key={r.k} style={{ display: "flex", justifyContent: "space-between", gap: 14, padding: "12px 0", borderBottom: "1px solid #F5F6F9" }}>
                <span style={{ fontSize: 12.5, color: "#8A93A6" }}>{r.k}</span>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: "#19202E", textAlign: "right" }}>{r.v}</span>
              </div>
            ))}
          </div>
        </div>

        {/* info */}
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 16, padding: "24px 26px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#1F9D63" }} />
              <span style={{ fontSize: 12.5, color: "#8A93A6", fontWeight: 600 }}>{p.brand}</span>
              <span style={{ fontSize: 11, color: "#1F9D63", fontWeight: 600 }}>· In stock</span>
            </div>
            <h2 style={{ fontFamily: GROTESK, fontSize: 25, fontWeight: 600, letterSpacing: "-0.5px", margin: "0 0 16px" }}>{p.name}</h2>

            <div style={{ display: "flex", alignItems: "flex-end", gap: 14, marginBottom: 6 }}>
              <span style={{ fontFamily: GROTESK, fontSize: 34, fontWeight: 600, letterSpacing: "-1px", color: "#19202E" }}>{fmt(p.price)}</span>
              <span style={{ fontSize: 14, color: "#8A93A6", marginBottom: 6 }}>/{p.unit}</span>
              <span style={{ fontSize: 15, color: "#A0A7B5", textDecoration: "line-through", marginBottom: 7 }}>{fmt(p.market)}</span>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: "#1F9D63", background: "#E6F5EE", padding: "5px 10px", borderRadius: 8, marginBottom: 6 }}>Save {fmt(p.market - p.price)}</span>
            </div>
            <div style={{ fontSize: 12.5, color: "#56627A", marginBottom: 22 }}>Transparent price · {save} below the market rate Elume tracks daily. GST extra.</div>

            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ display: "flex", alignItems: "center", border: "1px solid #E8EBF1", borderRadius: 11, overflow: "hidden" }}>
                <div onClick={() => setQty(Math.max(1, qty - 1))} style={{ width: 42, height: 46, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#56627A", fontSize: 20 }}>−</div>
                <div style={{ width: 54, textAlign: "center", fontFamily: GROTESK, fontSize: 16, fontWeight: 600 }}>{qty}</div>
                <div onClick={() => setQty(qty + 1)} style={{ width: 42, height: 46, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#56627A", fontSize: 20 }}>+</div>
              </div>
              {variant === "app" ? (
                <>
                  <div onClick={onAdd} style={{ flex: 1, background: "#4E5BDC", color: "#fff", fontWeight: 600, fontSize: 14.5, textAlign: "center", padding: 14, borderRadius: 11, cursor: "pointer" }}>Add to PO · {fmt(p.price * qty)}</div>
                  <div onClick={onProject} style={{ background: "#fff", border: "1.5px solid #E0E4ED", color: "#19202E", fontWeight: 600, fontSize: 13.5, padding: "13px 18px", borderRadius: 11, cursor: "pointer", whiteSpace: "nowrap" }}>Add to a project</div>
                </>
              ) : (
                <div onClick={onSignIn} style={{ flex: 1, background: "#4E5BDC", color: "#fff", fontWeight: 600, fontSize: 14.5, textAlign: "center", padding: 14, borderRadius: 11, cursor: "pointer" }}>Sign in to order · {fmt(p.price * qty)}</div>
              )}
            </div>
            {variant === "public" && (
              <div style={{ fontSize: 12, color: "#8A93A6", marginTop: 12 }}>
                Ordering, purchase orders, and 30-day NBFC credit are available to signed-in buyers.
              </div>
            )}
          </div>

          {/* price history chart */}
          <div style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 16, padding: "22px 24px" }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
              <div>
                <div style={{ fontFamily: GROTESK, fontWeight: 600, fontSize: 15 }}>Price history · last 12 months</div>
                <div style={{ fontSize: 12, color: "#8A93A6", marginTop: 2 }}>Elume tracks this SKU&apos;s market price daily — buy when you&apos;re below the line.</div>
              </div>
              <div style={{ display: "flex", gap: 18, fontSize: 11, color: "#56627A" }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 15, height: 3, borderRadius: 2, background: "#4E5BDC", display: "inline-block" }} />Elume</span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 15, height: 0, borderTop: "2px dashed #AEB6C4", display: "inline-block" }} />Market</span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><span style={{ width: 13, height: 9, borderRadius: 3, background: "rgba(31,157,99,0.16)", display: "inline-block" }} />Saving</span>
              </div>
            </div>
            <svg viewBox={`0 0 ${chart.vbW} ${chart.vbH}`} style={{ width: "100%", height: "auto", display: "block" }}>
              {chart.gridLines.map((g, i) => (
                <line key={i} x1="0" x2="860" y1={g.y} y2={g.y} style={{ stroke: "#EEF0F4", strokeWidth: "1px" }} />
              ))}
              <path d={chart.bandPath} style={{ fill: "rgba(31,157,99,0.14)", stroke: "none" }} />
              <path d={chart.marketPath} style={{ fill: "none", stroke: "#AEB6C4", strokeWidth: "2px", strokeDasharray: "5 4" }} />
              <path d={chart.elumePath} style={{ fill: "none", stroke: "#4E5BDC", strokeWidth: "2.5px", strokeLinejoin: "round" }} />
              <circle cx={chart.endX} cy={chart.endYm} r="3.5" style={{ fill: "#AEB6C4" }} />
              <circle cx={chart.endX} cy={chart.endYe} r="5" style={{ fill: "#4E5BDC", stroke: "#fff", strokeWidth: "2px" }} />
            </svg>
            <div style={{ display: "flex", justifyContent: "space-between", fontFamily: MONO, fontSize: 10, color: "#A0A7B5", marginTop: 4, padding: "0 6px" }}>
              <span>Jul &apos;25</span><span>Sep</span><span>Nov</span><span>Jan &apos;26</span><span>Mar</span><span>Jun &apos;26</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginTop: 18, paddingTop: 18, borderTop: "1px solid #F0F2F6" }}>
              <PdStat label="Elume today" value={chart.cur} />
              <PdStat label="Market today" value={chart.mkt} color="#56627A" />
              <PdStat label="12-mo low" value={chart.low} />
              <PdStat label="12-mo average" value={chart.avg} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PdStat({ label, value, color = "#19202E" }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: "#8A93A6" }}>{label}</div>
      <div style={{ fontFamily: GROTESK, fontSize: 17, fontWeight: 600, color }}>{value}</div>
    </div>
  );
}
