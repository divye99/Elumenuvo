"use client";

import { useMemo, useState } from "react";
import { fmt } from "@/lib/format";
import { searchTokens, matchesAll } from "@/lib/search-normalize";
import { shippingFeeFor } from "@/lib/pricing";
import type { Product } from "@/lib/data";

/** Compose a cart, get the link, send it on WhatsApp. */
export default function CartLinkBuilder({ products }: { products: Product[] }) {
  const [q, setQ] = useState("");
  const [chosen, setChosen] = useState<Map<string, number>>(new Map());
  const [phone, setPhone] = useState("");
  const [copied, setCopied] = useState<"link" | "msg" | null>(null);

  const results = useMemo(() => {
    const toks = searchTokens(q);
    if (toks.length === 0) return [];
    return products.filter((p) => matchesAll(`${p.brand} ${p.name} ${p.spec} ${p.sku} ${p.cat}`, toks)).slice(0, 30);
  }, [q, products]);

  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const rows = [...chosen.entries()].map(([id, qty]) => ({ p: byId.get(id)!, qty })).filter((r) => r.p);
  const goodsTotal = rows.reduce((s, r) => s + r.p.price * r.qty, 0);
  const shipping = goodsTotal > 0 ? shippingFeeFor(goodsTotal) : 0;

  const setQty = (id: string, qty: number) =>
    setChosen((prev) => {
      const next = new Map(prev);
      if (qty <= 0) next.delete(id);
      else next.set(id, Math.min(999, qty));
      return next;
    });

  const link = rows.length
    ? `${typeof window !== "undefined" ? window.location.origin : "https://elumenuvo.com"}/cart/link?items=${rows.map((r) => `${r.p.id}:${r.qty}`).join(",")}&src=wa`
    : "";

  const message = link
    ? `Hi! I have prepared your Elume cart with the item${rows.length === 1 ? "" : "s"} we discussed. Open this link to review and checkout: ${link}\n\nYou get a GST invoice with every order${shipping === 0 ? " and delivery on this order is free" : ""}.`
    : "";

  // WhatsApp deep link: with a phone it opens that chat, without one it opens
  // WhatsApp's own "choose a chat" picker.
  const digits = phone.replace(/\D/g, "");
  const waNumber = digits.length === 10 ? `91${digits}` : digits;
  const waHref = message
    ? waNumber.length >= 11
      ? `https://wa.me/${waNumber}?text=${encodeURIComponent(message)}`
      : `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`
    : "";

  const copy = (text: string, which: "link" | "msg") => {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(which);
      setTimeout(() => setCopied(null), 1600);
    });
  };

  const inp: React.CSSProperties = { border: "1px solid #E0E4ED", borderRadius: 10, padding: "10px 13px", fontSize: 13.5, outline: "none", background: "#fff" };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: 18, alignItems: "start" }}>
      {/* ── Left: pick products ── */}
      <div style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 14, padding: 18 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>1 · Add products</div>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, SKU, brand…" style={{ ...inp, width: "100%", boxSizing: "border-box" }} />
        <div style={{ marginTop: 10, maxHeight: 420, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
          {q.trim() && results.length === 0 && <div style={{ fontSize: 12.5, color: "#8A93A6", padding: "14px 4px" }}>No products match.</div>}
          {results.map((p) => (
            <div key={p.id} style={{ display: "flex", gap: 10, alignItems: "center", border: "1px solid #F0F2F6", borderRadius: 10, padding: "8px 10px" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <div style={{ width: 38, height: 38, borderRadius: 8, flex: "none", background: p.image ? `center/contain no-repeat url(${p.image}) #fff` : "#F0F2F6", border: "1px solid #EEF0F4" }} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div>
                <div style={{ fontSize: 11, color: "#8A93A6" }}>{p.brand} · {p.sku} · {fmt(p.price)} incl. GST</div>
              </div>
              {chosen.has(p.id) ? (
                <span style={{ fontSize: 11.5, fontWeight: 700, color: "#137a4b" }}>✓ added</span>
              ) : (
                <button onClick={() => setQty(p.id, 1)} style={{ background: "#EEF0FE", color: "#4E5BDC", border: "none", fontWeight: 700, fontSize: 12, padding: "7px 13px", borderRadius: 8, cursor: "pointer", flex: "none" }}>+ Add</button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Right: the cart + the link ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 14, padding: 18 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>2 · The customer&apos;s cart</div>
          {rows.length === 0 ? (
            <div style={{ fontSize: 12.5, color: "#8A93A6" }}>Nothing yet. Search on the left and add products.</div>
          ) : (
            <>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {rows.map(({ p, qty }) => (
                  <div key={p.id} style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</div>
                      <div style={{ fontSize: 11, color: "#8A93A6" }}>{fmt(p.price)} × {qty} = <b style={{ color: "#19202E" }}>{fmt(p.price * qty)}</b></div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", border: "1px solid #E0E4ED", borderRadius: 8, overflow: "hidden", flex: "none" }}>
                      <button onClick={() => setQty(p.id, qty - 1)} style={{ border: "none", background: "#fff", padding: "5px 10px", cursor: "pointer", fontSize: 13 }}>−</button>
                      <span style={{ fontSize: 12.5, fontWeight: 700, minWidth: 26, textAlign: "center" }}>{qty}</span>
                      <button onClick={() => setQty(p.id, qty + 1)} style={{ border: "none", background: "#fff", padding: "5px 10px", cursor: "pointer", fontSize: 13 }}>+</button>
                    </div>
                    <button onClick={() => setQty(p.id, 0)} aria-label={`Remove ${p.name}`} style={{ background: "none", border: "none", color: "#C4C9D4", fontSize: 15, cursor: "pointer" }}>✕</button>
                  </div>
                ))}
              </div>
              <div style={{ borderTop: "1px solid #F0F2F6", marginTop: 12, paddingTop: 10, fontSize: 12.5, color: "#56627A", display: "flex", justifyContent: "space-between" }}>
                <span>Goods {fmt(goodsTotal)} · Delivery {shipping === 0 ? "free" : fmt(shipping)}</span>
                <b style={{ color: "#19202E", fontSize: 13.5 }}>{fmt(goodsTotal + shipping)} incl. GST</b>
              </div>
            </>
          )}
        </div>

        {rows.length > 0 && (
          <div style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 14, padding: 18 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>3 · Send it</div>
            <div style={{ fontFamily: "var(--space-mono)", fontSize: 11.5, color: "#3A4358", background: "#F7F8FB", border: "1px solid #EEF0F4", borderRadius: 9, padding: "9px 11px", wordBreak: "break-all", marginBottom: 10 }}>{link}</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
              <button onClick={() => copy(link, "link")} style={{ background: "#fff", border: "1px solid #E0E4ED", fontWeight: 700, fontSize: 12.5, padding: "9px 14px", borderRadius: 9, cursor: "pointer" }}>
                {copied === "link" ? "✓ Copied" : "Copy link"}
              </button>
              <button onClick={() => copy(message, "msg")} style={{ background: "#fff", border: "1px solid #E0E4ED", fontWeight: 700, fontSize: 12.5, padding: "9px 14px", borderRadius: 9, cursor: "pointer" }}>
                {copied === "msg" ? "✓ Copied" : "Copy WhatsApp message"}
              </button>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Customer phone (optional)" inputMode="tel" style={{ ...inp, flex: "1 1 180px" }} />
              <a
                href={waHref}
                target="_blank"
                rel="noreferrer"
                style={{ background: "#1FAF56", color: "#fff", fontWeight: 700, fontSize: 13, padding: "10px 18px", borderRadius: 9, whiteSpace: "nowrap" }}
              >
                Open in WhatsApp →
              </a>
            </div>
            <div style={{ fontSize: 11.5, color: "#8A93A6", marginTop: 10, lineHeight: 1.5 }}>
              10-digit numbers get +91 automatically. Without a number, WhatsApp opens its chat picker.
              Opening the link twice never doubles the cart.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
