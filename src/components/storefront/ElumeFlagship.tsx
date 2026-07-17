import { GROTESK, MONO } from "@/lib/fonts";
import type { Product } from "@/lib/data";

/**
 * The house-label section, shown only on Elume-brand product pages. Voice and
 * art direction follow the packaging and catalogue: deep indigo falling to
 * ember, quiet engineering-led copy, no superlatives. The product argues for
 * itself the way a well-made machine does.
 */

const PALETTE = [
  { name: "Ultraviolet", real: "bright purple", hex: "#7A2FD1" },
  { name: "Solar Flare", real: "yellow", hex: "#FFC400" },
  { name: "Aurora", real: "green", hex: "#12A15E" },
  { name: "Ember", real: "red", hex: "#D93025" },
  { name: "Midnight", real: "blue", hex: "#25348F" },
  { name: "Moonlight", real: "white", hex: "#F4F5F0" },
  { name: "Eclipse", real: "black", hex: "#16181D" },
];

const PROOFS: [string, string][] = [
  ["IS 694 · IS 8130", "Made to the Indian standards for PVC-insulated cables and copper conductors, end to end."],
  ["Class-5 flexible copper", "Bright annealed electrolytic copper, drawn fine and stranded for conduit work that flows instead of fights."],
  ["Self-extinguishing FR PVC", "Insulation compounded to resist ignition and stop carrying a flame when the source is removed."],
  ["Oxygen index, ASTM D2863", "Tested above the threshold of standard PVC. It takes more oxygen than air can offer to keep it burning."],
  ["Low smoke, ASTM D2843", "In the minutes that matter, visibility is safety. The compound is tested for low smoke density."],
  ["Spark-tested. Every coil.", "Each length passes a high-voltage spark test before it is boxed. Not a sample from the batch. All of it."],
];

export default function ElumeFlagship({ p }: { p: Product }) {
  return (
    <section style={{ borderRadius: 18, overflow: "hidden", border: "1px solid #262a55", background: "linear-gradient(168deg, #191c45 0%, #232052 38%, #5b2d63 68%, #b0472e 100%)", color: "#fff" }}>
      {/* ── Opening statement ── */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(280px, 5fr) minmax(300px, 6fr)", gap: 0, alignItems: "stretch" }} className="ef-hero">
        <div style={{ padding: "clamp(28px, 4vw, 52px)", display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: "2.5px", color: "#C9A24B", textTransform: "uppercase", marginBottom: 14 }}>The house label</div>
          <h2 style={{ fontFamily: GROTESK, fontSize: "clamp(26px, 3vw, 38px)", fontWeight: 600, letterSpacing: "-0.8px", lineHeight: 1.12, margin: 0 }}>
            Wire, the way we believe it should be made.
          </h2>
          <p style={{ fontSize: 14.5, lineHeight: 1.7, color: "rgba(255,255,255,0.82)", margin: "18px 0 0" }}>
            Elume FR begins as bright annealed electrolytic copper, drawn to IS 8130 and stranded into a class-5
            conductor that moves through conduit the way it should. It is insulated in a flame-retardant compound
            that refuses to carry fire, and finished in a palette you will recognise from across a site.
          </p>
          <p style={{ fontSize: 14.5, lineHeight: 1.7, color: "rgba(255,255,255,0.82)", margin: "12px 0 0" }}>
            Then every single coil, not a sample, is spark-tested at high voltage before it is allowed into the box.
            The box, you will notice, was not an afterthought either.
          </p>
        </div>
        <div style={{ minHeight: 320, background: "#0e102e" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/elume/box-angle.jpg" alt="Elume FR house wire carton" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        </div>
      </div>

      {/* ── Engineering, stated plainly ── */}
      <div style={{ padding: "clamp(22px, 3vw, 40px)", borderTop: "1px solid rgba(255,255,255,0.12)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14 }}>
          {PROOFS.map(([title, body]) => (
            <div key={title} style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)", borderRadius: 13, padding: "16px 18px" }}>
              <div style={{ fontFamily: GROTESK, fontSize: 14.5, fontWeight: 600, letterSpacing: "-0.2px" }}>{title}</div>
              <div style={{ fontSize: 12.5, lineHeight: 1.6, color: "rgba(255,255,255,0.72)", marginTop: 6 }}>{body}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── A palette of light ── */}
      <div style={{ padding: "clamp(22px, 3vw, 40px)", borderTop: "1px solid rgba(255,255,255,0.12)" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
          <div style={{ fontFamily: GROTESK, fontSize: 19, fontWeight: 600, letterSpacing: "-0.4px" }}>A palette of light</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>Seven finishes. The electrical colour is printed on every carton.</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 12 }}>
          {PALETTE.map((c) => (
            <div key={c.name} style={{ background: "rgba(255,255,255,0.05)", border: `1px solid ${p.attrs?.Colour === c.name ? "#C9A24B" : "rgba(255,255,255,0.10)"}`, borderRadius: 12, padding: 12, textAlign: "center" }}>
              <span style={{ display: "inline-block", width: 34, height: 34, borderRadius: "50%", background: c.hex, border: "2px solid rgba(255,255,255,0.35)" }} />
              <div style={{ fontFamily: GROTESK, fontSize: 12.5, fontWeight: 600, marginTop: 8 }}>{c.name}</div>
              <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.55)", marginTop: 2 }}>{c.real}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── The promise + collateral ── */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(280px, 1fr) minmax(280px, 1fr)", gap: 0, borderTop: "1px solid rgba(255,255,255,0.12)" }} className="ef-foot">
        <div style={{ padding: "clamp(24px, 3vw, 44px)", display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: "2px", color: "#C9A24B", textTransform: "uppercase", marginBottom: 12 }}>The Elume promise</div>
          <p style={{ fontFamily: GROTESK, fontSize: "clamp(18px, 2vw, 24px)", fontWeight: 500, lineHeight: 1.35, letterSpacing: "-0.3px", margin: 0, color: "rgba(255,255,255,0.94)" }}>
            &ldquo;Beyond the wire, we deliver the light that empowers families and the safety that protects them.&rdquo;
          </p>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", marginTop: 18, lineHeight: 1.6 }}>
            RoHS compliant · lead-free · 1100 V grade · dispatched in a rigid printed carton, sized to shelve flat and stack clean.
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2, background: "#0e102e" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/elume/brochure-open.jpg" alt="Elume specification brochure" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", minHeight: 170 }} />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/elume/catalogue-cover.jpg" alt="Elume catalogue" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", minHeight: 170 }} />
        </div>
      </div>
    </section>
  );
}
