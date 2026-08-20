import { GROTESK, MONO } from "@/lib/fonts";

/**
 * Elume house-brand flagship header for /brand/elume (Factor X identity,
 * Aug 2026). Brand first, shop second, mirroring the Norisys pattern:
 * (1) gradient hero in the brand's signature palette with the tagline
 * (the tagline belongs to the housewires range ONLY, never the marketplace);
 * (2) FR vs HFFR range band; (3) certification wall. The standard hub
 * takes over below.
 */

const CERTS: { img: string; label: string }[] = [
  { img: "/assets/certs/isi.png", label: "IS 694 · BIS" },
  { img: "/assets/certs/astm.png", label: "ASTM tested" },
  { img: "/assets/certs/ce.svg", label: "CE" },
  { img: "/assets/certs/rohs.png", label: "RoHS" },
  { img: "/assets/certs/reach.png", label: "REACH" },
];

export default function ElumeBrandExperience() {
  return (
    <section style={{ margin: "0 0 30px" }}>
      {/* ── 1 · Gradient hero ── */}
      <div className="ebx-hero" style={{ borderRadius: 20, overflow: "hidden", background: "linear-gradient(133deg, #16215B 0%, #1D2F8A 34%, #723271 70%, #F25929 104%)", display: "grid", gridTemplateColumns: "1.1fr 1fr", color: "#fff" }}>
        <div style={{ padding: "44px 46px", display: "flex", flexDirection: "column", justifyContent: "center", gap: 16 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/assets/elume-wordmark-white.png" alt="Elume" style={{ width: 150, height: "auto" }} />
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/assets/elume-star.png" alt="" style={{ height: 14, width: "auto" }} />
            <span style={{ fontFamily: MONO, fontSize: 11.5, letterSpacing: "2px", textTransform: "uppercase", color: "#D2AE6D", fontWeight: 700 }}>
              Current ka naya standard
            </span>
          </div>
          <h1 style={{ fontFamily: GROTESK, fontSize: "clamp(24px, 2.8vw, 36px)", fontWeight: 600, lineHeight: 1.18, margin: 0, letterSpacing: "-0.4px" }}>
            Why should the wire inside an Indian home be any less safe than the wire inside a European one?
          </h1>
          <p style={{ fontSize: 14, color: "rgba(255,255,255,0.85)", lineHeight: 1.7, maxWidth: 470, margin: 0 }}>
            Elume house wires were built to close that gap. Not with a louder claim, but with a higher standard:
            99.9% electrolytic grade copper, FR and HFFR insulation engineered to exceed the benchmark, and every
            single metre spark-tested before it leaves the facility.
          </p>
        </div>
        <div className="ebx-img" style={{ minHeight: 340, backgroundImage: "url(/assets/elume-brand/family-shield.jpg)", backgroundSize: "cover", backgroundPosition: "center 30%" }} aria-hidden />
      </div>

      {/* ── 2 · The two ranges ── */}
      <div className="ebx-ranges" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, margin: "18px 0 0" }}>
        <div style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 20, padding: "26px 28px" }}>
          <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: "1.6px", textTransform: "uppercase", color: "#1D2F8A", fontWeight: 700 }}>Elume FR</div>
          <div style={{ fontFamily: GROTESK, fontSize: 20, fontWeight: 700, margin: "6px 0 8px" }}>Flame retardant, for the modern Indian home</div>
          <p style={{ fontSize: 13, color: "#56627A", lineHeight: 1.65, margin: 0 }}>
            Multi-stranded flexible copper with FR PVC insulation that handles overloads, resists moisture and
            self-extinguishes: protecting the family on the other side of the wall, not just the circuit.
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
            {["0.5 to 10 sq mm", "7 colours", "45 / 90 / 180 m coils", "IS 694"].map((c) => (
              <span key={c} style={{ fontSize: 11.5, fontWeight: 700, color: "#1D2F8A", background: "#E9EDF9", borderRadius: 8, padding: "4px 10px" }}>{c}</span>
            ))}
          </div>
        </div>
        <div style={{ background: "#16215B", color: "#fff", borderRadius: 20, padding: "26px 28px", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: 14, right: 16, fontSize: 10, fontWeight: 800, letterSpacing: "1px", textTransform: "uppercase", color: "#16215B", background: "#D2AE6D", borderRadius: 7, padding: "3px 9px" }}>Flagship</div>
          <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: "1.6px", textTransform: "uppercase", color: "#D2AE6D", fontWeight: 700 }}>Elume HFFR</div>
          <div style={{ fontFamily: GROTESK, fontSize: 20, fontWeight: 700, margin: "6px 0 8px" }}>Halogen free, for buildings where lives depend on it</div>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.8)", lineHeight: 1.65, margin: 0 }}>
            A 100% halogen-free compound that does not melt or drip in a fire and produces minimal, non-toxic
            smoke, giving everyone inside the critical time to get out. RoHS and REACH compliant, cleared for the
            most stringent international markets.
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
            {["1 to 6 sq mm", "7 colours", "90 m coils", "PVC free"].map((c) => (
              <span key={c} style={{ fontSize: 11.5, fontWeight: 700, color: "#fff", background: "rgba(255,255,255,0.12)", borderRadius: 8, padding: "4px 10px" }}>{c}</span>
            ))}
          </div>
        </div>
      </div>

      {/* ── 3 · Certification wall ── */}
      <div className="ebx-certs" style={{ margin: "18px 0 0", background: "#fff", border: "1px solid #E8EBF1", borderRadius: 20, padding: "20px 28px", display: "flex", alignItems: "center", gap: 22, flexWrap: "wrap" }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: "#3A4358", flex: "0 0 auto" }}>
          Engineered for the world&apos;s
          <br />
          toughest standards
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 26, flexWrap: "wrap", marginLeft: "auto" }}>
          {CERTS.map((c) => (
            <div key={c.label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={c.img} alt={c.label} style={{ height: 34, width: "auto", objectFit: "contain" }} loading="lazy" />
              <span style={{ fontSize: 10, fontWeight: 700, color: "#8A93A6", letterSpacing: "0.4px" }}>{c.label}</span>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @media (max-width: 860px) {
          .ebx-hero { grid-template-columns: 1fr !important; }
          .ebx-hero .ebx-img { min-height: 220px !important; }
          .ebx-ranges { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </section>
  );
}
