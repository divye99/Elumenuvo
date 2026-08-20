import Link from "next/link";
import { slugify } from "@/lib/slug";
import ProductCard from "@/components/storefront/ProductCard";
import { GROTESK, MONO } from "@/lib/fonts";
import { type Product } from "@/lib/data";
import CategoryIcon from "@/components/storefront/CategoryIcon";
import { groupVariants, familyKey } from "@/lib/variants";
import type { BlogPost } from "@/lib/blog";

const CATS = ["Wires & Cables", "Switchgear", "Modular", "Lighting", "Fans", "Water Heaters", "DB & Panels", "Pumps", "Electrical Accessories", "EV Charging"];

function Shelf({
  title,
  sub,
  products,
  seeAll,
  groups,
}: {
  title: string;
  sub?: string;
  products: Product[];
  seeAll: string;
  groups: Record<string, Product[]>;
}) {
  if (products.length === 0) return null;
  return (
    <section style={{ marginTop: 36 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 14 }}>
        <div>
          <h2 style={{ fontFamily: GROTESK, fontSize: 22, fontWeight: 600, letterSpacing: "-0.4px", margin: 0 }}>{title}</h2>
          {sub && <p style={{ fontSize: 13, color: "#8A93A6", margin: "4px 0 0" }}>{sub}</p>}
        </div>
        <Link href={seeAll} style={{ fontSize: 13, fontWeight: 600, color: "#1D2F8A", flexShrink: 0 }}>
          See all →
        </Link>
      </div>
      <div style={{ display: "flex", gap: 16, overflowX: "auto", paddingBottom: 8, scrollbarWidth: "thin" }}>
        {products.map((p) => (
          <ProductCard key={p.id} p={p} fixedWidth={236} siblings={groups[familyKey(p)]} />
        ))}
      </div>
    </section>
  );
}

/** Amazon-style FMEG storefront home - hero, category tiles, deal + category
 *  shelves, pricing explainer, brands, buying guides. Pure server component;
 *  interactivity lives in the header search and product-card image slots. */
import PersonalRails from "@/components/storefront/PersonalRails";

