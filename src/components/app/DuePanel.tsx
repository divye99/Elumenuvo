"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fmt } from "@/lib/format";
import type { Portfolio } from "@/lib/personal/engine";

/**
 * Workspace home: "Your buying portfolio" + "Due for a reorder".
 *
 * The replenishment engine reads this account's own repeat-purchase cadence
 * (median gap between buys of the same product) and surfaces what's due,
 * with the reason spelled out - transparent prediction, not a black box.
 *
 * Cart writes go straight to localStorage (BuyAgainButton pattern): this
 * panel renders inside the workspace shell, outside the storefront
 * CartProvider. Checkout re-prices from the database, so no stale prices.
 */
const CART_KEY = "elume.cart";

export default function DuePanel() {
  const [pf, setPf] = useState<Portfolio | null>(null);
  const [added, setAdded] = useState<Set<string>>(new Set());
  const router = useRouter();

  useEffect(() => {
    let live = true;
    fetch("/api/personal/portfolio")
      .then((r) => r.json())
      .then((d) => { if (live && d?.portfolio) setPf(d.portfolio); })
      .catch(() => {});
    return () => { live = false; };
  }, []);

  if (!pf) return null;

  const add = (d: Portfolio["due"][number]) => {
    try {
      type Row = Record<string, unknown> & { id: string; qty?: number };
      let cart: Row[] = [];
      try {
        const parsed = JSON.parse(localStorage.getItem(CART_KEY) || "[]");
        if (Array.isArray(parsed)) cart = parsed.filter((i): i is Row => !!i && typeof i.id === "string");
      } catch { /* fresh cart */ }
      const existing = cart.find((i) => i.id === d.id);
      if (existing) existing.qty = Math.max(Number(existing.qty) || 1, 1);
      else cart.push({ id: d.id, name: d.name, brand: d.brand, price: d.price, mrp: d.market, unit: d.unit, cat: d.cat, gstRate: d.gstRate, image: d.image, qty: 1 });
      localStorage.setItem(CART_KEY, JSON.stringify(cart));
      setAdded((prev) => new Set(prev).add(d.id));
    } catch { /* ignore */ }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 18 }}>
      {/* Portfolio summary */}
      <div style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 14, padding: "14px 18px" }}>
        <div style={{ display: "flex", gap: 22, flexWrap: "wrap", alignItems: "baseline" }}>
          <span style={{ fontSize: 14.5, fontWeight: 700 }}>Your buying portfolio</span>
          <span style={{ fontSize: 12.5, color: "#8A93A6" }}><b style={{ color: "#19202E", fontSize: 14 }}>{pf.orders}</b> orders</span>
          <span style={{ fontSize: 12.5, color: "#8A93A6" }}><b style={{ color: "#19202E", fontSize: 14 }}>{pf.units}</b> units</span>
          <span style={{ fontSize: 12.5, color: "#8A93A6" }}><b style={{ color: "#19202E", fontSize: 14 }}>{fmt(pf.spend)}</b> lifetime</span>
        </div>
        {pf.byCategory.length > 0 && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
            {pf.byCategory.slice(0, 5).map((c) => (
              <span key={c.cat} style={{ fontSize: 11.5, fontWeight: 600, color: "#3A4358", background: "#F5F6F9", border: "1px solid #E8EBF1", borderRadius: 999, padding: "4px 11px" }}>
                {c.cat} · {fmt(c.spend)}
              </span>
            ))}
            {pf.byBrand.slice(0, 3).map((b) => (
              <span key={b.brand} style={{ fontSize: 11.5, fontWeight: 600, color: "#3A46B8", background: "#EEF0FE", border: "1px solid #DDE1FB", borderRadius: 999, padding: "4px 11px" }}>
                {b.brand}
              </span>
            ))}
          </div>
        )}
        {pf.nextCategories.length > 0 && (
          <div style={{ marginTop: 10, fontSize: 12.5, color: "#56627A" }}>
            <b style={{ color: "#19202E" }}>Likely next for your project:</b>{" "}
            {pf.nextCategories.map((n, i) => (
              <span key={n.cat}>
                {i > 0 && " · "}
                <a href={`/catalogue?cat=${encodeURIComponent(n.cat)}`} style={{ color: "#4E5BDC", fontWeight: 700 }} title={n.why}>{n.cat}</a>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Due for reorder */}
      {pf.due.length > 0 && (
        <div style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 14, padding: "14px 18px" }}>
          <div style={{ fontSize: 14.5, fontWeight: 700, marginBottom: 3 }}>Due for a reorder</div>
          <div style={{ fontSize: 12, color: "#8A93A6", marginBottom: 12 }}>
            Predicted from your own buying cycle - each card says why.
          </div>
          <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 6 }}>
            {pf.due.map((d) => (
              <div key={d.id} style={{ width: 190, flex: "none", border: "1px solid #EEF0F4", borderRadius: 12, padding: 11, display: "flex", flexDirection: "column" }}>
                <div style={{ height: 74, borderRadius: 9, border: "1px solid #F0F2F6", background: d.image ? `center/contain no-repeat url(${d.image}) #fff` : "#F5F6F9", marginBottom: 7 }} />
                <div style={{ fontSize: 12, fontWeight: 700, lineHeight: 1.35, minHeight: 32, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{d.name}</div>
                <div style={{ fontSize: 10.5, color: "#C77700", background: "#FFF9EE", borderRadius: 7, padding: "4px 8px", margin: "6px 0", lineHeight: 1.4 }}>
                  Every ~{d.gapDays} days · last {d.lastDays} days ago · ordered {d.times}×
                </div>
                <div style={{ marginTop: "auto", display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 800 }}>{fmt(d.price)}</span>
                  {added.has(d.id) ? (
                    <button onClick={() => router.push("/cart")} style={{ marginLeft: "auto", background: "none", border: "none", color: "#137a4b", fontWeight: 700, fontSize: 11.5, cursor: "pointer" }}>✓ Cart →</button>
                  ) : (
                    <button onClick={() => add(d)} style={{ marginLeft: "auto", background: "#EEF0FE", color: "#4E5BDC", border: "none", fontWeight: 700, fontSize: 11.5, padding: "6px 11px", borderRadius: 8, cursor: "pointer" }}>Add</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
