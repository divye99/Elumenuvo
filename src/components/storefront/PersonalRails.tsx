"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { sid, track } from "@/lib/analytics";
import { fmt } from "@/lib/format";
import { gstBreakdown } from "@/lib/pricing";
import { useCart } from "@/lib/cart";
import type { Rail, RailItem } from "@/lib/personal/engine";

/**
 * Client half of personalisation: fetches the rails for this device (and
 * session, when signed in) after hydration, so every page stays fully
 * cacheable while still greeting each visitor with their own shelves.
 * Renders nothing until rails exist - cold visitors see no skeleton flash.
 *
 * Every click is logged as reco_pick / reco_add with the rail key, which is
 * the feedback loop that will train ranking later.
 */
export default function PersonalRails({ ctx, heading }: { ctx: string; heading?: boolean }) {
  const [rails, setRails] = useState<Rail[] | null>(null);
  const cart = useCart();
  const [added, setAdded] = useState<Set<string>>(new Set());

  useEffect(() => {
    let live = true;
    const s = sid();
    fetch(`/api/personal/rails?ctx=${encodeURIComponent(ctx)}${s ? `&sid=${encodeURIComponent(s)}` : ""}`)
      .then((r) => r.json())
      .then((d) => { if (live && Array.isArray(d?.rails) && d.rails.length) setRails(d.rails); })
      .catch(() => {});
    return () => { live = false; };
  }, [ctx]);

  if (!rails) return null;

  const add = (rail: Rail, p: RailItem) => {
    cart.add({ id: p.id, name: p.name, brand: p.brand, price: p.price, mrp: p.market, unit: p.unit, cat: p.cat, gstRate: p.gstRate, image: p.image }, 1);
    setAdded((prev) => new Set(prev).add(p.id));
    track("reco_add", { detail: { rail: rail.key, to: p.id, ctx } });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
      {rails.map((rail) => (
        <section key={rail.key}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap", marginBottom: 4 }}>
            <h2 style={{ fontSize: 19, fontWeight: 700, letterSpacing: "-0.3px", margin: 0 }}>{rail.title}</h2>
            <span style={{ fontSize: 12.5, color: "#8A93A6" }}>{rail.reason}</span>
            {heading && <Link href="/for-you" style={{ marginLeft: "auto", fontSize: 13, fontWeight: 700, color: "#4E5BDC" }}>Everything for you →</Link>}
          </div>
          <div style={{ display: "flex", gap: 14, overflowX: "auto", padding: "10px 2px 12px", scrollSnapType: "x proximity" }}>
            {rail.items.map((p) => {
              const gb = gstBreakdown(p.price, p.cat, p.gstRate);
              return (
                <div key={p.id} style={{ width: 188, flex: "none", background: "#fff", border: "1px solid #E8EBF1", borderRadius: 14, padding: 12, scrollSnapAlign: "start", display: "flex", flexDirection: "column" }}>
                  <Link href={`/catalogue/${p.id}`} onClick={() => track("reco_pick", { detail: { rail: rail.key, to: p.id, ctx } })}>
                    <div style={{ height: 108, borderRadius: 10, border: "1px solid #EEF0F4", background: p.image ? `center/contain no-repeat url(${p.image}) #fff` : "#F5F6F9", marginBottom: 8 }} />
                    <div style={{ fontSize: 10.5, fontWeight: 700, color: "#8A93A6" }}>{p.brand.toUpperCase()}</div>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: "#19202E", lineHeight: 1.35, minHeight: 34, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                      {p.name}
                    </div>
                  </Link>
                  {p.note && <div style={{ fontSize: 10.5, color: "#C77700", background: "#FFF9EE", borderRadius: 7, padding: "4px 8px", margin: "6px 0 0", lineHeight: 1.4 }}>{p.note}</div>}
                  <div style={{ marginTop: "auto", paddingTop: 8 }}>
                    <span style={{ fontSize: 14.5, fontWeight: 800 }}>{fmt(gb.base)}</span>
                    <span style={{ fontSize: 10, color: "#8A93A6" }}> +GST /{p.unit}</span>
                    {added.has(p.id) ? (
                      <Link href="/cart" style={{ display: "block", textAlign: "center", fontSize: 12, fontWeight: 700, color: "#137a4b", padding: "7px 0 0" }}>✓ In cart →</Link>
                    ) : (
                      <button onClick={() => add(rail, p)} style={{ display: "block", width: "100%", marginTop: 7, background: "#EEF0FE", color: "#4E5BDC", border: "none", fontWeight: 700, fontSize: 12, padding: "7px 0", borderRadius: 8, cursor: "pointer" }}>
                        Add to cart
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
