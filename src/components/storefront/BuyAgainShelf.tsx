"use client";

/**
 * "Buy again" — the signed-in shopper's own products, hoisted above the
 * catalogue grid. Fetches after hydration (the catalogue page itself stays
 * static/ISR for everyone); renders nothing for anonymous visitors or
 * customers with no orders. Also identifies the session for analytics, so
 * signed-in browsing is attributed even before any checkout.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { useCart } from "@/lib/cart";
import { fmt } from "@/lib/format";
import { identify } from "@/lib/analytics";

type Item = { id: string; name: string; brand: string; cat: string; price: number; mrp: number; unit: string; image: string | null };

export default function BuyAgainShelf() {
  const { add } = useCart();
  const [items, setItems] = useState<Item[]>([]);
  const [added, setAdded] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/me/buy-again")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.items)) setItems(d.items);
        if (d.email) identify(d.email, d.name ?? null);
      })
      .catch(() => {});
  }, []);

  if (!items.length) return null;

  return (
    <section style={{ margin: "0 0 22px" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 10 }}>
        <h2 style={{ fontFamily: "var(--space-grotesk)", fontSize: 18, fontWeight: 600, margin: 0 }}>Buy again</h2>
        <span style={{ fontSize: 12.5, color: "#8A93A6" }}>from your past orders</span>
      </div>
      <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 6, WebkitOverflowScrolling: "touch" }}>
        {items.map((p) => (
          <div key={p.id} style={{ flex: "0 0 172px", background: "#fff", border: "1px solid #E8EBF1", borderRadius: 13, padding: 10, display: "flex", flexDirection: "column" }}>
            <Link href={`/catalogue/${p.id}`} style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 86, marginBottom: 8 }}>
              {p.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.image} alt={p.name} loading="lazy" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
              ) : (
                <span style={{ fontSize: 26 }}>🔌</span>
              )}
            </Link>
            <Link href={`/catalogue/${p.id}`} style={{ fontSize: 12, fontWeight: 600, color: "#19202E", lineHeight: 1.35, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", minHeight: 32 }}>
              {p.name}
            </Link>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: "#19202E", margin: "6px 0 8px" }}>{fmt(p.price)}</div>
            <button
              onClick={() => { add({ id: p.id, name: p.name, brand: p.brand, price: p.price, mrp: p.mrp, unit: p.unit, cat: p.cat, image: p.image ?? undefined }); setAdded(p.id); setTimeout(() => setAdded(null), 1800); }}
              style={{ marginTop: "auto", background: added === p.id ? "#1F9D63" : "#EEF0FD", color: added === p.id ? "#fff" : "#4E5BDC", border: "none", borderRadius: 8, padding: "8px 0", fontSize: 12, fontWeight: 700, cursor: "pointer", transition: "all .15s" }}
            >
              {added === p.id ? "✓ Added" : "Add to cart"}
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
