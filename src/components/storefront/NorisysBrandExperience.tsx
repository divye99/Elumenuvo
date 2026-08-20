import { NORISYS_ENGINEERING } from "@/lib/norisys";

/**
 * Norisys flagship header, v2 (owner review, Aug 2026): brand first, shop
 * second. Two sections only - (1) an editorial hero in the catalogue's own
 * visual language: the norisys logotype, a materials reel animated from the
 * brand book's photography, no navigation buttons (nothing here yanks the
 * visitor off the page); (2) the engineering band with the exploded view.
 * Below these, the standard hub takes over - with Finish joining Category
 * in the normal filter rail, so shopping controls stay uniform.
 */

const STORE = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/product-images/norisys/series`;

const REEL: { img: string; caption: string }[] = [
  { img: "story-marble.jpg", caption: "Charcoal on solid marble" },
  { img: "story-wood.jpg", caption: "Silver on dark bronze wood" },
  { img: "story-metal.jpg", caption: "Brushed solid aluminium" },
  { img: "story-alt.jpg", caption: "Metallic on rosewood" },
];

export default function NorisysBrandExperience() {
  return (
    <section style={{ margin: "0 0 30px" }}>
      {/* ── 1 · Editorial hero ── */}
      <div style={{ borderRadius: 20, overflow: "hidden", background: "#F5F5F3", display: "grid", gridTemplateColumns: "1fr 1.15fr", minHeight: 380 }} className="nrs-hero">
        <div style={{ padding: "44px 46px", display: "flex", flexDirection: "column", justifyContent: "center", gap: 16 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`${STORE}/logo.png`} alt="Norisys" style={{ width: 148, height: "auto", mixBlendMode: "multiply" }} />
          {/* The page h1 lives here (the hub header below is hidden for
              Norisys), so it carries the brand name for SEO. */}
          <h1 style={{ fontSize: "clamp(24px, 2.8vw, 36px)", fontWeight: 300, lineHeight: 1.18, color: "#23262B", margin: 0, letterSpacing: "-0.4px", fontFamily: "inherit" }}>
            Twenty-five years of Norisys engineering.
            <br />
            <span style={{ fontWeight: 600 }}>Modular switches faced in glass, wood, marble and metal.</span>
          </h1>
          <p style={{ fontSize: 14, color: "#6E7480", lineHeight: 1.7, maxWidth: 460, margin: 0 }}>
            Silver-rich, snap-action contacts that keep arcing low and last for years.
            Steel-cored frames that hold every module in perfect line. Cover plates of
            tempered glass, seasoned wood, machined marble and aluminium that go on after
            the walls are painted, and swap any time without touching the wiring.
          </p>
        </div>
        {/* The materials reel: slow crossfade + drift over the brand book's
            own photography. Static first frame when motion is reduced. */}
        <div style={{ position: "relative", minHeight: 380, overflow: "hidden" }} className="nrs-reel" aria-hidden>
          {REEL.map((f, i) => (
            <div key={f.img} className={`nrs-slide nrs-slide-${i}`} style={{ backgroundImage: `url(${STORE}/${f.img})` }} />
          ))}
          <div className="nrs-captions">
            {REEL.map((f, i) => (
              <span key={f.img} className={`nrs-cap nrs-cap-${i}`}>{f.caption}</span>
            ))}
          </div>
        </div>
      </div>

      {/* ── 2 · Engineering band ── */}
      <div style={{ margin: "18px 0 0", background: "#16215B", borderRadius: 20, padding: "26px 28px", display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: 24, alignItems: "center" }} className="nrs-eng">
        <div>
          <div style={{ fontSize: 11.5, letterSpacing: "2px", textTransform: "uppercase", color: "#9AA6FF", fontWeight: 600, marginBottom: 10 }}>
            Built like instruments
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {NORISYS_ENGINEERING.CUBE.bullets.map(([t, sub]) => (
              <div key={t}>
                <div style={{ fontSize: 14.5, fontWeight: 700, color: "#fff" }}>{t}</div>
                <div style={{ fontSize: 12.5, color: "rgba(255,255,255,0.7)", lineHeight: 1.55 }}>{sub}</div>
              </div>
            ))}
            <div>
              <div style={{ fontSize: 14.5, fontWeight: 700, color: "#fff" }}>Snap-fit, paint-safe plates</div>
              <div style={{ fontSize: 12.5, color: "rgba(255,255,255,0.7)", lineHeight: 1.55 }}>Cover plates go on after the walls are painted, so the finish never meets a paintbrush.</div>
            </div>
          </div>
        </div>
        <div style={{ background: "#fff", borderRadius: 14, padding: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`${STORE}/cube-exploded.png`} alt="Norisys CUBE series exploded view" loading="lazy" style={{ maxWidth: "100%", maxHeight: 300, objectFit: "contain" }} />
        </div>
      </div>

      <style>{`
        .nrs-slide {
          position: absolute; inset: -4%;
          background-size: cover; background-position: center;
          opacity: 0; animation: nrsFade 24s infinite;
          will-change: opacity, transform;
        }
        .nrs-slide-0 { animation-delay: 0s; }
        .nrs-slide-1 { animation-delay: 6s; }
        .nrs-slide-2 { animation-delay: 12s; }
        .nrs-slide-3 { animation-delay: 18s; }
        @keyframes nrsFade {
          0% { opacity: 0; transform: scale(1) translateX(0); }
          4% { opacity: 1; }
          25% { opacity: 1; transform: scale(1.06) translateX(-1.5%); }
          31% { opacity: 0; transform: scale(1.07) translateX(-1.8%); }
          100% { opacity: 0; }
        }
        .nrs-captions {
          position: absolute; left: 18px; bottom: 14px; z-index: 2; height: 26px;
        }
        .nrs-cap {
          position: absolute; left: 0; bottom: 0; white-space: nowrap;
          font-size: 12px; font-weight: 600; letter-spacing: 0.6px; text-transform: uppercase;
          color: #fff; background: rgba(22, 29, 43, 0.55); backdrop-filter: blur(4px);
          border-radius: 8px; padding: 5px 12px;
          opacity: 0; animation: nrsCap 24s infinite;
        }
        .nrs-cap-0 { animation-delay: 0s; }
        .nrs-cap-1 { animation-delay: 6s; }
        .nrs-cap-2 { animation-delay: 12s; }
        .nrs-cap-3 { animation-delay: 18s; }
        @keyframes nrsCap {
          0% { opacity: 0; transform: translateY(6px); }
          5% { opacity: 1; transform: translateY(0); }
          25% { opacity: 1; }
          30% { opacity: 0; transform: translateY(-4px); }
          100% { opacity: 0; }
        }
        @media (prefers-reduced-motion: reduce) {
          .nrs-slide, .nrs-cap { animation: none !important; }
          .nrs-slide-0, .nrs-cap-0 { opacity: 1 !important; }
        }
        @media (max-width: 860px) {
          .nrs-hero { grid-template-columns: 1fr !important; }
          .nrs-hero .nrs-reel { min-height: 240px !important; }
          .nrs-eng { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </section>
  );
}
