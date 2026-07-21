"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { MENU_CATS, HOME_BRANDS } from "@/lib/data";

/** Hamburger + LEFT slide-in drawer — a shopping-first menu (Amazon-style):
 *  top deals / trending, wholesale hook, categories and brands. Account links
 *  live in the Sign-in dropdown; company links live in the footer.
 *  Portalled to <body> — the header's backdrop-filter would otherwise trap
 *  our position:fixed drawer inside the header's box. */
export default function MobileMenu() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const close = () => setOpen(false);

  const row = (href: string, label: string, icon: string) => (
    <Link href={href} onClick={close} className="drw-link">
      <span className="ico">{icon}</span> {label}
    </Link>
  );

  const drawer = (
    <>
      <div className="hdr-overlay" onClick={close} />
      <nav className="hdr-drawer" aria-label="Menu">
        {/* Drawer header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px 10px", borderBottom: "1px solid #F0F2F6" }}>
          <span style={{ fontFamily: "var(--space-grotesk)", fontWeight: 700, fontSize: 15 }}>Browse Elume</span>
          <button onClick={close} aria-label="Close" style={{ background: "none", border: "none", fontSize: 22, color: "#8A93A6", cursor: "pointer", lineHeight: 1 }}>×</button>
        </div>

        {/* Deals & trending */}
        <div className="drw-section">Top deals</div>
        {row("/catalogue?sort=save-desc", "Today's best prices", "🔥")}
        <div className="drw-section">Trending</div>
        {row("/catalogue?sort=top-sellers", "Best sellers", "⭐")}
        {row("/catalogue?sort=new", "New releases", "🆕")}
        {row("/catalogue?sort=top-rated", "Top rated", "🏆")}

        {/* Wholesale hook */}
        <div style={{ margin: "10px 12px 4px", background: "linear-gradient(120deg,#EEF0FE,#F7F8FB)", border: "1px solid #DFE3FB", borderRadius: 12, padding: "10px 12px" }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: "#232B6E" }}>💰 Buy more, save more</div>
          <div style={{ fontSize: 10.5, color: "#56627A", lineHeight: 1.45, marginTop: 3 }}>
            Order ₹30,000+ of stock and unlock wholesale rates — an extra <b>5% off</b> every unit.
          </div>
          <Link href="/catalogue" onClick={close} style={{ display: "inline-block", fontSize: 10.5, fontWeight: 700, color: "#4E5BDC", marginTop: 5 }}>
            Start stocking up →
          </Link>
        </div>

        {/* Categories */}
        <div className="drw-section">Top categories for you</div>
        <div className="drw-grid">
          {MENU_CATS.map(([c, icon]) => (
            <Link key={c} href={`/catalogue?cat=${encodeURIComponent(c)}`} onClick={close}>
              <span style={{ fontSize: 13 }}>{icon}</span> {c}
            </Link>
          ))}
        </div>

        {/* Brands */}
        <div className="drw-section">Shop by brand</div>
        <div className="drw-grid">
          {HOME_BRANDS.map((b) => (
            <Link key={b} href={`/catalogue?q=${encodeURIComponent(b)}`} onClick={close}>
              {b}
            </Link>
          ))}
        </div>

        <div className="drw-divider" />
        {row("/catalogue", "Browse the full catalogue", "🛍️")}
        <div style={{ height: 18 }} />
      </nav>
    </>
  );

  return (
    <>
      <button className="hdr-hamburger" aria-label="Menu" onClick={() => setOpen(true)}>
        <svg width="18" height="14" viewBox="0 0 18 14" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M1 1h16M1 7h16M1 13h16" stroke="#19202E" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
      {open && mounted && createPortal(drawer, document.body)}
    </>
  );
}
