import Link from "next/link";
import { COMPANY, addressLine } from "@/lib/company";
import { Mark, Wordmark } from "@/components/Brand";
import HeaderSearch from "@/components/storefront/HeaderSearch";
import CatalogueMegaMenu from "@/components/storefront/CatalogueMegaMenu";
import ScrollTopButton from "@/components/storefront/ScrollTopButton";
import CartButton from "@/components/storefront/CartButton";
import AccountButton from "@/components/storefront/AccountButton";
import MobileMenu from "@/components/storefront/MobileMenu";
import HeaderScrollFx from "@/components/storefront/HeaderScrollFx";
import { CartProvider } from "@/lib/cart";

/**
 * Shared public-store chrome (Amazon-style): sticky header with search + cart +
 * footer, wrapped in the storefront CartProvider. Used by the home page and the
 * catalogue/product pages so the whole public shopping surface feels like one store.
 */
export default function StoreChrome({ children }: { children: React.ReactNode }) {
  // Deliberately does NOT read the session. Touching cookies here would make
  // every page under this chrome dynamic, and the catalogue is 3,400+ URLs
  // that Googlebot has to be able to crawl from cache. AccountButton fetches
  // the signed-in user itself once the page is interactive.
  return (
    <CartProvider>
    {/* overflowX must be `clip`, not `hidden`: `hidden` creates a scroll
        container that silently breaks `position: sticky` for every descendant
        (the checkout summary would scroll away). `clip` stops the horizontal
        overflow without creating one. */}
    <div style={{ fontFamily: "var(--hanken)", background: "#F7F8FB", minHeight: "100vh", color: "#19202e", overflowX: "clip" }}>
      {/* Announcement strip */}
      <div className="hdr-strip" style={{ background: "#19202E", color: "#C6CDE2", fontSize: 12.5, textAlign: "center", padding: "8px 16px" }}>
        🚚 We deliver <strong style={{ color: "#fff" }}>pan-India</strong> · GST invoice on every order ·{" "}
        <Link href="/credit" style={{ color: "#9DB0FF", fontWeight: 700 }}>
          30-day NBFC credit coming soon — join the waitlist →
        </Link>
      </div>

      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 40,
          background: "rgba(255,255,255,0.94)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid #EEF0F4",
        }}
      >
        <div className="hdr-inner">
          <MobileMenu />
          <Link href="/" className="hdr-logo" style={{ display: "flex", alignItems: "center", gap: 9, flexShrink: 0 }}>
            <Mark height={28} />
            <Wordmark height={16} />
          </Link>

          <div className="hdr-search">
            <HeaderSearch />
          </div>

          <nav className="hdr-actions">
            <CatalogueMegaMenu />
            <Link href="/blog" className="hdr-navlink" style={{ fontSize: 14, fontWeight: 500, color: "#56627A" }}>
              Blog
            </Link>
            <Link href="/business" className="hdr-navlink" style={{ fontSize: 14, fontWeight: 500, color: "#56627A" }}>
              For business
            </Link>
            <CartButton />
            <AccountButton />
          </nav>
        </div>
        <HeaderScrollFx />
      </header>

      {children}

      <ScrollTopButton />

      {/* Unified rich footer — same on desktop and mobile (responsive grid) */}
      <footer className="store-ft">
        <div className="ft-wrap">
          <div className="ft-top">
            {/* Brand + contact */}
            <div className="ft-brand">
              <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 9 }}>
                <Mark height={26} />
                <Wordmark height={15} />
              </Link>
              <p className="ft-tag">India&apos;s multi-brand FMEG store — wires, switchgear, fans, lighting &amp; modular at one transparent price list.</p>
              <div className="ft-contact">
                <a href="mailto:info@elumenuvo.com">✉ info@elumenuvo.com</a>
                <a href="tel:+919818821175">✆ +91 98188 21175</a>
                <span className="ft-loc">📍 {COMPANY.legalName}{addressLine() ? ` · ${addressLine()}` : ` · ${COMPANY.country}`}</span>
                {(COMPANY.cin || COMPANY.gstin) && (
                  <span className="ft-loc">
                    {COMPANY.cin ? `CIN ${COMPANY.cin}` : ""}{COMPANY.cin && COMPANY.gstin ? " · " : ""}{COMPANY.gstin ? `GSTIN ${COMPANY.gstin}` : ""}
                  </span>
                )}
              </div>
            </div>

            <div className="ft-col">
              <div className="ft-h">Shop</div>
              <Link href="/catalogue">Catalogue</Link>
              <Link href="/catalogue?sort=save-desc">Top deals</Link>
              <Link href="/catalogue?sort=top-sellers">Best sellers</Link>
              <Link href="/blog">Buying guides</Link>
            </div>
            <div className="ft-col">
              <div className="ft-h">Your account</div>
              <Link href="/signin">Sign in</Link>
              <Link href="/app">Workspace / dashboard</Link>
              <Link href="/orders">My orders</Link>
              <Link href="/track">Track an order</Link>
            </div>
            <div className="ft-col">
              <div className="ft-h">For business</div>
              <Link href="/business">Elume for business</Link>
              <Link href="/credit">30-day credit</Link>
              <Link href="/sell">Sell on Elume</Link>
              <Link href="/space">Space procurement</Link>
            </div>
            <div className="ft-col">
              <div className="ft-h">Help</div>
              <Link href="/contact">Contact us</Link>
              <Link href="/request-product">Can&apos;t find a product?</Link>
              <Link href="/faq">FAQ</Link>
              <Link href="/shipping">Shipping &amp; delivery</Link>
              <Link href="/returns">Returns &amp; refunds</Link>
            </div>
            <div className="ft-col">
              <div className="ft-h">Company</div>
              <Link href="/about">About us</Link>
              <Link href="/privacy">Privacy policy</Link>
              <Link href="/terms">Terms &amp; conditions</Link>
            </div>
          </div>

          <div className="ft-bottom">
            <span>© {new Date().getFullYear()} Elume Nuvotech Private Limited. All rights reserved.</span>
            <span>Pan-India delivery · GST invoice on every order · Prices shown exclude GST; GST is added at checkout.</span>
          </div>
        </div>
      </footer>
    </div>
    </CartProvider>
  );
}
