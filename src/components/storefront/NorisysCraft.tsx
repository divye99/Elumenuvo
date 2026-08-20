import Link from "next/link";
import { fmt } from "@/lib/format";
import type { Product } from "@/lib/data";
import type { NorisysPairing } from "@/lib/norisys";
import { NORISYS_ENGINEERING, NORISYS_BADGES } from "@/lib/norisys";

/**
 * Norisys-only PDP sections (owner, Aug 2026): the premium treatment built
 * from the brand's own catalogue language. Three parts:
 *   1. "Complete the plate" - the modular-system cross-sell (modules pair
 *      with plates, plates pair with mechanisms). Conversion driver #1:
 *      bigger baskets and no wrong purchases.
 *   2. The engineering trust block - three bullets per series with the
 *      exploded-view render. Stored once per series in lib/norisys.
 *   3. Compliance marks (CE / RoHS / IS) as quiet badges.
 * Rendered only when p.brand === "Norisys", like ElumeFlagship for Elume.
 */

/** Series exploded-view renders, hosted once in product-images storage. */
const STORE = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/product-images/norisys/series`;
const EXPLODED: Record<string, string> = {
  CUBE: `${STORE}/cube-exploded.png`,
  TG9: `${STORE}/tg9-exploded.png`,
};

export default function NorisysCraft({ series, pairing }: {
  series: "CUBE" | "TG9";
  pairing: NorisysPairing | null;
}) {
  const eng = NORISYS_ENGINEERING[series];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* ── Complete the plate ── */}
      {pairing && pairing.items.length > 0 && (
        <section style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 16, padding: "18px 20px" }}>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "1.1px", textTransform: "uppercase", color: "#8A93A6", marginBottom: 4 }}>
            Norisys modular system
          </div>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 12px" }}>{pairing.heading}</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12 }}>
            {pairing.items.map((s: Product) => (
              <Link key={s.id} href={`/catalogue/${s.id}`} style={{ border: "1px solid #EEF0F4", borderRadius: 12, padding: 10, background: "#FBFCFE", display: "block" }}>
                <div style={{ height: 86, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 8 }}>
                  {s.image
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={s.image} alt="" loading="lazy" style={{ maxHeight: 84, maxWidth: "100%", objectFit: "contain" }} />
                    : <span style={{ fontSize: 11, color: "#C6CBD6" }}>Norisys</span>}
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#19202E", lineHeight: 1.35, height: 48, overflow: "hidden" }}>{s.name}</div>
                <div style={{ fontSize: 12.5, fontWeight: 700, marginTop: 6 }}>{fmt(s.price)} <span style={{ fontSize: 10.5, color: "#8A93A6", fontWeight: 400 }}>/ {s.unit}</span></div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ── Engineering trust block: 3 bullets + the exploded view ── */}
      <section style={{ background: "#161D2B", color: "#fff", borderRadius: 16, padding: "20px 22px", display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: 20, alignItems: "center" }} className="norisys-eng">
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "1.1px", textTransform: "uppercase", color: "#9AA6FF", marginBottom: 6 }}>
            {eng.title}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {eng.bullets.map(([t, sub]) => (
              <div key={t}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{t}</div>
                <div style={{ fontSize: 12.5, color: "rgba(255,255,255,0.72)", lineHeight: 1.5 }}>{sub}</div>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            {NORISYS_BADGES.map((b) => (
              <span key={b} style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: "0.5px", border: "1px solid rgba(255,255,255,0.3)", borderRadius: 7, padding: "3px 9px", color: "rgba(255,255,255,0.85)" }}>{b}</span>
            ))}
          </div>
        </div>
        <div style={{ background: "#fff", borderRadius: 12, padding: 8, minHeight: 180, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={EXPLODED[series]} alt={`${series} series exploded view`} loading="lazy" style={{ maxWidth: "100%", maxHeight: 240, objectFit: "contain" }} />
        </div>
      </section>
    </div>
  );
}
