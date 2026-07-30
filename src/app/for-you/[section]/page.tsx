import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import StoreChrome from "@/components/storefront/StoreChrome";
import ProductCard from "@/components/storefront/ProductCard";
import { getProfile } from "@/lib/profile";
import { buildForYou } from "@/lib/for-you";
import { brandLogo } from "@/lib/brand-logos";
import { slugify } from "@/lib/slug";
import { GROTESK } from "@/lib/fonts";

/** "See all" pages for the For-you rails: the full list, not just the
 *  featured 10. /for-you/ordered · /viewed · /recommended · /brands. */
export const dynamic = "force-dynamic";

const SECTIONS = {
  ordered: { title: "Previously ordered", blurb: "Everything you have bought from us, most recent first." },
  viewed: { title: "Previously viewed", blurb: "Every product you have looked at, most recent first." },
  recommended: { title: "Recommended for you", blurb: "Ranked for you from your categories, brands and searches." },
  brands: { title: "Brands you love", blurb: "The brands you buy and browse, most loved first." },
} as const;
type Section = keyof typeof SECTIONS;

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function ForYouSection({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (!(section in SECTIONS)) notFound();
  const s = section as Section;

  const profile = await getProfile();
  if (!profile?.email) redirect(`/signin?next=/for-you/${s}`);
  const data = await buildForYou(profile.email);

  const meta = SECTIONS[s];

  return (
    <StoreChrome>
      <main style={{ maxWidth: 1360, margin: "0 auto", padding: "26px 24px 64px" }}>
        <div style={{ marginBottom: 18 }}>
          <Link href="/for-you" style={{ fontSize: 13, color: "#8A93A6" }}>← For you</Link>
          <h1 style={{ fontFamily: GROTESK, fontSize: 27, fontWeight: 700, margin: "8px 0 6px" }}>{meta.title}</h1>
          <p style={{ fontSize: 14, color: "#56627A", margin: 0 }}>{meta.blurb}</p>
        </div>

        {s === "brands" ? (
          data.brands.length === 0 ? (
            <Empty />
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 16 }}>
              {data.brands.map((b) => (
                <Link key={b} href={`/brand/${slugify(b)}`} style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 14, padding: "22px 14px", display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                  <span style={{ width: 68, height: 68, borderRadius: "50%", background: "#fff", border: "1px solid #E4E7EF", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                    {brandLogo(b) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={brandLogo(b)!} alt={b} width={40} height={40} style={{ objectFit: "contain" }} />
                    ) : (
                      <span style={{ fontFamily: GROTESK, fontSize: 22, fontWeight: 700, color: "#4E5BDC" }}>{b.slice(0, 1)}</span>
                    )}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#19202E" }}>{b}</span>
                </Link>
              ))}
            </div>
          )
        ) : (
          (() => {
            const items = data[s];
            if (items.length === 0) return <Empty />;
            return (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(218px, 1fr))", gap: 14 }}>
                {items.map((p) => <ProductCard key={p.id} p={p} />)}
              </div>
            );
          })()
        )}
      </main>
    </StoreChrome>
  );
}

function Empty() {
  return (
    <div style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 14, padding: "44px 24px", textAlign: "center", color: "#8A93A6", fontSize: 14 }}>
      Nothing here yet - it fills up as you shop.{" "}
      <Link href="/catalogue" style={{ color: "#4E5BDC", fontWeight: 700 }}>Browse the catalogue →</Link>
    </div>
  );
}
