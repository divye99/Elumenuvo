import Link from "next/link";
import ProductCard from "@/components/storefront/ProductCard";
import { GROTESK, MONO } from "@/lib/fonts";
import { tileFor, type Product } from "@/lib/data";
import { groupVariants, familyKey } from "@/lib/variants";
import type { BlogPost } from "@/lib/blog";

const CATS = ["Wires & Cables", "Switchgear", "Modular", "Lighting", "Fans", "DB & Panels"];

const CAT_ICONS: Record<string, string> = {
  "Wires & Cables": "〰️",
  Switchgear: "⚡",
  Modular: "▣",
  Lighting: "💡",
  Fans: "🌀",
  "DB & Panels": "🗄️",
};

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
        <Link href={seeAll} style={{ fontSize: 13, fontWeight: 600, color: "#4E5BDC", flexShrink: 0 }}>
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

/** Amazon-style FMEG storefront home — hero, category tiles, deal + category
 *  shelves, pricing explainer, brands, buying guides. Pure server component;
 *  interactivity lives in the header search and product-card image slots. */
export default function HomeStorefront({ products, posts }: { products: Product[]; posts: BlogPost[] }) {
  // Tiebreak on id — hundreds of products share the exact same discount, and an
  // unstable tie order would differ between server and client renders (hydration).
  const byDiscount = [...products].sort((a, b) => (1 - b.price / b.market) - (1 - a.price / a.market) || a.id.localeCompare(b.id));
  const deals = byDiscount.slice(0, 8);
  const brands = Array.from(new Set(products.map((p) => p.brand))).sort();
  const countFor = (cat: string) => products.filter((p) => p.cat === cat).length;
  const groups = groupVariants(products);

  return (
    <main style={{ maxWidth: 1280, margin: "0 auto", padding: "0 28px 64px" }}>
      {/* ── Hero band ── */}
      <section
        style={{
          marginTop: 24,
          borderRadius: 20,
          padding: "42px 44px",
          background: "linear-gradient(120deg,#19202E 0%,#232E4A 55%,#4E5BDC 130%)",
          color: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 32,
          flexWrap: "wrap",
        }}
      >
        <div style={{ maxWidth: 620 }}>
          <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "1.6px", textTransform: "uppercase", color: "#9DB0FF", marginBottom: 12 }}>
            India&apos;s FMEG store · {products.length} products · {brands.length} brands
          </div>
          <h1 style={{ fontFamily: GROTESK, fontSize: "clamp(28px, 7vw, 38px)", fontWeight: 600, letterSpacing: "-1px", lineHeight: 1.12, margin: 0 }}>
            Every electrical brand.
            <br />
            One transparent price list.
          </h1>
          <div style={{ marginTop: 22 }}>
            <Link
              href="/catalogue"
              style={{ display: "inline-block", background: "#fff", color: "#19202E", fontSize: 14, fontWeight: 700, padding: "12px 22px", borderRadius: 11 }}
            >
              Shop the catalogue
            </Link>
          </div>
        </div>
      </section>

      {/* ── Category tiles ── */}
      <section style={{ marginTop: 28 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 14 }}>
          {CATS.map((cat) => (
            <Link
              key={cat}
              href={`/catalogue?cat=${encodeURIComponent(cat)}`}
              style={{
                background: "#fff",
                border: "1px solid #E8EBF1",
                borderRadius: 14,
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div style={{ height: 84, background: tileFor(cat), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30 }}>
                {CAT_ICONS[cat]}
              </div>
              <div style={{ padding: "12px 14px" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#19202E" }}>{cat}</div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ── Deals shelf ── */}
      <Shelf
        title="Today's best prices"
        sub="Deepest savings off MRP across the catalogue right now."
        products={deals}
        seeAll="/catalogue"
        groups={groups}
      />

      {/* ── Category shelves ── */}
      {CATS.map((cat) => (
        <Shelf
          key={cat}
          title={cat}
          products={products.filter((p) => p.cat === cat).slice(0, 8)}
          seeAll={`/catalogue?cat=${encodeURIComponent(cat)}`}
          groups={groups}
        />
      ))}

      {/* ── Brand strip ── */}
      <section style={{ marginTop: 44, background: "#fff", border: "1px solid #E8EBF1", borderRadius: 16, padding: "22px 26px" }}>
        <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: "1.4px", textTransform: "uppercase", color: "#8A93A6", marginBottom: 14 }}>
          Brands we stock
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          {brands.map((b) => (
            <Link
              key={b}
              href={`/catalogue?q=${encodeURIComponent(b)}`}
              style={{ fontFamily: GROTESK, fontSize: 14, fontWeight: 600, color: "#3A4358", background: "#F3F5F9", border: "1px solid #E8EBF1", padding: "9px 18px", borderRadius: 10 }}
            >
              {b}
            </Link>
          ))}
        </div>
      </section>

      {/* ── Buying guides ── */}
      <section style={{ marginTop: 44 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 14 }}>
          <h2 style={{ fontFamily: GROTESK, fontSize: 22, fontWeight: 600, letterSpacing: "-0.4px", margin: 0 }}>Buying guides</h2>
          <Link href="/blog" style={{ fontSize: 13, fontWeight: 600, color: "#4E5BDC" }}>
            All guides →
          </Link>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          {posts.slice(0, 3).map((post) => (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 14, padding: "20px 22px" }}
            >
              <div style={{ fontFamily: MONO, fontSize: 10.5, color: "#4E5BDC", letterSpacing: "1px", textTransform: "uppercase", marginBottom: 8 }}>
                {post.category} · {post.readMins} min read
              </div>
              <div style={{ fontFamily: GROTESK, fontSize: 16.5, fontWeight: 600, color: "#19202E", lineHeight: 1.3 }}>{post.title}</div>
              <p style={{ fontSize: 13, color: "#56627A", margin: "8px 0 0", lineHeight: 1.5 }}>{post.description}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* ── Business + workspace band ── */}
      <section
        style={{
          marginTop: 44,
          borderRadius: 18,
          border: "1px solid #E8EBF1",
          background: "#fff",
          padding: "30px 34px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 24,
          flexWrap: "wrap",
        }}
      >
        <div style={{ maxWidth: 560 }}>
          <h2 style={{ fontFamily: GROTESK, fontSize: 21, fontWeight: 600, letterSpacing: "-0.4px", margin: 0 }}>
            Buying for a project or a business?
          </h2>
          <p style={{ fontSize: 14, color: "#56627A", margin: "8px 0 0", lineHeight: 1.55 }}>
            The Elume workspace turns your BOQ into a priced BOM, compares every brand, and tracks
            orders to site — open to everyone, no sign-up needed.
          </p>
        </div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Link href="/app" style={{ background: "#4E5BDC", color: "#fff", fontSize: 14, fontWeight: 700, padding: "12px 22px", borderRadius: 11 }}>
            Open the workspace
          </Link>
          <Link href="/business" style={{ border: "1px solid #E8EBF1", color: "#19202E", fontSize: 14, fontWeight: 600, padding: "12px 22px", borderRadius: 11 }}>
            How Elume works for business
          </Link>
        </div>
      </section>
    </main>
  );
}
