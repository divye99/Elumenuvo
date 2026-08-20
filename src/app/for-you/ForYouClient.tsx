"use client";

import Link from "next/link";
import { GROTESK } from "@/lib/fonts";
import type { Product } from "@/lib/data";
import type { ForYouData } from "@/lib/for-you";
import ProductCard from "@/components/storefront/ProductCard";
import { brandLogo } from "@/lib/brand-logos";
import { slugify } from "@/lib/slug";

/** One horizontal product rail with a See-all link. `half` rails sit two-up
 *  on desktop (Previously ordered | Previously viewed) and stack on mobile. */
function Rail({ title, blurb, items, seeAll, max = 10 }: { title: string; blurb: string; items: Product[]; seeAll: string; max?: number }) {
  if (items.length === 0) return null;
  return (
    <section style={{ minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 10 }}>
        <h2 style={{ fontFamily: GROTESK, fontSize: 18.5, fontWeight: 700, margin: 0 }}>{title}</h2>
        <span className="fy-blurb" style={{ fontSize: 12.5, color: "#8A93A6" }}>{blurb}</span>
        <Link href={seeAll} style={{ marginLeft: "auto", fontSize: 12.5, fontWeight: 700, color: "#1D2F8A", whiteSpace: "nowrap" }}>
          See all ({items.length}) →
        </Link>
      </div>
      <div style={{ display: "flex", gap: 14, overflowX: "auto", paddingBottom: 10, scrollSnapType: "x proximity" }}>
        {items.slice(0, max).map((p) => (
          <div key={p.id} style={{ flex: "0 0 216px", scrollSnapAlign: "start" }}>
            <ProductCard p={p} fixedWidth={216} />
          </div>
        ))}
      </div>
    </section>
  );
}

export default function ForYouClient({ data, firstName }: { data: ForYouData; firstName: string | null }) {
  const { ordered, viewed, brands, recommended } = data;
  const fresh = ordered.length === 0 && viewed.length === 0;

  return (
    <main style={{ maxWidth: 1360, margin: "0 auto", padding: "26px 24px 64px" }}>
      <header style={{ marginBottom: 18 }}>
        <h1 style={{ fontFamily: GROTESK, fontSize: 27, fontWeight: 700, margin: "0 0 6px" }}>
          {firstName ? `For you, ${firstName}` : "For you"}
        </h1>
        <p style={{ fontSize: 14, color: "#56627A", margin: 0, maxWidth: 720 }}>
          Your own corner of the store, built from what you buy, browse and search. It gets sharper every time you shop.
        </p>
      </header>

      {fresh ? (
        <div style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 14, padding: "44px 24px", textAlign: "center" }}>
          <div style={{ fontSize: 30, marginBottom: 8 }}>✨</div>
          <div style={{ fontFamily: GROTESK, fontSize: 17, fontWeight: 600 }}>Nothing personal here yet</div>
          <p style={{ fontSize: 13.5, color: "#56627A", margin: "6px 0 16px" }}>Browse a few products or place an order, and this page starts building itself around you.</p>
          <Link href="/catalogue" style={{ background: "#1D2F8A", color: "#fff", fontWeight: 700, fontSize: 14, padding: "11px 22px", borderRadius: 11 }}>Browse the catalogue →</Link>
        </div>
      ) : (
        <>
          {/* ── Brands you love ── */}
          {brands.length > 0 && (
            <section style={{ marginBottom: 24 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 10 }}>
                <h2 style={{ fontFamily: GROTESK, fontSize: 18.5, fontWeight: 700, margin: 0 }}>Brands you love</h2>
                <span className="fy-blurb" style={{ fontSize: 12.5, color: "#8A93A6" }}>from your orders and browsing</span>
                <Link href="/for-you/brands" style={{ marginLeft: "auto", fontSize: 12.5, fontWeight: 700, color: "#1D2F8A" }}>See all ({brands.length}) →</Link>
              </div>
              <div style={{ display: "flex", gap: 18, overflowX: "auto", paddingBottom: 8 }}>
                {brands.slice(0, 12).map((b) => (
                  <Link key={b} href={`/brand/${slugify(b)}`} style={{ flex: "0 0 auto", display: "flex", flexDirection: "column", alignItems: "center", gap: 7, width: 74 }}>
                    <span style={{ width: 58, height: 58, borderRadius: "50%", background: "#fff", border: "1px solid #E4E7EF", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", boxShadow: "0 1px 4px rgba(22,29,43,0.06)" }}>
                      {brandLogo(b) ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={brandLogo(b)!} alt={b} width={34} height={34} style={{ objectFit: "contain" }} />
                      ) : (
                        <span style={{ fontFamily: GROTESK, fontSize: 19, fontWeight: 700, color: "#1D2F8A" }}>{b.slice(0, 1)}</span>
                      )}
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: "#3A4358", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 74 }}>{b}</span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* ── Previously ordered | Previously viewed (side by side on desktop) ── */}
          <div className="fy-split" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 26, marginBottom: 26, alignItems: "start" }}>
            <Rail title="Previously ordered" blurb="buy it again in a tap" items={ordered} seeAll="/for-you/ordered" max={8} />
            <Rail title="Previously viewed" blurb="pick up where you left off" items={viewed} seeAll="/for-you/viewed" max={8} />
          </div>

          {/* ── Recommended, full width ── */}
          <Rail
            title="Recommended for you"
            blurb="best of your categories, tuned by your searches"
            items={recommended}
            seeAll="/for-you/recommended"
            max={12}
          />
        </>
      )}

      <style>{`
        @media (max-width: 980px) {
          .fy-split { grid-template-columns: 1fr !important; }
          .fy-blurb { display: none; }
        }
      `}</style>
    </main>
  );
}