export default function HomeStorefront({ products, posts }: { products: Product[]; posts: BlogPost[] }) {
  // "Today's best prices" mechanism (user-defined, Jul 2026):
  //   1. Only products priced above ₹2,000 qualify (no trinket deals).
  //   2. Ranked by % discount, the highest wins.
  //   3. Exactly ONE listing per category on the shelf.
  // Tiebreak on id - products can share the exact same discount, and an
  // unstable tie order would differ between server and client renders (hydration).
  const discount = (p: Product) => 1 - p.price / p.market;
  const bestByCat = new Map<string, Product>();
  for (const p of products) {
    if (p.price <= 2000 || p.market <= p.price || p.inStock === false || !p.image) continue; // hero slots need stock AND a photo
    const cur = bestByCat.get(p.cat);
    if (!cur || discount(p) > discount(cur) || (discount(p) === discount(cur) && p.id.localeCompare(cur.id) < 0)) bestByCat.set(p.cat, p);
  }
  const deals = [...bestByCat.values()].sort((a, b) => discount(b) - discount(a) || a.id.localeCompare(b.id));
  const brands = Array.from(new Set(products.map((p) => p.brand))).sort();
  const countFor = (cat: string) => products.filter((p) => p.cat === cat).length;
  const groups = groupVariants(products);

  return (
    <main style={{ maxWidth: 1280, margin: "0 auto", padding: "0 28px 64px" }}>
      {/* ── Hero: flat, product-led, straight commercial language ── */}
      <section
        className="home-hero"
        style={{
          marginTop: 20,
          borderRadius: 10,
          padding: "36px 40px 32px",
          // The signature Factor X gradient (matching the kit's Background.png)
          // with the kit's warm-lit interior fading in from the right: the
          // image earns its place by showing what the wiring is FOR.
          background:
            "linear-gradient(90deg, #16215B 0%, #1D2F8A 40%, rgba(29,47,138,0.85) 55%, rgba(114,50,113,0.38) 74%, rgba(22,33,91,0.08) 100%), url(/assets/elume-brand/home-glow.jpg) right 88% / cover no-repeat, linear-gradient(133deg, #16215B 0%, #1D2F8A 34%, #723271 70%, #F25929 104%)",
          border: "1px solid #2A3A7A",
          color: "#fff",
        }}
      >
        <div style={{ maxWidth: 640 }}>
          {/* The brand in the visible H1 is a documented Google site-name
              input (owner ask + SEO audit, Aug 2026). */}
          <h1 style={{ fontFamily: GROTESK, fontSize: "clamp(26px, 5vw, 32px)", fontWeight: 600, letterSpacing: "-0.7px", lineHeight: 1.16, margin: 0 }}>
            Elume - India&apos;s premier electrical marketplace
          </h1>
          <div className="home-hero-ctawrap" style={{ marginTop: 18 }}>
            <Link
              href="/catalogue"
              className="home-hero-cta"
              style={{ display: "inline-block", background: "#fff", color: "#16215B", fontSize: 14, fontWeight: 700, padding: "10px 20px", borderRadius: 8 }}
            >
              Shop the catalogue
            </Link>
          </div>
        </div>
      </section>

      {/* ── Category index: dense, quiet, icon-led ── */}
      <section style={{ marginTop: 20 }}>
        <div className="home-cats" style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
          {CATS.map((cat) => (
            <Link
              key={cat}
              href={`/category/${slugify(cat)}`}
              className="home-cat-tile"
              style={{
                background: "#fff",
                border: "1px solid #E8EBF1",
                borderRadius: 8,
                padding: "11px 13px",
                display: "flex",
                alignItems: "center",
                gap: 10,
                minWidth: 0,
              }}
            >
              <span style={{ color: "#1D2F8A", display: "inline-flex", flexShrink: 0 }}><CategoryIcon cat={cat} size={19} /></span>
              <span className="home-cat-label" style={{ fontSize: 13, fontWeight: 600, color: "#19202E", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{cat}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* ── Deals shelf ── */}
      <Shelf
        title="Today's best prices"
        sub="The deepest discount in every category right now."
        products={deals}
        seeAll="/catalogue"
        groups={groups}
      />

      {/* ── Category shelves ── */}
      {/* One card per BRAND per shelf (user rule), each represented by the
          brand's first variant family's parent: a 168-variant family or a
          six-colour wire cannot fill a shelf, and neither can one brand. */}
      {CATS.map((cat) => {
        // HARD RULES (owner, Aug 2026): high-visibility surfaces never show an
        // out-of-stock product; products without a photo get the LEAST
        // visibility (a photographed brand always beats an imageless one for a
        // slot); and the Elume house brand queues LAST on the homepage
        // shelves - other brands get the front slots.
        const seenBrands = new Set<string>();
        const shelf: Product[] = [];
        const pass = (allowElume: boolean, requirePhoto: boolean) => {
          for (const p of products) {
            if (p.cat !== cat || shelf.length >= 8) continue;
            if (p.inStock === false) continue;
            if (requirePhoto && !p.image) continue;
            if ((p.brand === "Elume") !== allowElume) continue;
            if (seenBrands.has(p.brand)) continue;
            seenBrands.add(p.brand);
            const fam = familyKey(p);
            const rep = p.parentId ? groups[fam]?.find((s) => !s.parentId) ?? p : p;
            shelf.push(rep.inStock === false ? p : rep);
          }
        };
        pass(false, true);  // other brands, with photos
        pass(true, true);   // Elume with photos, if slots remain
        pass(false, false); // imageless fills only what photos could not
        pass(true, false);
        return (
          <Shelf
            key={cat}
            title={cat}
            products={shelf}
            seeAll={`/category/${slugify(cat)}`}
            groups={groups}
          />
        );
      })}

      {/* ── Brand index: deliberately quiet - a text row, not a feature ── */}
      <section className="home-brands" style={{ marginTop: 40, borderTop: "1px solid #E8EBF1", paddingTop: 18 }}>
        <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: "1.4px", textTransform: "uppercase", color: "#8A93A6", marginBottom: 10 }}>
          Brands we stock
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", columnGap: 22, rowGap: 8 }}>
          {brands.map((b) => (
            <Link
              key={b}
              href={`/brand/${slugify(b)}`}
              style={{ fontSize: 13.5, fontWeight: 600, color: "#3A4358", textDecoration: "none" }}
            >
              {b}
            </Link>
          ))}
        </div>
      </section>

      {/* ── Buying guides: compact editorial list, visually quiet ── */}
      <section style={{ marginTop: 36, borderTop: "1px solid #E8EBF1", paddingTop: 18 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10 }}>
          <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: "1.4px", textTransform: "uppercase", color: "#8A93A6" }}>Buying guides</div>
          <Link href="/blog" style={{ fontSize: 13, fontWeight: 600, color: "#1D2F8A" }}>
            All guides →
          </Link>
        </div>
        <div className="home-guides" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px 28px" }}>
          {posts.slice(0, 3).map((post) => (
            <Link key={post.slug} href={`/blog/${post.slug}`} className="guide-card" style={{ padding: "6px 0" }}>
              <div className="guide-title" style={{ fontSize: 14.5, fontWeight: 600, color: "#19202E", lineHeight: 1.4 }}>{post.title}</div>
              <div className="guide-kicker" style={{ fontSize: 12, color: "#8A93A6", marginTop: 3 }}>
                {post.category} · {post.readMins} min read
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ── Business band: one quiet row ── */}
      <section
        style={{
          marginTop: 36,
          borderTop: "1px solid #E8EBF1",
          paddingTop: 20,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 20,
          flexWrap: "wrap",
        }}
      >
        <p style={{ fontSize: 14, color: "#3A4358", margin: 0, lineHeight: 1.55, maxWidth: 620 }}>
          <strong style={{ color: "#19202E" }}>Buying for a project?</strong>{" "}
          Business accounts get wholesale rates, GST invoicing and order tracking to site.
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link href="/app" style={{ background: "#1D2F8A", color: "#fff", fontSize: 13.5, fontWeight: 700, padding: "10px 18px", borderRadius: 8 }}>
            Open the workspace
          </Link>
          <Link href="/business" style={{ border: "1px solid #D8DCE6", color: "#19202E", fontSize: 13.5, fontWeight: 600, padding: "10px 18px", borderRadius: 8 }}>
            Elume for business
          </Link>
        </div>
      </section>

      {/* Personal shelves: rendered after hydration for this device only, so
          the page itself stays cached and identical for every visitor.
          Invisible until the visitor has browsed enough to earn rails. */}
      <section style={{ maxWidth: 1200, margin: "0 auto", padding: "34px 24px 10px" }}>
        <PersonalRails ctx="home" heading />
      </section>
    </main>
  );
}
