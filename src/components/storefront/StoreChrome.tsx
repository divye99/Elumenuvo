import Link from "next/link";
import { COMPANY, SOCIALS, addressLine } from "@/lib/company";
import { Mark, Wordmark } from "@/components/Brand";
import HeaderSearch from "@/components/storefront/HeaderSearch";
import CatalogueMegaMenu from "@/components/storefront/CatalogueMegaMenu";
import ScrollTopButton from "@/components/storefront/ScrollTopButton";
import CartButton from "@/components/storefront/CartButton";
import AccountButton from "@/components/storefront/AccountButton";
import ForYouLink from "@/components/storefront/ForYouLink";
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
        🚚 <strong style={{ color: "#fff" }}>Free delivery</strong> pan-India · GST invoice on every order ·{" "}
        <Link href="/credit" style={{ color: "#9DB0FF", fontWeight: 700 }}>
          30-day NBFC credit coming soon - join the waitlist →
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
            <ForYouLink variant="nav" />
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

      {/* Unified rich footer - same on desktop and mobile (responsive grid) */}
      <footer className="store-ft">
        <div className="ft-wrap">
          <div className="ft-top">
            {/* Brand + contact */}
            <div className="ft-brand">
              <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 9 }}>
                <Mark height={26} />
                <Wordmark height={15} />
              </Link>
              <p className="ft-tag">India&apos;s multi-brand FMEG store - wires, switchgear, fans, lighting &amp; modular at one transparent price list.</p>
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
              {/* Social profiles - sturdy stroked icons, same family as the cart */}
              <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
                {SOCIALS.map((s) => (
                  <a
                    key={s.name}
                    href={s.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Elume on ${s.name}`}
                    title={s.name}
                    style={{ width: 34, height: 34, borderRadius: 9, border: "1px solid #2c3550", display: "flex", alignItems: "center", justifyContent: "center", color: "#9aa3b8" }}
                  >
                    {s.name === "Facebook" && (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h-2.5A4.5 4.5 0 0 0 8 7.5V10H5.5v3.5H8V21h3.8v-7.5h2.7l.6-3.5h-3.3V8c0-1 .5-1.5 1.5-1.5H15V3Z" /></svg>
                    )}
                    {s.name === "Instagram" && (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3.5" y="3.5" width="17" height="17" rx="4.5" /><circle cx="12" cy="12" r="3.8" /><circle cx="17.2" cy="6.8" r="0.6" fill="currentColor" stroke="none" /></svg>
                    )}
                    {s.name === "YouTube" && (
                      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2.5" y="6" width="19" height="12.5" rx="3.5" /><path d="M10.2 9.7v5.1l4.6-2.55-4.6-2.55Z" /></svg>
                    )}
                  </a>
                ))}
              </div>
            </div>

            <div className="ft-col">
              <div className="ft-h">Shop</div>
              <Link href="/catalogue">Catalogue</Link>
              <Link href="/collections/best-prices">Top deals</Link>
              <Link href="/collections/best-sellers">Best sellers</Link>
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
