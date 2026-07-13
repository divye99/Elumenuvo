import Link from "next/link";
import { GROTESK, MONO } from "@/lib/fonts";
import { fmt } from "@/lib/format";
import { wholesalePrice, offMrpPct, WHOLESALE_MIN_QTY, baseExGst } from "@/lib/pricing";
import { dimsOf } from "@/lib/variants";
import type { Product, TechSpecs } from "@/lib/data";
import type { BlogPost } from "@/lib/blog";

/**
 * The "deep" half of the product page — everything an electrical buyer wants
 * beyond price: parsed technical specifications, per-metre economics, the
 * full variant family as a comparison table, an Elume trust strip, and the
 * category buying guide with its FAQs. All spec rows are PARSED from the
 * product's own name/spec/attrs (plus category-level IS/IEC standards) —
 * nothing is invented per product.
 */
export default function ProductDeepDive({
  p,
  siblings,
  post,
}: {
  p: Product;
  siblings: Product[];
  post: BlogPost | null;
}) {
  const specs = techSpecs(p);
  const metres = coilMetres(p);
  const family = siblings.length > 1 ? siblings : [];
  const dims = family.length ? dimsOf(family) : [];
  const anyMetres = family.some((s) => coilMetres(s));

  return (
    <div style={{ maxWidth: 1120, margin: "0 auto", padding: "0 30px", display: "flex", flexDirection: "column", gap: 18 }}>
      {/* ── Trust strip ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        {[
          ["🏷️", "100% genuine", "Brand-authorised stock with full manufacturer warranty"],
          ["🧾", "GST invoice", "Tax invoice on every order · GST billing with tax split"],
          ["🚚", "Pan-India delivery", "3–7 working days to any site in India"],
          [
            "📦",
            "Wholesale built in",
            `−5% auto-applies at ${WHOLESALE_MIN_QTY}+ units — ${fmt(wholesalePrice(p.price))}/${p.unit} on this product`,
          ],
        ].map(([icon, title, body]) => (
          <div key={title} style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 14, padding: "14px 16px" }}>
            <div style={{ fontSize: 18, marginBottom: 6 }}>{icon}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#19202E" }}>{title}</div>
            <div style={{ fontSize: 11.5, color: "#56627A", lineHeight: 1.45, marginTop: 3 }}>{body}</div>
          </div>
        ))}
      </div>

      {/* ── Catalogue technical data (wires) ── */}
      {p.techSpecs && <TechSpecsBlock t={p.techSpecs} />}

      {/* ── Technical specifications ── */}
      {specs.length > 0 && (
        <div style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 16, padding: "24px 28px" }}>
          <h3 style={{ fontFamily: GROTESK, fontSize: 20, fontWeight: 600, letterSpacing: "-0.4px", margin: "0 0 4px" }}>
            Technical specifications
          </h3>
          <div style={{ fontSize: 12.5, color: "#8A93A6", marginBottom: 14 }}>
            {p.brand} {p.name} · {p.sku}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: 40 }}>
            {specs.map(([k, v]) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 16, padding: "11px 0", borderBottom: "1px solid #F5F6F9" }}>
                <span style={{ fontSize: 12.5, color: "#8A93A6", flexShrink: 0 }}>{k}</span>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: "#19202E", textAlign: "right" }}>{v}</span>
              </div>
            ))}
          </div>
          {metres && (
            <div style={{ display: "flex", gap: 26, flexWrap: "wrap", background: "#F5F6F9", border: "1px solid #E8EBF1", borderRadius: 11, padding: "13px 16px", marginTop: 16 }}>
              <PriceStat label="Effective price" value={`${fmt(Math.round((baseExGst(p.price, p.cat) / metres) * 100) / 100)}/m +GST`} />
              <PriceStat label={`Wholesale (${WHOLESALE_MIN_QTY}+ coils)`} value={`${fmt(Math.round((baseExGst(wholesalePrice(p.price), p.cat) / metres) * 100) / 100)}/m +GST`} />
              <PriceStat label="MRP equivalent" value={`${fmt(Math.round((baseExGst(p.market, p.cat) / metres) * 100) / 100)}/m`} muted />
            </div>
          )}
        </div>
      )}

      {/* ── Full range (variant family) ── */}
      {family.length > 1 && (
        <div style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 16, padding: "24px 28px" }}>
          <h3 style={{ fontFamily: GROTESK, fontSize: 20, fontWeight: 600, letterSpacing: "-0.4px", margin: "0 0 4px" }}>
            The full range · {family.length} options
          </h3>
          <div style={{ fontSize: 12.5, color: "#8A93A6", marginBottom: 14 }}>
            Every option is its own product with live pricing — tap a row to switch.
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <thead>
                <tr>
                  {["Option", ...dims, "Elume price (ex-GST)", ...(anyMetres ? ["₹ / metre"] : []), "MRP", "Off"].map((h) => (
                    <th key={h} style={{ textAlign: h === "Option" ? "left" : "right", padding: "8px 10px", fontSize: 10.5, fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase", color: "#8A93A6", borderBottom: "1px solid #E8EBF1", whiteSpace: "nowrap" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {family.map((s) => {
                  const current = s.id === p.id;
                  const m = coilMetres(s);
                  return (
                    <tr key={s.id} style={{ background: current ? "#F7F8FF" : undefined }}>
                      <td style={{ padding: "10px", borderBottom: "1px solid #F5F6F9" }}>
                        <Link href={`/catalogue/${s.id}`} style={{ fontWeight: 600, color: current ? "#4E5BDC" : "#19202E", display: "inline-flex", alignItems: "center", gap: 7 }}>
                          {s.name}
                          {!s.parentId && (
                            <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "0.4px", color: "#8A93A6", background: "#F0F2F6", padding: "2px 7px", borderRadius: 7, textTransform: "uppercase" }}>Parent</span>
                          )}
                          {current && (
                            <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "0.4px", color: "#4E5BDC", background: "#EEF0FE", padding: "2px 7px", borderRadius: 7, textTransform: "uppercase" }}>Viewing</span>
                          )}
                        </Link>
                      </td>
                      {dims.map((d) => (
                        <td key={d} style={{ padding: "10px", textAlign: "right", color: "#3A4358", borderBottom: "1px solid #F5F6F9", whiteSpace: "nowrap" }}>
                          {s.attrs?.[d] ?? "—"}
                        </td>
                      ))}
                      <td style={{ padding: "10px", textAlign: "right", fontFamily: GROTESK, fontWeight: 600, color: "#19202E", borderBottom: "1px solid #F5F6F9", whiteSpace: "nowrap" }}>
                        {fmt(baseExGst(s.price, s.cat))}
                      </td>
                      {anyMetres && (
                        <td style={{ padding: "10px", textAlign: "right", fontFamily: MONO, fontSize: 11.5, color: "#56627A", borderBottom: "1px solid #F5F6F9", whiteSpace: "nowrap" }}>
                          {m ? `${fmt(Math.round((baseExGst(s.price, s.cat) / m) * 100) / 100)}` : "—"}
                        </td>
                      )}
                      <td style={{ padding: "10px", textAlign: "right", color: "#A0A7B5", textDecoration: "line-through", borderBottom: "1px solid #F5F6F9", whiteSpace: "nowrap" }}>
                        {fmt(baseExGst(s.market, s.cat))}
                      </td>
                      <td style={{ padding: "10px", textAlign: "right", fontWeight: 700, color: "#1F9D63", borderBottom: "1px solid #F5F6F9", whiteSpace: "nowrap" }}>
                        {offMrpPct(s.price, s.market)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Buying guide + category FAQs ── */}
      {post && (
        <div style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 16, padding: "24px 28px" }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            <h3 style={{ fontFamily: GROTESK, fontSize: 20, fontWeight: 600, letterSpacing: "-0.4px", margin: 0 }}>
              Know before you buy
            </h3>
            <Link href={`/blog/${post.slug}`} style={{ fontSize: 13, fontWeight: 600, color: "#4E5BDC" }}>
              Read: {post.title} →
            </Link>
          </div>
          <div style={{ marginTop: 8 }}>
            {post.faq.slice(0, 3).map((f) => (
              <div key={f.q} style={{ padding: "14px 0", borderBottom: "1px solid #F5F6F9" }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: "#19202E", marginBottom: 5 }}>{f.q}</div>
                <div style={{ fontSize: 13, color: "#56627A", lineHeight: 1.55 }}>{f.a}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PriceStat({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: "#8A93A6" }}>{label}</div>
      <div style={{ fontFamily: GROTESK, fontSize: 16, fontWeight: 600, color: muted ? "#8A93A6" : "#19202E", textDecoration: muted ? "line-through" : undefined }}>
        {value}
      </div>
    </div>
  );
}

/* ── Manufacturer catalogue technical data (wires) ── */
function TechSpecsBlock({ t }: { t: TechSpecs }) {
  const c = t.conductor ?? {};
  const rating = t.current_rating_a;
  const ratingText = rating
    ? rating.min != null && rating.max != null && rating.min !== rating.max
      ? `${rating.min}–${rating.max} A`
      : `${rating.max ?? rating.min} A`
    : null;
  // Left column: the measurable construction data.
  const rows = ([
    ["Conductor", c.material ? `${c.material}${c.class ? ` · class ${c.class}` : ""}` : null],
    ["Strand construction", c.strands ? `${c.strands} (no./mm)` : null],
    ["Insulation", t.insulation?.material ?? null],
    ["Insulation thickness", t.insulation?.thickness_mm != null ? `${t.insulation.thickness_mm} mm` : null],
    ["Overall diameter", t.dimensions?.overall_diameter_mm != null ? `${t.dimensions.overall_diameter_mm} mm` : null],
    ["Current-carrying capacity", ratingText],
    ["Max conductor resistance", c.resistance_ohm_km != null ? `${c.resistance_ohm_km} Ω/km at 20°C` : null],
    ["Max operating temp", t.max_operating_temp_c != null ? `${t.max_operating_temp_c}°C` : null],
    ["Voltage grade", t.voltage_grade_v != null ? `${t.voltage_grade_v} V` : null],
    ["Standards", t.standards?.length ? t.standards.join(", ") : null],
    ["Packing", t.packing ?? null],
  ] as [string, string | null][]).filter((r): r is [string, string] => !!r[1]);

  return (
    <div style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 16, padding: "24px 28px" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap", margin: "0 0 14px" }}>
        <h3 style={{ fontFamily: GROTESK, fontSize: 20, fontWeight: 600, letterSpacing: "-0.4px", margin: 0 }}>
          Technical data{t.line ? ` · ${t.line}` : ""}
        </h3>
        {t.source && <span style={{ fontSize: 11, color: "#A0A7B5" }}>from {t.source}</span>}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: 40 }}>
        {rows.map(([k, v]) => (
          <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 16, padding: "11px 0", borderBottom: "1px solid #F5F6F9" }}>
            <span style={{ fontSize: 12.5, color: "#8A93A6", flexShrink: 0 }}>{k}</span>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: "#19202E", textAlign: "right" }}>{v}</span>
          </div>
        ))}
      </div>

      {/* Fire & safety test results */}
      {t.fire_tests?.length ? (
        <>
          <h4 style={{ fontFamily: GROTESK, fontSize: 14, fontWeight: 600, margin: "20px 0 8px" }}>Fire &amp; safety test results</h4>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <thead>
                <tr>
                  {["Test", "Method", "Specified value"].map((h) => (
                    <th key={h} style={{ textAlign: h === "Test" ? "left" : "right", padding: "8px 10px", fontSize: 10.5, fontWeight: 700, letterSpacing: "0.5px", textTransform: "uppercase", color: "#8A93A6", borderBottom: "1px solid #E8EBF1", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {t.fire_tests.map((f) => (
                  <tr key={f.test}>
                    <td style={{ padding: "9px 10px", borderBottom: "1px solid #F5F6F9", fontWeight: 600, color: "#19202E" }}>{f.test}</td>
                    <td style={{ padding: "9px 10px", borderBottom: "1px solid #F5F6F9", textAlign: "right", fontFamily: MONO, fontSize: 11.5, color: "#56627A", whiteSpace: "nowrap" }}>{f.method || "—"}</td>
                    <td style={{ padding: "9px 10px", borderBottom: "1px solid #F5F6F9", textAlign: "right", fontWeight: 700, color: "#137a4b", whiteSpace: "nowrap" }}>{f.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}

      {t.colours?.length ? (
        <div style={{ fontSize: 11.5, color: "#8A93A6", marginTop: 14 }}>Available colours: {t.colours.join(", ")}</div>
      ) : null}
    </div>
  );
}

/* ── Spec parsing — extracts only what the product's own data states ── */

function coilMetres(p: Product): number | null {
  const src = p.attrs?.Length ?? p.spec;
  const m = src?.match(/(\d+)\s*m\b/);
  return m ? Number(m[1]) : null;
}

function techSpecs(p: Product): [string, string][] {
  const rows: [string, string][] = [];
  const add = (k: string, v: string | null | undefined) => {
    if (v) rows.push([k, v]);
  };
  const text = `${p.name} · ${p.spec}`;
  const grab = (re: RegExp) => text.match(re)?.[1] ?? null;

  switch (p.cat) {
    case "Wires & Cables": {
      if (/copper/i.test(text)) add("Conductor", /single-core/i.test(text) ? "Single-core electrolytic copper" : "Electrolytic copper");
      const q = p.attrs?.Quality;
      const ins: Record<string, string> = {
        FR: "FR PVC — flame retardant",
        FRLS: "FRLS PVC — flame retardant, low smoke",
        PVC: "General-purpose PVC",
      };
      add("Insulation", (q && ins[q]) ?? (/HR PVC/i.test(text) ? "HR PVC — heat resistant" : null));
      add("Conductor size", p.attrs?.Size);
      add("Voltage grade", /1100\s*V/.test(text) ? "1100 V (1.1 kV)" : null);
      add("Coil length", p.attrs?.Length ?? (coilMetres(p) ? `${coilMetres(p)} m` : null));
      add("Core colour", p.attrs?.Colour);
      add("Warranty", /10-yr warranty/i.test(text) ? "10-year manufacturer warranty" : null);
      add("Reference standard", "IS 694:2010");
      add("Application", "Fixed internal wiring — conduit & casing-capping");
      break;
    }
    case "Switchgear": {
      const isRccb = /RCCB/i.test(text);
      const isIso = /isolator|disconnector/i.test(text);
      add("Device type", isRccb ? "Residual current circuit breaker (RCCB)" : isIso ? "Switch disconnector (isolator)" : "Miniature circuit breaker (MCB)");
      add("Current rating", grab(/(\d+)\s*A\b/) ? `${grab(/(\d+)\s*A\b/)} A` : null);
      add("Trip curve", grab(/'([BCD])'/) ?? grab(/\b([BCD]) curve/) ? `${grab(/'([BCD])'/) ?? grab(/\b([BCD]) curve/)} curve` : null);
      add("Breaking capacity", grab(/(\d+(?:\.\d+)?)\s*kA/) ? `${grab(/(\d+(?:\.\d+)?)\s*kA/)} kA` : null);
      add("Poles", polesOf(text));
      add("Sensitivity", isRccb && grab(/(\d+)\s*mA/) ? `${grab(/(\d+)\s*mA/)} mA` : null);
      add("Reference standard", isRccb ? "IS 12640-1 / IEC 61008" : isIso ? "IEC 60947-3" : "IS/IEC 60898-1");
      break;
    }
    case "Modular": {
      const type = /socket/i.test(text) ? "Modular socket outlet" : /regulator/i.test(text) ? "Fan regulator" : /plate/i.test(text) ? "Cover plate" : "Modular switch";
      add("Device type", type);
      add("Current rating", grab(/(\d+)\s*A\b/) ? `${grab(/(\d+)\s*A\b/)} A` : null);
      add("Control", grab(/(\d)-way/) ? `${grab(/(\d)-way/)}-way` : /2-way/i.test(text) ? "2-way" : null);
      add("Finish", /white/i.test(text) ? "White" : null);
      add("Reference standard", /socket/i.test(text) ? "IS 1293" : /switch/i.test(text) ? "IS 3854" : null);
      break;
    }
    case "Lighting": {
      const form = /batten/i.test(text) ? "LED batten" : /panel/i.test(text) ? "LED panel" : /flood/i.test(text) ? "LED flood light" : /street/i.test(text) ? "LED street light" : "LED bulb";
      add("Luminaire type", form);
      add("Wattage", grab(/(\d+(?:\.\d+)?)\s*W\b/) ? `${grab(/(\d+(?:\.\d+)?)\s*W\b/)} W` : null);
      const cct = grab(/(\d{4})\s*K/);
      add("Colour temperature", cct ? `${cct} K${cct === "6500" ? " — cool daylight" : ""}` : null);
      add("Lamp cap", grab(/\b(B22|E27)\b/));
      add("Ingress protection", grab(/IP\s?(\d{2})/) ? `IP${grab(/IP\s?(\d{2})/)}` : null);
      add("Reference standard", "IS 16102 / IS 10322");
      break;
    }
    case "Fans": {
      const isExhaust = /exhaust/i.test(text);
      add("Fan type", isExhaust ? "Exhaust fan" : /BLDC/i.test(text) ? "Ceiling fan — BLDC motor" : "Ceiling fan");
      add("Sweep", grab(/(\d{3,4})\s*mm/) ? `${grab(/(\d{3,4})\s*mm/)} mm` : null);
      add("Power", grab(/(\d+(?:\.\d+)?)\s*W\b/) ? `${grab(/(\d+(?:\.\d+)?)\s*W\b/)} W` : null);
      add("Speed", grab(/(\d+)\s*RPM/) ? `${grab(/(\d+)\s*RPM/)} RPM` : null);
      add("Energy rating", /5-star/i.test(text) ? "5-star (BEE)" : null);
      add("Remote", /remote/i.test(text) ? "Included" : null);
      add("Reference standard", isExhaust ? "IS 2312" : "IS 374");
      break;
    }
    case "DB & Panels": {
      add("Enclosure type", /TPN/i.test(text) ? "Distribution board — TPN (three phase)" : "Distribution board — SPN (single phase)");
      add("Ways", grab(/(\d+)-way/) ? `${grab(/(\d+)-way/)}-way` : null);
      add("Door", /double door/i.test(text) ? "Double door" : /single door/i.test(text) ? "Single door" : null);
      add("Ingress protection", grab(/IP\s?(\d{2})/) ? `IP${grab(/IP\s?(\d{2})/)}` : null);
      add("Material", /CRCA/i.test(text) ? "CRCA steel, powder coated" : null);
      add("Reference standard", "IS 8623 / IEC 61439");
      break;
    }
  }

  add("Brand", p.brand);
  add("SKU", p.sku);
  add("Sold as", `Per ${p.unit}`);
  return rows;
}

function polesOf(text: string): string | null {
  const m = text.match(/(\d)-pole/);
  if (m) return `${m[1]}-pole`;
  if (/\bSP\b|SP MCB/i.test(text)) return "1-pole (SP)";
  if (/\bDP\b/i.test(text)) return "2-pole (DP)";
  if (/\b4P\b|4-pole/i.test(text)) return "4-pole";
  return null;
}
