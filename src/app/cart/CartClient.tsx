"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import ImageSlot from "@/components/ImageSlot";
import { GROTESK } from "@/lib/fonts";
import { fmt } from "@/lib/format";
import { baseExGst } from "@/lib/pricing";
import { tileFor } from "@/lib/data";
import { useCart } from "@/lib/cart";

export default function CartClient() {
  const router = useRouter();
  const { items, total, baseTotal, gstTotal, setQty, remove } = useCart();

  if (items.length === 0) {
    return (
      <main style={{ maxWidth: 900, margin: "0 auto", padding: "48px 28px" }}>
        <div style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 16, padding: "56px 24px", textAlign: "center" }}>
          <div style={{ fontSize: 34, marginBottom: 10 }}>🛒</div>
          <div style={{ fontFamily: GROTESK, fontSize: 20, fontWeight: 600 }}>Your cart is empty</div>
          <p style={{ fontSize: 14, color: "#8A93A6", margin: "8px 0 18px" }}>Add electrical goods and they&apos;ll show up here.</p>
          <Link href="/catalogue" style={{ background: "#4E5BDC", color: "#fff", fontWeight: 700, fontSize: 14, padding: "11px 22px", borderRadius: 11 }}>Browse the catalogue</Link>
        </div>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 1080, margin: "0 auto", padding: "28px 28px 56px" }}>
      <h1 style={{ fontFamily: GROTESK, fontSize: 28, fontWeight: 600, letterSpacing: "-0.6px", margin: "0 0 18px" }}>Your cart</h1>
      <div className="cart-grid" style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 22, alignItems: "start" }}>
        {/* Items */}
        <div style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 16, overflow: "hidden" }}>
          {items.map((it, i) => (
            <div key={it.id} style={{ display: "flex", gap: 14, alignItems: "center", padding: "14px 16px", borderTop: i ? "1px solid #F0F2F6" : undefined }}>
              <div style={{ width: 64, height: 64, position: "relative", borderRadius: 10, overflow: "hidden", flexShrink: 0, border: "1px solid #EEF0F4" }}>
                <ImageSlot id={`cart-${it.id}`} tile={tileFor("")} imageUrl={it.image} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <Link href={`/catalogue/${it.id}`} style={{ fontSize: 14, fontWeight: 600, color: "#19202E" }}>{it.name}</Link>
                <div style={{ fontSize: 12, color: "#8A93A6" }}>{it.brand} · {fmt(baseExGst(it.price, it.cat))}+GST/{it.unit}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", border: "1px solid #E8EBF1", borderRadius: 10, overflow: "hidden" }}>
                <button onClick={() => setQty(it.id, it.qty - 1)} style={qtyBtn}>−</button>
                <span style={{ width: 40, textAlign: "center", fontFamily: GROTESK, fontSize: 14, fontWeight: 600 }}>{it.qty}</span>
                <button onClick={() => setQty(it.id, it.qty + 1)} style={qtyBtn}>+</button>
              </div>
              <div style={{ width: 90, textAlign: "right", fontFamily: GROTESK, fontWeight: 700, fontSize: 14 }}>{fmt(baseExGst(it.price, it.cat) * it.qty)}</div>
              <button onClick={() => remove(it.id)} style={{ background: "none", border: "none", color: "#C7CEDC", fontSize: 18, cursor: "pointer" }}>×</button>
            </div>
          ))}
        </div>

        {/* Summary */}
        <div style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 16, padding: "18px 20px", position: "sticky", top: 84 }}>
          <div style={{ fontFamily: GROTESK, fontWeight: 600, fontSize: 15, marginBottom: 12 }}>Summary</div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, marginBottom: 8 }}>
            <span style={{ color: "#56627A" }}>Subtotal <span style={{ fontSize: 11, color: "#8A93A6" }}>(excl. GST)</span></span>
            <span style={{ fontFamily: GROTESK, fontWeight: 600 }}>{fmt(baseTotal)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, marginBottom: 8 }}>
            <span style={{ color: "#56627A" }}>GST</span>
            <span style={{ fontFamily: GROTESK, fontWeight: 600 }}>{fmt(gstTotal)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, marginBottom: 12 }}>
            <span style={{ color: "#56627A" }}>Delivery</span>
            <span style={{ color: "#1F9D63", fontWeight: 600 }}>Free · pan-India</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderTop: "1px solid #F0F2F6", paddingTop: 12, marginBottom: 14 }}>
            <span style={{ fontWeight: 600, fontSize: 14 }}>Total <span style={{ fontSize: 11, color: "#8A93A6", fontWeight: 500 }}>(incl. GST)</span></span>
            <span style={{ fontFamily: GROTESK, fontSize: 22, fontWeight: 700 }}>{fmt(total)}</span>
          </div>
          <button onClick={() => router.push("/checkout")} style={{ width: "100%", background: "#4E5BDC", color: "#fff", fontWeight: 700, fontSize: 14.5, border: "none", padding: 13, borderRadius: 11, cursor: "pointer" }}>
            Checkout
          </button>
          <Link href="/catalogue" style={{ display: "block", textAlign: "center", fontSize: 12.5, color: "#4E5BDC", fontWeight: 600, marginTop: 12 }}>Continue shopping</Link>
        </div>
      </div>
    </main>
  );
}

const qtyBtn: React.CSSProperties = { width: 34, height: 38, border: "none", background: "#fff", color: "#56627A", fontSize: 18, cursor: "pointer" };
