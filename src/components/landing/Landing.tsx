"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Mark, Wordmark } from "@/components/Brand";
import { GROTESK, MONO } from "@/lib/fonts";
import { fmt } from "@/lib/format";
import { fmtCr } from "@/lib/format";
import { buildHomeChart, homeElumeSeries } from "@/lib/charts";
import { type SiteContent } from "@/lib/content";

type Modal = false | "form" | "success";

const FEATURES = [
  { title: "One catalogue, every brand", iconBg: "#EEF0FD", iconFg: "#4E5BDC" },
  { title: "Transparent pricing", iconBg: "#E6F5EE", iconFg: "#1F9D63" },
  { title: "Smart BOM & phased POs", iconBg: "#F1ECFB", iconFg: "#7B5BDC" },
  { title: "Credit, built in", iconBg: "#FBEDE4", iconFg: "#E0612A" },
];

const SITE_VALUES = ["1–4", "5–10", "11–25", "25+"];

export default function Landing({ content }: { content: SiteContent }) {
  const {
    homeCatalogue: HOME_CATALOGUE,
    homeChart: HOMECHART,
    homeCats: HOME_CATS,
    heroCats: HERO_CATS,
    homeBrands: HOME_BRANDS,
    featureTags: FEATURE_TAGS,
    steps: STEPS,
    miniRows: MINI_ROWS,
  } = content;
  const router = useRouter();
  const [catCat, setCatCat] = useState("All");
  const [chartSku, setChartSku] = useState("poly25");
  const [spend, setSpend] = useState(4);
  const [modal, setModal] = useState<Modal>(false);
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [sites, setSites] = useState("5–10");

  const goApp = (screen?: string) => router.push(screen ? `/app?screen=${screen}` : "/app");
  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 80, behavior: "smooth" });
  };
  const goCatalogue = () => router.push("/catalogue");

  const annualSpend = spend * 12;
  const annualSave = annualSpend * 0.08;
  const capitalFreed = spend;
  const spendLabel = fmtCr(spend).replace(" Cr", "").replace(" L", "");

  const chart = buildHomeChart(HOMECHART, chartSku);
  const showcase = HOME_CATALOGUE.filter((p) => catCat === "All" || p.cat === catCat);

  const navLinks = [
    { label: "Catalogue", go: () => router.push("/catalogue") },
    { label: "Pricing", go: () => scrollTo("pricing") },
    { label: "How it works", go: () => scrollTo("how") },
    { label: "Savings", go: () => scrollTo("calc") },
  ];

  return (
    <div style={{ fontFamily: "var(--hanken)", background: "#fff" }}>
      {/* ===================== NAV ===================== */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 40,
          background: "rgba(255,255,255,0.86)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid #EEF0F4",
        }}
      >
        <div
          style={{
            maxWidth: 1200,
            margin: "0 auto",
            height: 70,
            padding: "0 32px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Mark height={30} />
            <Wordmark height={17} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 30 }}>
            {navLinks.map((l) => (
              <span
                key={l.label}
                onClick={l.go}
                style={{ fontSize: 14, fontWeight: 500, color: "#56627A", cursor: "pointer" }}
              >
                {l.label}
              </span>
            ))}
            <span
              onClick={() => router.push("/space")}
              style={{ fontSize: 14, fontWeight: 500, color: "#56627A", cursor: "pointer" }}
            >
              Space
            </span>
            <span
              onClick={() => goApp()}
              style={{ fontSize: 14, fontWeight: 600, color: "#19202E", cursor: "pointer" }}
            >
              Sign in
            </span>
            <div
              onClick={() => setModal("form")}
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: "#fff",
                background: "#4E5BDC",
                padding: "10px 18px",
                borderRadius: 10,
                cursor: "pointer",
              }}
            >
              Request access
            </div>
          </div>
        </div>
      </div>

      {/* ===================== HERO ===================== */}
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "70px 32px 40px",
          display: "grid",
          gridTemplateColumns: "1.05fr 0.95fr",
          gap: 56,
          alignItems: "center",
        }}
      >
        <div style={{ animation: "elumeFadeUp .6s ease" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              background: "#F2F3FB",
              border: "1px solid #E4E7F6",
              borderRadius: 20,
              padding: "7px 14px",
              marginBottom: 24,
            }}
          >
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#1F9D63" }} />
            <span style={{ fontSize: 12.5, fontWeight: 600, color: "#4E5BDC" }}>
              India&apos;s procurement backbone for FMEG
            </span>
          </div>
          <h1
            style={{
              fontFamily: GROTESK,
              fontSize: 54,
              lineHeight: 1.04,
              letterSpacing: "-1.8px",
              margin: "0 0 22px",
              color: "#161D2B",
            }}
          >
            Procure every site&apos;s
            <br />
            electricals in one
            <br />
            place. Priced fair.
          </h1>
          <p style={{ fontSize: 17.5, lineHeight: 1.6, color: "#56627A", margin: "0 0 24px", maxWidth: 470 }}>
            The dedicated B2B storefront for electrical goods — 20,000+ SKUs, transparent pricing, and a year of price
            history on every product.
          </p>
          {/* storefront search */}
          <div style={{ display: "flex", gap: 10, maxWidth: 480, marginBottom: 14 }}>
            <div
              onClick={goCatalogue}
              style={{
                flex: 1,
                height: 52,
                background: "#fff",
                border: "1.5px solid #E0E4ED",
                borderRadius: 13,
                display: "flex",
                alignItems: "center",
                gap: 11,
                padding: "0 16px",
                boxShadow: "0 6px 18px rgba(20,24,45,.06)",
                cursor: "pointer",
              }}
            >
              <span style={{ width: 16, height: 16, border: "2px solid #b6bdcb", borderRadius: "50%", display: "inline-block" }} />
              <span style={{ fontSize: 14, color: "#8A93A6" }}>Search wires, MCBs, fans, panels…</span>
            </div>
            <div
              onClick={goCatalogue}
              style={{
                background: "#4E5BDC",
                color: "#fff",
                fontWeight: 600,
                fontSize: 14.5,
                padding: "0 24px",
                borderRadius: 13,
                display: "flex",
                alignItems: "center",
                cursor: "pointer",
              }}
            >
              Search
            </div>
          </div>
          {/* category quick-links */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 28 }}>
            {HERO_CATS.map((label) => (
              <div
                key={label}
                onClick={() => {
                  setCatCat(label);
                  scrollTo("catalogue");
                }}
                style={{
                  fontSize: 12.5,
                  fontWeight: 600,
                  color: "#56627A",
                  background: "#fff",
                  border: "1px solid #E8EBF1",
                  padding: "8px 14px",
                  borderRadius: 20,
                  cursor: "pointer",
                }}
              >
                {label}
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
            <div
              onClick={() => setModal("form")}
              style={{
                fontSize: 15,
                fontWeight: 600,
                color: "#fff",
                background: "#161D2B",
                padding: "15px 26px",
                borderRadius: 12,
                cursor: "pointer",
              }}
            >
              Request early access
            </div>
            <div
              onClick={() => goApp()}
              style={{
                fontSize: 15,
                fontWeight: 600,
                color: "#19202E",
                background: "#fff",
                border: "1.5px solid #E0E4ED",
                padding: "14px 24px",
                borderRadius: 12,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 9,
              }}
            >
              ▸ Launch live demo
            </div>
          </div>
          <div style={{ display: "flex", gap: 30, marginTop: 40 }}>
            <Stat value="20,000+" label="SKUs across top brands" />
            <div style={{ width: 1, background: "#EEF0F4" }} />
            <Stat value="~8%" label="avg landed-price saving" />
            <div style={{ width: 1, background: "#EEF0F4" }} />
            <Stat value="30-day" label="credit, built in" />
          </div>
        </div>

        {/* hero product visual */}
        <div style={{ position: "relative", animation: "elumeFadeUp .7s ease .1s" }}>
          <div style={{ background: "#161D2B", borderRadius: 22, padding: 18, boxShadow: "0 30px 70px rgba(20,24,45,.28)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "4px 6px 14px" }}>
              <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#E0612A" }} />
              <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#F0C04A" }} />
              <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#4Fae7d" }} />
              <span style={{ marginLeft: 8, fontSize: 11, color: "#6b748c", fontFamily: MONO }}>app.elume.in/portfolio</span>
            </div>
            <div style={{ background: "#F5F6F9", borderRadius: 14, overflow: "hidden" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 9, padding: 14 }}>
                <MiniKpi label="Committed" value="₹2.42Cr" />
                <MiniKpi label="Credit used" value="43%" />
                <div style={{ background: "#10271C", borderRadius: 11, padding: "11px 12px" }}>
                  <div style={{ fontSize: 9.5, color: "#8fd9b3" }}>Saved YTD</div>
                  <div style={{ fontFamily: GROTESK, fontSize: 17, fontWeight: 600, color: "#fff" }}>₹17.8L</div>
                </div>
              </div>
              <div style={{ padding: "0 14px 14px" }}>
                <div style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 11, overflow: "hidden" }}>
                  {MINI_ROWS.map((m) => (
                    <div
                      key={m.name}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "11px 13px",
                        borderBottom: "1px solid #F5F6F9",
                      }}
                    >
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600 }}>{m.name}</div>
                        <div style={{ fontSize: 10, color: "#8A93A6" }}>{m.loc}</div>
                      </div>
                      <span
                        style={{
                          fontSize: 10.5,
                          fontWeight: 600,
                          padding: "3px 8px",
                          borderRadius: 6,
                          background: m.bg,
                          color: m.fg,
                        }}
                      >
                        {m.tag}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          {/* floating credit chip */}
          <div
            style={{
              position: "absolute",
              bottom: -18,
              left: -26,
              background: "linear-gradient(120deg,#2a1850,#5a2433)",
              borderRadius: 14,
              padding: "14px 18px",
              boxShadow: "0 16px 36px rgba(40,20,60,.3)",
              animation: "elumeFloat 4s ease-in-out infinite",
            }}
          >
            <div style={{ fontSize: 10.5, color: "#ffb98f", fontWeight: 700, letterSpacing: "0.4px" }}>● PO AUTO-RELEASED</div>
            <div style={{ fontFamily: GROTESK, fontSize: 15, fontWeight: 600, color: "#fff", marginTop: 4 }}>Switchgear · ₹8.42L</div>
            <div style={{ fontSize: 11, color: "#cdc6e0", marginTop: 2 }}>30-day credit · ₹0 today</div>
          </div>
        </div>
      </div>

      {/* ===================== BRAND STRIP ===================== */}
      <div style={{ maxWidth: 1200, margin: "36px auto 0", padding: "0 32px" }}>
        <div
          style={{
            textAlign: "center",
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: "1px",
            color: "#A0A7B5",
            textTransform: "uppercase",
            marginBottom: 20,
          }}
        >
          Every brand your sites already specify
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flexWrap: "wrap", gap: "14px 40px" }}>
          {HOME_BRANDS.map((b) => (
            <span key={b} style={{ fontFamily: GROTESK, fontSize: 21, fontWeight: 600, color: "#C2C8D4", letterSpacing: "-0.4px" }}>
              {b}
            </span>
          ))}
        </div>
      </div>

      {/* ===================== CATALOGUE SHOWCASE ===================== */}
      <div id="catalogue" style={{ maxWidth: 1200, margin: "0 auto", padding: "90px 32px 6px" }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24, flexWrap: "wrap", marginBottom: 28 }}>
          <div style={{ maxWidth: 580 }}>
            <div style={{ fontFamily: MONO, fontSize: 12, letterSpacing: "1px", color: "#4E5BDC", textTransform: "uppercase", marginBottom: 14 }}>
              The storefront
            </div>
            <h2 style={{ fontFamily: GROTESK, fontSize: 38, lineHeight: 1.1, letterSpacing: "-1px", margin: "0 0 12px", color: "#161D2B" }}>
              20,000+ SKUs. Every brand, one cart.
            </h2>
            <p style={{ fontSize: 16, lineHeight: 1.6, color: "#56627A", margin: 0, maxWidth: 520 }}>
              From 2.5 mm² wire to BLDC fans and modular switches — browse live stock and transparent pricing across the
              brands your sites already specify.
            </p>
          </div>
          <div
            onClick={() => goApp("catalogue")}
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: "#19202E",
              background: "#fff",
              border: "1.5px solid #E0E4ED",
              padding: "13px 20px",
              borderRadius: 11,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            Browse full catalogue →
          </div>
        </div>
        {/* category chips */}
        <div style={{ display: "flex", gap: 9, flexWrap: "wrap", marginBottom: 22 }}>
          {HOME_CATS.map((label) => {
            const on = catCat === label;
            return (
              <div
                key={label}
                onClick={() => setCatCat(label)}
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  padding: "9px 16px",
                  borderRadius: 20,
                  cursor: "pointer",
                  background: on ? "#161D2B" : "#fff",
                  color: on ? "#fff" : "#56627A",
                  border: `1.5px solid ${on ? "#161D2B" : "#E0E4ED"}`,
                }}
              >
                {label}
              </div>
            );
          })}
        </div>
        {/* product grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
          {showcase.map((p) => {
            const save = Math.round((1 - p.price / p.market) * 100) + "%";
            return (
              <div
                key={p.sku}
                style={{
                  background: "#fff",
                  border: "1px solid #E8EBF1",
                  borderRadius: 16,
                  overflow: "hidden",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <div
                  style={{
                    height: 122,
                    background: p.tile,
                    position: "relative",
                    display: "flex",
                    alignItems: "flex-end",
                    justifyContent: "space-between",
                    padding: 11,
                  }}
                >
                  <span style={{ fontFamily: MONO, fontSize: 9.5, color: "#6b748c", background: "rgba(255,255,255,0.82)", padding: "3px 7px", borderRadius: 6 }}>
                    {p.sku}
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#1F9D63", background: "#fff", padding: "4px 8px", borderRadius: 7 }}>
                    ↓ {save}
                  </span>
                </div>
                <div style={{ padding: "14px 15px 15px", flex: 1, display: "flex", flexDirection: "column" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#1F9D63" }} />
                    <span style={{ fontSize: 11, color: "#8A93A6", fontWeight: 600 }}>{p.brand}</span>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#19202E", lineHeight: 1.3 }}>{p.name}</div>
                  <div style={{ fontFamily: MONO, fontSize: 10.5, color: "#8A93A6", marginTop: 4 }}>{p.spec}</div>
                  <div style={{ marginTop: "auto", paddingTop: 14, display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
                    <div>
                      <div style={{ fontFamily: GROTESK, fontSize: 19, fontWeight: 600, color: "#19202E" }}>{fmt(p.price)}</div>
                      <div style={{ fontSize: 11.5, color: "#A0A7B5", textDecoration: "line-through" }}>{fmt(p.market)} market</div>
                    </div>
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        goApp("catalogue");
                      }}
                      style={{
                        background: "#EEF0FD",
                        color: "#4E5BDC",
                        fontWeight: 700,
                        fontSize: 18,
                        width: 38,
                        height: 38,
                        borderRadius: 10,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                      }}
                    >
                      +
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ===================== PRICING ENGINE ===================== */}
      <div id="pricing" style={{ background: "#F7F8FB", marginTop: 86, borderTop: "1px solid #EEF0F4", borderBottom: "1px solid #EEF0F4" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "80px 32px" }}>
          <div style={{ maxWidth: 620, marginBottom: 40 }}>
            <div style={{ fontFamily: MONO, fontSize: 12, letterSpacing: "1px", color: "#4E5BDC", textTransform: "uppercase", marginBottom: 14 }}>
              Pricing engine
            </div>
            <h2 style={{ fontFamily: GROTESK, fontSize: 38, lineHeight: 1.1, letterSpacing: "-1px", margin: "0 0 12px", color: "#161D2B" }}>
              Know the real price. Every single day.
            </h2>
            <p style={{ fontSize: 16, lineHeight: 1.6, color: "#56627A", margin: 0 }}>
              Elume captures the market price of every SKU daily — a full year of history per product. See where prices
              are heading, and exactly how far below market you&apos;re buying, before you commit a PO.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "290px 1fr", gap: 22, alignItems: "start" }}>
            {/* product selector */}
            <div>
              <div style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: "0.5px", color: "#8A93A6", textTransform: "uppercase", marginBottom: 12 }}>
                Pick a product
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                {Object.keys(HOMECHART).map((id) => {
                  const p = HOMECHART[id];
                  const el = homeElumeSeries(p);
                  const on = chartSku === id;
                  return (
                    <div
                      key={id}
                      onClick={() => setChartSku(id)}
                      style={{
                        border: `1.5px solid ${on ? "#4E5BDC" : "#E8EBF1"}`,
                        background: on ? "#F2F3FB" : "#fff",
                        borderRadius: 12,
                        padding: "12px 14px",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 11, color: "#8A93A6", fontWeight: 600 }}>{p.brand}</div>
                        <div style={{ fontSize: 13.5, fontWeight: 600, color: on ? "#161D2B" : "#19202E" }}>{p.name}</div>
                      </div>
                      <div style={{ textAlign: "right", flex: "none" }}>
                        <div style={{ fontFamily: GROTESK, fontSize: 13.5, fontWeight: 600, color: "#19202E" }}>{fmt(el[11])}</div>
                        <div style={{ fontSize: 11, color: "#1F9D63", fontWeight: 700 }}>
                          ↓ {Math.round((1 - el[11] / p.market[11]) * 100)}%
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div style={{ marginTop: 16, background: "#161D2B", borderRadius: 14, padding: "16px 17px" }}>
                <div style={{ fontSize: 12.5, color: "#fff", fontWeight: 600, marginBottom: 5 }}>Why it matters</div>
                <div style={{ fontSize: 12, color: "#aab2c8", lineHeight: 1.55 }}>
                  Wire tracks copper, DBs track steel. Our engine times your buy and locks savings even as the market
                  swings.
                </div>
              </div>
            </div>

            {/* chart card */}
            <div style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 18, padding: "24px 26px 22px" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 18 }}>
                <div>
                  <div style={{ fontSize: 12, color: "#8A93A6", fontWeight: 600 }}>{chart.brand}</div>
                  <div style={{ fontFamily: GROTESK, fontSize: 20, fontWeight: 600, letterSpacing: "-0.4px", color: "#161D2B" }}>{chart.name}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontFamily: GROTESK, fontSize: 26, fontWeight: 600, letterSpacing: "-0.6px", color: "#161D2B" }}>
                    {chart.cur} <span style={{ fontSize: 13, color: "#8A93A6", fontWeight: 400 }}>{chart.unit}</span>
                  </div>
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 5 }}>
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: "#1F9D63", background: "#E6F5EE", padding: "3px 9px", borderRadius: 7 }}>
                      ↓ {chart.save} below market
                    </span>
                  </div>
                </div>
              </div>
              {/* legend */}
              <div style={{ display: "flex", gap: 18, marginBottom: 6, fontSize: 11.5, color: "#56627A" }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                  <span style={{ width: 16, height: 3, borderRadius: 2, background: "#4E5BDC", display: "inline-block" }} />Elume price
                </span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                  <span style={{ width: 16, height: 0, borderTop: "2px dashed #AEB6C4", display: "inline-block" }} />Market price
                </span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                  <span style={{ width: 14, height: 10, borderRadius: 3, background: "rgba(31,157,99,0.16)", display: "inline-block" }} />Your saving
                </span>
              </div>
              {/* chart */}
              <svg viewBox="0 0 580 230" style={{ width: "100%", height: "auto", display: "block" }}>
                {chart.gridLines.map((g, i) => (
                  <line key={i} x1="0" x2="580" y1={g.y} y2={g.y} style={{ stroke: "#EEF0F4", strokeWidth: "1px" }} />
                ))}
                <path d={chart.bandPath} style={{ fill: "rgba(31,157,99,0.14)", stroke: "none" }} />
                <path d={chart.marketPath} style={{ fill: "none", stroke: "#AEB6C4", strokeWidth: "2px", strokeDasharray: "5 4" }} />
                <path d={chart.elumePath} style={{ fill: "none", stroke: "#4E5BDC", strokeWidth: "2.5px", strokeLinejoin: "round" }} />
                <circle cx={chart.endX} cy={chart.endYm} r="3.5" style={{ fill: "#AEB6C4" }} />
                <circle cx={chart.endX} cy={chart.endYe} r="5" style={{ fill: "#4E5BDC", stroke: "#fff", strokeWidth: "2px" }} />
              </svg>
              {/* month labels */}
              <div style={{ display: "flex", justifyContent: "space-between", fontFamily: MONO, fontSize: 10, color: "#A0A7B5", marginTop: 4, padding: "0 4px" }}>
                <span>Jul &apos;25</span>
                <span>Sep</span>
                <span>Nov</span>
                <span>Jan &apos;26</span>
                <span>Mar</span>
                <span>Jun &apos;26</span>
              </div>
              {/* stats */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginTop: 20, paddingTop: 20, borderTop: "1px solid #F0F2F6" }}>
                <ChartStat label="Elume today" value={chart.cur} />
                <ChartStat label="Market today" value={chart.mkt} valueColor="#56627A" />
                <ChartStat label="12-mo low" value={chart.low} />
                <ChartStat label="12-mo average" value={chart.avg} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ===================== DIFFERENTIATORS (compact strip) ===================== */}
      <div id="why" style={{ maxWidth: 1200, margin: "0 auto", padding: "72px 32px 10px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
          {FEATURES.map((f, i) => (
            <div key={f.title} style={{ display: "flex", alignItems: "flex-start", gap: 13 }}>
              <div
                style={{
                  width: 38,
                  height: 38,
                  flex: "none",
                  borderRadius: 11,
                  background: f.iconBg,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <span style={{ width: 14, height: 14, borderRadius: 4, background: f.iconFg, display: "inline-block" }} />
              </div>
              <div>
                <div style={{ fontFamily: GROTESK, fontSize: 15, fontWeight: 600, color: "#161D2B", letterSpacing: "-0.2px" }}>{f.title}</div>
                <div style={{ fontSize: 12.5, color: "#8A93A6", marginTop: 3 }}>{FEATURE_TAGS[i]}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ===================== HOW IT WORKS ===================== */}
      <div id="how" style={{ background: "#F7F8FB", marginTop: 80, borderTop: "1px solid #EEF0F4", borderBottom: "1px solid #EEF0F4" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "80px 32px" }}>
          <div style={{ textAlign: "center", maxWidth: 580, margin: "0 auto 50px" }}>
            <div style={{ fontFamily: MONO, fontSize: 12, letterSpacing: "1px", color: "#4E5BDC", textTransform: "uppercase", marginBottom: 14 }}>
              How it works
            </div>
            <h2 style={{ fontFamily: GROTESK, fontSize: 38, lineHeight: 1.1, letterSpacing: "-1px", margin: 0, color: "#161D2B" }}>
              Four steps, every site.
            </h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
            {STEPS.map((s) => (
              <div key={s.n} style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 16, padding: "26px 24px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 16 }}>
                  <span
                    style={{
                      fontFamily: GROTESK,
                      fontSize: 13,
                      fontWeight: 700,
                      color: "#fff",
                      background: "#161D2B",
                      width: 28,
                      height: 28,
                      borderRadius: 9,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {s.n}
                  </span>
                  <span style={{ fontFamily: MONO, fontSize: 11, color: "#8A93A6", textTransform: "uppercase", letterSpacing: "0.5px" }}>{s.kicker}</span>
                </div>
                <h3 style={{ fontFamily: GROTESK, fontSize: 18, fontWeight: 600, margin: "0 0 8px", color: "#161D2B" }}>{s.title}</h3>
                <p style={{ fontSize: 13.5, lineHeight: 1.55, margin: 0, color: "#56627A" }}>{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ===================== SAVINGS CALCULATOR ===================== */}
      <div id="calc" style={{ maxWidth: 1200, margin: "0 auto", padding: "88px 32px" }}>
        <div
          style={{
            background: "linear-gradient(135deg, #1b2236 0%, #232c45 100%)",
            borderRadius: 26,
            padding: "52px 56px",
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 56,
            alignItems: "center",
            overflow: "hidden",
            position: "relative",
          }}
        >
          <div>
            <div style={{ fontFamily: MONO, fontSize: 12, letterSpacing: "1px", color: "#8b96f0", textTransform: "uppercase", marginBottom: 14 }}>
              See your number
            </div>
            <h2 style={{ fontFamily: GROTESK, fontSize: 34, lineHeight: 1.1, letterSpacing: "-0.8px", margin: "0 0 14px", color: "#fff" }}>
              What would Elume save you?
            </h2>
            <p style={{ fontSize: 15, lineHeight: 1.6, color: "#aab2c8", margin: "0 0 36px", maxWidth: 400 }}>
              Drag your monthly FMEG procurement spend across all active sites.
            </p>

            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 14 }}>
              <span style={{ fontSize: 13, color: "#aab2c8" }}>Monthly procurement spend</span>
              <span style={{ fontFamily: GROTESK, fontSize: 22, fontWeight: 600, color: "#fff" }}>₹{spendLabel} Cr</span>
            </div>
            <input
              type="range"
              min={0.5}
              max={20}
              step={0.5}
              value={spend}
              onChange={(e) => setSpend(parseFloat(e.target.value))}
              className="elume-range"
            />
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 9, fontFamily: MONO, fontSize: 10.5, color: "#6b748c" }}>
              <span>₹0.5 Cr</span>
              <span>₹20 Cr</span>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: "24px 26px" }}>
              <div style={{ fontSize: 13, color: "#aab2c8", marginBottom: 8 }}>Estimated annual saving · ~8% landed price</div>
              <div style={{ fontFamily: GROTESK, fontSize: 40, fontWeight: 600, color: "#4fd591", letterSpacing: "-1px" }}>₹{fmtCr(annualSave)}</div>
            </div>
            <div style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 16, padding: "24px 26px" }}>
              <div style={{ fontSize: 13, color: "#aab2c8", marginBottom: 8 }}>Working capital freed · 30-day credit</div>
              <div style={{ fontFamily: GROTESK, fontSize: 40, fontWeight: 600, color: "#fff", letterSpacing: "-1px" }}>₹{fmtCr(capitalFreed)}</div>
            </div>
            <div
              onClick={() => setModal("form")}
              style={{ background: "#4E5BDC", color: "#fff", fontWeight: 600, fontSize: 14.5, textAlign: "center", padding: 15, borderRadius: 13, cursor: "pointer" }}
            >
              Get your custom estimate →
            </div>
          </div>
        </div>
      </div>

      {/* ===================== CLOSING CTA ===================== */}
      <div style={{ background: "#161D2B" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "80px 32px", textAlign: "center" }}>
          <h2 style={{ fontFamily: GROTESK, fontSize: 42, lineHeight: 1.08, letterSpacing: "-1.2px", margin: "0 auto 18px", color: "#fff", maxWidth: 640 }}>
            Bring your sites onto Elume.
          </h2>
          <p style={{ fontSize: 16.5, lineHeight: 1.6, color: "#aab2c8", margin: "0 auto 34px", maxWidth: 480 }}>
            We&apos;re onboarding a first cohort of developers across Western UP. Request access and we&apos;ll set up
            your portfolio with a custom savings estimate.
          </p>
          <div style={{ display: "flex", gap: 14, justifyContent: "center" }}>
            <div
              onClick={() => setModal("form")}
              style={{ fontSize: 15, fontWeight: 600, color: "#161D2B", background: "#fff", padding: "15px 28px", borderRadius: 12, cursor: "pointer" }}
            >
              Request access
            </div>
            <div
              onClick={() => goApp()}
              style={{
                fontSize: 15,
                fontWeight: 600,
                color: "#fff",
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.16)",
                padding: "14px 26px",
                borderRadius: 12,
                cursor: "pointer",
              }}
            >
              Explore the demo
            </div>
          </div>
        </div>
      </div>

      {/* ===================== SPACE VERTICAL ===================== */}
      <div style={{ position: "relative", overflow: "hidden", background: "#0b1a2f", color: "#fff" }}>
        <div className="grid-texture" style={{ position: "absolute", inset: 0, pointerEvents: "none" }} />
        <div style={{ position: "relative", maxWidth: 1080, margin: "0 auto", padding: "76px 32px", textAlign: "center" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 11.5, fontWeight: 700, letterSpacing: "0.6px", textTransform: "uppercase", color: "#7aa2f7", marginBottom: 16 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#3b82f6" }} />
            Another Elume Nuvotech vertical
          </div>
          <h2 style={{ fontFamily: GROTESK, fontSize: 38, lineHeight: 1.1, letterSpacing: "-1px", margin: "0 auto 16px", maxWidth: 640 }}>
            We also procure for India&apos;s space-tech.
          </h2>
          <p style={{ fontSize: 16, lineHeight: 1.65, color: "rgba(255,255,255,0.66)", margin: "0 auto 26px", maxWidth: 560 }}>
            Elumenuvo is our procurement partner for India&apos;s space companies — flight-grade parts and
            materials, vendor management, and imports &amp; customs handled end to end, so engineers stay
            on the hardware, not the purchase orders.
          </p>
          <div style={{ display: "flex", gap: 26, justifyContent: "center", flexWrap: "wrap", marginBottom: 32, fontSize: 13.5, color: "rgba(255,255,255,0.78)" }}>
            <span>◦ Source it</span>
            <span>◦ Manage it</span>
            <span>◦ Move it</span>
          </div>
          <button
            onClick={() => router.push("/space")}
            style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 15, fontWeight: 600, color: "#fff", background: "#3b82f6", border: "none", padding: "14px 26px", borderRadius: 12, cursor: "pointer", boxShadow: "0 12px 32px rgba(59,130,246,0.35)" }}
          >
            Visit Elumenuvo Space →
          </button>
        </div>
      </div>

      {/* ===================== FOOTER ===================== */}
      <div style={{ background: "#11151F" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "40px 32px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Mark height={24} />
            <Wordmark height={14} white opacity={0.9} />
          </div>
          <div style={{ fontSize: 12.5, color: "#6b748c" }}>
            Elume Nuvotech Private Limited · Building India&apos;s procurement backbone for FMEG
          </div>
        </div>
      </div>

      {/* ===================== REQUEST ACCESS MODAL ===================== */}
      {modal !== false && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100,
            background: "rgba(20,24,40,0.5)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
            animation: "elumeOverlay .25s ease",
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 22,
              width: "100%",
              maxWidth: 480,
              padding: 36,
              boxShadow: "0 30px 80px rgba(0,0,0,.3)",
              animation: "elumeModalIn .3s ease",
            }}
          >
            {modal === "form" && (
              <div>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                    <Mark height={26} />
                    <Wordmark height={15} />
                  </div>
                  <div onClick={() => setModal(false)} style={{ color: "#C7CEDC", fontSize: 24, cursor: "pointer", lineHeight: 1 }}>
                    ×
                  </div>
                </div>
                <h3 style={{ fontFamily: GROTESK, fontSize: 23, fontWeight: 600, letterSpacing: "-0.5px", margin: "14px 0 6px" }}>Request early access</h3>
                <p style={{ fontSize: 14, color: "#56627A", margin: "0 0 24px", lineHeight: 1.5 }}>
                  Tell us about your sites — we&apos;ll set up a portfolio and a custom savings estimate.
                </p>

                <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
                  <Field label="Full name" value={name} onChange={setName} placeholder="Rohit Malhotra" />
                  <Field label="Company" value={company} onChange={setCompany} placeholder="Meridian Developments" />
                  <Field label="Work email" value={email} onChange={setEmail} placeholder="rohit@meridian.in" />
                  <div>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#56627A", display: "block", marginBottom: 8 }}>Active sites</label>
                    <div style={{ display: "flex", gap: 8 }}>
                      {SITE_VALUES.map((v) => {
                        const on = sites === v;
                        return (
                          <div
                            key={v}
                            onClick={() => setSites(v)}
                            style={{
                              flex: 1,
                              textAlign: "center",
                              fontSize: 13,
                              fontWeight: 600,
                              padding: "10px 0",
                              borderRadius: 10,
                              cursor: "pointer",
                              border: `1.5px solid ${on ? "#4E5BDC" : "#E0E4ED"}`,
                              background: on ? "#F2F3FB" : "#fff",
                              color: on ? "#4E5BDC" : "#56627A",
                            }}
                          >
                            {v}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
                <div
                  onClick={() => setModal("success")}
                  style={{ marginTop: 24, background: "#4E5BDC", color: "#fff", fontWeight: 600, fontSize: 15, textAlign: "center", padding: 15, borderRadius: 12, cursor: "pointer" }}
                >
                  Request access
                </div>
                <p style={{ fontSize: 11.5, color: "#A0A7B5", textAlign: "center", margin: "14px 0 0" }}>
                  No commitment — we&apos;ll reach out within 2 business days.
                </p>
              </div>
            )}
            {modal === "success" && (
              <div style={{ textAlign: "center", padding: "14px 0" }}>
                <div
                  style={{
                    width: 64,
                    height: 64,
                    margin: "0 auto 20px",
                    borderRadius: "50%",
                    background: "#E6F5EE",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <span style={{ color: "#1F9D63", fontSize: 30 }}>✓</span>
                </div>
                <h3 style={{ fontFamily: GROTESK, fontSize: 23, fontWeight: 600, letterSpacing: "-0.5px", margin: "0 0 8px" }}>
                  You&apos;re on the list{name ? `, ${name.split(" ")[0]}` : ""}
                </h3>
                <p style={{ fontSize: 14.5, color: "#56627A", margin: "0 0 26px", lineHeight: 1.55 }}>
                  Our team will reach out within 2 business days to set up your portfolio. Want a head start? Explore the
                  live demo now.
                </p>
                <div
                  onClick={() => goApp()}
                  style={{ display: "inline-block", background: "#4E5BDC", color: "#fff", fontWeight: 600, fontSize: 14.5, padding: "14px 26px", borderRadius: 12, cursor: "pointer" }}
                >
                  Launch live demo →
                </div>
                <div onClick={() => setModal(false)} style={{ marginTop: 14, fontSize: 13.5, color: "#8A93A6", cursor: "pointer" }}>
                  Back to site
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div style={{ fontFamily: GROTESK, fontSize: 26, fontWeight: 600, color: "#161D2B" }}>{value}</div>
      <div style={{ fontSize: 12.5, color: "#8A93A6" }}>{label}</div>
    </div>
  );
}

function MiniKpi({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 11, padding: "11px 12px" }}>
      <div style={{ fontSize: 9.5, color: "#8A93A6" }}>{label}</div>
      <div style={{ fontFamily: GROTESK, fontSize: 17, fontWeight: 600 }}>{value}</div>
    </div>
  );
}

function ChartStat({ label, value, valueColor = "#161D2B" }: { label: string; value: string; valueColor?: string }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: "#8A93A6" }}>{label}</div>
      <div style={{ fontFamily: GROTESK, fontSize: 17, fontWeight: 600, color: valueColor }}>{value}</div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div>
      <label style={{ fontSize: 12, fontWeight: 600, color: "#56627A", display: "block", marginBottom: 6 }}>{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: "100%",
          height: 44,
          border: "1.5px solid #E0E4ED",
          borderRadius: 11,
          padding: "0 14px",
          fontSize: 14,
          fontFamily: "inherit",
          color: "#19202E",
          outline: "none",
        }}
      />
    </div>
  );
}
