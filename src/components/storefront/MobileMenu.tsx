"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";

/** Hamburger + slide-in drawer holding the nav links that don't fit on mobile.
 *  The drawer is portalled to <body> — the header's backdrop-filter would
 *  otherwise trap our position:fixed drawer inside the header's box. */
export default function MobileMenu() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const link = (href: string, label: string, icon: string) => (
    <Link href={href} onClick={() => setOpen(false)}>
      <span style={{ fontSize: 17 }}>{icon}</span> {label}
    </Link>
  );

  const drawer = (
    <>
      <div className="hdr-overlay" onClick={() => setOpen(false)} />
      <nav className="hdr-drawer" aria-label="Menu">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <span style={{ fontFamily: "var(--space-grotesk)", fontWeight: 700, fontSize: 16 }}>Menu</span>
          <button onClick={() => setOpen(false)} aria-label="Close" style={{ background: "none", border: "none", fontSize: 24, color: "#8A93A6", cursor: "pointer", lineHeight: 1 }}>×</button>
        </div>
        {link("/catalogue", "Catalogue", "🛍️")}
        {link("/blog", "Buying guides", "📖")}
        {link("/business", "For business", "🏢")}
        {link("/credit", "30-day credit", "💳")}
        <div style={{ borderTop: "1px solid #F0F2F6", margin: "8px 0" }} />
        {link("/orders", "My orders", "📦")}
        {link("/track", "Track an order", "🚚")}
        {link("/app", "Workspace / dashboard", "📊")}
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
