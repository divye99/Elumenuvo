"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { MENU_CATS, HOME_BRANDS } from "@/lib/data";
import { METALS_TAXONOMY, METAL_ICONS, metalHref } from "@/lib/metals";
import ForYouLink from "@/components/storefront/ForYouLink";
import CategoryIcon from "@/components/storefront/CategoryIcon";
import { slugify } from "@/lib/slug";

/** Hamburger + LEFT slide-in drawer - a shopping-first menu (Amazon-style):
 *  top deals / trending, wholesale hook, categories and brands. Account links
 *  live in the Sign-in dropdown; company links live in the footer.
 *  Portalled to <body> - the header's backdrop-filter would otherwise trap
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

        {/* Signed-in customers get their personalized page first */}
        <ForYouLink variant="drawer" onNavigate={close} />

        {/* Deals & trending */}
        <div className="drw-section">Top deals</div>
        {row("/collections/best-prices", "Today's best prices", "🔥")}
        <div className="drw-section">Trending</div>
        {row("/collections/best-sellers", "Best sellers", "⭐")}
        {row("/collections/new-releases", "New releases", "🆕")}
        {row("/collections/top-rated", "Top rated", "🏆")}

        {/* Wholesale hook */}
        <div style={{ margin: "10px 12px 4px", background: "linear-gradient(120deg,#E9EDF9,#F7F8FB)", border: "1px solid #DFE3FB", borderRadius: 12, padding: "10px 12px" }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: "#232B6E" }}>💰 Buy more, save more</div>
          <div style={{ fontSize: 10.5, color: "#56627A", lineHeight: 1.45, marginTop: 3 }}>
            Order <b>15+ units</b> of any product and the price drops <b>5%</b> automatically.
          </div>
          <Link href="/wholesale" onClick={close} style={{ display: "inline-block", fontSize: 10.5, fontWeight: 700, color: "#1D2F8A", marginTop: 5 }}>
            See how it works →
          </Link>
        </div>

        {/* Categories */}
        <div className="drw-section">Top categories for you</div>
        <div className="drw-grid">
          {MENU_CATS.map(([c]) => (
            <Link key={c} href={`/category/${slugify(c)}`} onClick={close}>
              <span style={{ display: "inline-flex", verticalAlign: "-3px", color: "#6B748C" }}><CategoryIcon cat={c} size={15} /></span> {c}
            </Link>
          ))}
        </div>

        {/* Metals - copper buyable at daily rates, the rest enquiry-first */}
        <div className="drw-section">Metals · daily rates</div>
        <div className="drw-grid">
          {METALS_TAXONOMY.map((m) => (
            <Link key={m.name} href={metalHref(m)} onClick={close}>
              <span style={{ fontSize: 13 }}>{METAL_ICONS[m.name] ?? "▫️"}</span> {m.name}
            </Link>
          ))}
        </div>

        {/* Brands */}
        <div className="drw-section">Shop by brand</div>
        <div className="drw-grid">
          {HOME_BRANDS.map((b) => (
            <Link key={b} href={`/brand/${slugify(b)}`} onClick={close}>
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
