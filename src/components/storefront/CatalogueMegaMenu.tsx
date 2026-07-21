"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { MENU_CATS, HOME_BRANDS } from "@/lib/data";

/**
 * Desktop nav "Catalogue" item with a hover mega-menu: quick links,
 * categories and brands — the same content the mobile drawer shows, so the
 * two surfaces never drift apart. Click still goes straight to /catalogue.
 */
export default function CatalogueMegaMenu() {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const enter = () => { if (closeTimer.current) clearTimeout(closeTimer.current); setOpen(true); };
  const leave = () => { closeTimer.current = setTimeout(() => setOpen(false), 140); };

  const head: React.CSSProperties = { fontSize: 10.5, fontWeight: 800, letterSpacing: "0.7px", textTransform: "uppercase", color: "#A0A7B5", margin: "0 0 8px" };
  const item: React.CSSProperties = { display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: "#2c3550", padding: "6px 8px", borderRadius: 8 };

  return (
    <div className="hdr-navlink" style={{ position: "relative" }} onMouseEnter={enter} onMouseLeave={leave}>
      <Link href="/catalogue" style={{ fontSize: 14, fontWeight: 600, color: "#19202E", display: "inline-flex", alignItems: "center", gap: 5 }}>
        Catalogue <span style={{ fontSize: 9, color: "#8A93A6", transform: open ? "rotate(180deg)" : "none", transition: "transform .15s" }}>▼</span>
      </Link>

      {open && (
        <div
          style={{ position: "absolute", top: "calc(100% + 14px)", left: "50%", transform: "translateX(-58%)", zIndex: 70, width: 640, background: "#fff", border: "1px solid #E0E4ED", borderRadius: 16, boxShadow: "0 24px 60px rgba(20,24,45,.16)", padding: "20px 22px", display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr", gap: 22 }}
          onMouseEnter={enter}
          onMouseLeave={leave}
        >
          {/* invisible hover bridge so the pointer can cross the gap */}
          <div style={{ position: "absolute", top: -14, left: 0, right: 0, height: 14 }} />

          <div>
            <div style={head}>Categories</div>
            {MENU_CATS.map(([c, icon]) => (
              <Link key={c} href={`/catalogue?cat=${encodeURIComponent(c)}`} style={item} onClick={() => setOpen(false)}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#F5F6F9")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <span style={{ width: 18, textAlign: "center" }}>{icon}</span> {c}
              </Link>
            ))}
          </div>

          <div>
            <div style={head}>Brands</div>
            {HOME_BRANDS.slice(0, 9).map((b) => (
              <Link key={b} href={`/catalogue?q=${encodeURIComponent(b)}`} style={item} onClick={() => setOpen(false)}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#F5F6F9")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                {b}
              </Link>
            ))}
          </div>

          <div>
            <div style={head}>Quick picks</div>
            {([
              ["/catalogue?sort=save-desc", "🔥 Today's best prices"],
              ["/catalogue?sort=top-sellers", "⭐ Best sellers"],
              ["/catalogue?sort=new", "🆕 New releases"],
              ["/catalogue?sort=top-rated", "🏆 Top rated"],
            ] as [string, string][]).map(([href, label]) => (
              <Link key={href} href={href} style={item} onClick={() => setOpen(false)}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#F5F6F9")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                {label}
              </Link>
            ))}
            <Link href="/catalogue" onClick={() => setOpen(false)} style={{ display: "block", marginTop: 12, background: "#4E5BDC", color: "#fff", fontWeight: 700, fontSize: 12.5, textAlign: "center", padding: "10px 12px", borderRadius: 10 }}>
              Browse everything →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
