"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Mark, Wordmark } from "@/components/Brand";
import ImageSlot from "@/components/ImageSlot";
import { GROTESK, MONO } from "@/lib/fonts";
import { fmt } from "@/lib/format";
import ProductDetail from "@/components/app/ProductDetail";
import { tileFor, type Product } from "@/lib/data";
import { type SiteContent } from "@/lib/content";
import { unitPriceFor, WHOLESALE_MIN_QTY } from "@/lib/pricing";

type Screen = "portfolio" | "catalogue" | "product" | "project" | "smartbom" | "cart" | "confirm";
type CartItem = Product & { qty: number };
type Pay = "now" | "credit";
type BomState = "idle" | "parsing" | "ready";

const NAV_META: { key: Screen; label: string }[] = [
  { key: "portfolio", label: "Portfolio" },
  { key: "catalogue", label: "Catalogue" },
  { key: "smartbom", label: "Smart BOM" },
  { key: "cart", label: "Orders & POs" },
  { key: "project", label: "Projects" },
  { key: "confirm", label: "Deliveries" },
];

const STAGE_COLORS: Record<string, [string, string]> = {
  "Rough-in": ["#F5F6F9", "#56627A"],
  Wiring: ["#EEF0FD", "#4E5BDC"],
  "Panel & DB": ["#EEF0FD", "#4E5BDC"],
  Finishing: ["#E6F5EE", "#1F9D63"],
};
const ACT_COLORS: Record<string, [string, string]> = {
  warn: ["#FBF1E0", "#C5841C"],
  ok: ["#E6F5EE", "#1F9D63"],
  info: ["#EEF0FD", "#4E5BDC"],
  mute: ["#F5F6F9", "#56627A"],
};

type StageVisual = {
  dotBg: string;
  dotBorder: string;
  dotGlow: string;
  fg: string;
  weight: string;
  tagBg: string;
  tagFg: string;
};
const STAGE_KINDS: Record<string, StageVisual> = {
  done: { dotBg: "#1F9D63", dotBorder: "none", dotGlow: "none", fg: "#1F9D63", weight: "600", tagBg: "#E6F5EE", tagFg: "#1F9D63" },
  active: { dotBg: "#4E5BDC", dotBorder: "none", dotGlow: "0 0 0 4px #EEF0FD", fg: "#19202E", weight: "700", tagBg: "#EEF0FD", tagFg: "#4E5BDC" },
  due: { dotBg: "#fff", dotBorder: "2px solid #E0B968", dotGlow: "0 0 0 4px #FBF1E0", fg: "#C5841C", weight: "600", tagBg: "#FBF1E0", tagFg: "#C5841C" },
  next: { dotBg: "#fff", dotBorder: "2px solid #D6DBE6", dotGlow: "none", fg: "#8A93A6", weight: "500", tagBg: "#F5F6F9", tagFg: "#8A93A6" },
};
type TrackVisual = { bg: string; border: string; fg: string; weight: string };
const TRACK_KINDS: Record<string, TrackVisual> = {
  done: { bg: "#1F9D63", border: "none", fg: "#1F9D63", weight: "600" },
  active: { bg: "#4E5BDC", border: "none", fg: "#19202E", weight: "700" },
  next: { bg: "#fff", border: "2px solid #D6DBE6", fg: "#8A93A6", weight: "500" },
};

export default function AppShell({ products, content }: { products: Product[]; content: SiteContent }) {
  const { projects: PROJECTS, stages: STAGES, bomRows: BOM_ROWS, parsedRows: PARSED_ROWS, trackSteps: TRACK_STEPS, categories: CATS, autoPo: AUTOPO } = content;
  const router = useRouter();
  const params = useSearchParams();
  const initial: Screen = params.get("screen") === "catalogue" ? "catalogue" : "portfolio";

  const [screen, setScreen] = useState<Screen>(initial);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [pay, setPay] = useState<Pay>("now");
  const [toast, setToast] = useState("");
  const [order, setOrder] = useState<{ id: string; total: string; pay: string; eta: string } | null>(null);
  const [bomState, setBomState] = useState<BomState>("idle");
  const [cat, setCat] = useState("All");
  const [pd, setPd] = useState<Product | null>(null);
  const [pdQty, setPdQty] = useState(1);

  const contentRef = useRef<HTMLDivElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scrollTop = () => {
    if (contentRef.current) contentRef.current.scrollTop = 0;
  };
  const nav = (s: Screen) => {
    setScreen(s);
    scrollTop();
  };
  const flash = (msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2200);
  };

  const add = (p: Product) => {
    setCart((prev) => {
      const ex = prev.find((i) => i.id === p.id);
      if (ex) return prev.map((i) => (i.id === p.id ? { ...i, qty: i.qty + 1 } : i));
      return [...prev, { ...p, qty: 1 }];
    });
    flash(p.name + " added to PO");
  };
  const setQty = (id: string, d: number) => {
    setCart((prev) =>
      prev
        .map((i) => (i.id === id ? { ...i, qty: i.qty + d } : i))
        .filter((i) => i.qty > 0)
    );
  };
  const remove = (id: string) => setCart((prev) => prev.filter((i) => i.id !== id));

  const openProduct = (p: Product) => {
    setPd(p);
    setPdQty(1);
    setScreen("product");
    scrollTop();
  };
  const addQty = (p: Product, qty: number) => {
    setCart((prev) => {
      const ex = prev.find((i) => i.id === p.id);
      if (ex) return prev.map((i) => (i.id === p.id ? { ...i, qty: i.qty + qty } : i));
      return [...prev, { ...p, qty }];
    });
    flash(qty + "× " + p.name + " added to PO");
  };

  const releaseAutoPO = () => {
    const next = AUTOPO.map((a) => {
      const p = products.find((x) => x.id === a.id)!;
      return { ...p, qty: a.qty };
    });
    setCart(next);
    setScreen("cart");
    setPay("credit");
    scrollTop();
    flash("Auto-PO loaded · review and release");
  };

  const uploadBOQ = () => {
    setBomState("parsing");
    setTimeout(() => setBomState("ready"), 1900);
  };

  const calc = useMemo(() => {
    // Wholesale (−5%) applies per line at 15+ units.
    const sub = cart.reduce((s, i) => s + unitPriceFor(i.price, i.qty) * i.qty, 0);
    const mkt = cart.reduce((s, i) => s + i.market * i.qty, 0);
    const list = cart.reduce((s, i) => s + i.price * i.qty, 0); // pre-wholesale Elume total
    const gst = sub * 0.18;
    return { sub, mkt, list, wholesaleSaved: list - sub, save: mkt - sub, gst, total: sub + gst };
  }, [cart]);

  const placeOrder = () => {
    const payLabel = pay === "credit" ? "Elume Credit · 30 days" : "Pay on delivery";
    setOrder({ id: "ELM-2406-0142", total: fmt(calc.total), pay: payLabel, eta: "Thu, 25 Jun" });
    setCart([]);
    setScreen("confirm");
    scrollTop();
  };

  const titles: Record<Screen, [string, string]> = {
    portfolio: ["Portfolio", "Meridian Developments · 6 active sites"],
    catalogue: ["Catalogue", "Multi-brand FMEG · transparent pricing"],
    project: ["Aurelia Towers", "Project procurement plan"],
    smartbom: ["Smart BOM", "Upload a BOQ — Elume does the rest"],
    cart: ["Purchase order", cart.length + " line items"],
    confirm: ["Order placed", "Delivery tracking"],
    product: [pd ? pd.name : "Product", pd ? pd.brand : ""],
  };
  const [pageTitle, pageSub] = titles[screen];
  const showBack = ["project", "catalogue", "cart", "smartbom", "confirm", "product"].includes(screen);
  const cartCount = cart.reduce((a, i) => a + i.qty, 0);
  const credit = pay === "credit";

  const catProducts = products.filter((p) => cat === "All" || p.cat === cat);

  return (
    <div style={{ height: "100vh", display: "flex", overflow: "hidden", fontFamily: "var(--hanken)", color: "#19202E", background: "#F5F6F9" }}>
      {/* ===================== SIDEBAR ===================== */}
      <div style={{ width: 224, flex: "none", background: "#161D2B", padding: "20px 15px", display: "flex", flexDirection: "column" }}>
        <div onClick={() => router.push("/")} style={{ display: "flex", alignItems: "center", gap: 9, margin: "6px 6px 26px", cursor: "pointer" }}>
          <Mark height={30} />
          <Wordmark height={17} white opacity={0.96} />
        </div>

        {NAV_META.map((n) => {
          const active = n.key === screen;
          return (
            <div
              key={n.key}
              onClick={() => nav(n.key)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 11,
                padding: "9px 11px",
                borderRadius: 9,
                cursor: "pointer",
                fontSize: 13.5,
                marginBottom: 2,
                background: active ? "rgba(110,123,240,0.16)" : "transparent",
                color: active ? "#fff" : "#9aa3b8",
                fontWeight: active ? 600 : 500,
              }}
            >
              <span style={{ width: 7, height: 7, borderRadius: 2, background: active ? "#6E7BF0" : "#3a4357" }} />
              {n.label}
            </div>
          );
        })}

        <div style={{ marginTop: "auto", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: 14 }}>
          <div style={{ fontSize: 11, color: "#9aa3b8", marginBottom: 7 }}>NBFC credit line</div>
          <div style={{ fontFamily: GROTESK, fontSize: 16, color: "#fff", fontWeight: 600 }}>
            ₹52.0L <span style={{ color: "#6b748c", fontSize: 12 }}>/ ₹1.2Cr</span>
          </div>
          <div style={{ height: 5, background: "rgba(255,255,255,0.12)", borderRadius: 3, marginTop: 9, overflow: "hidden" }}>
            <div style={{ width: "43%", height: "100%", background: "linear-gradient(90deg,#5b3aa6,#e0612a)" }} />
          </div>
          <div style={{ fontSize: 10.5, color: "#6b748c", marginTop: 7 }}>₹68.0L available · via Elume NBFC partners</div>
        </div>
      </div>

      {/* ===================== MAIN ===================== */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, background: "#F5F6F9" }}>
        {/* TOPBAR */}
        <div style={{ height: 64, flex: "none", background: "#fff", borderBottom: "1px solid #E8EBF1", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 28px", zIndex: 5 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
            {showBack && (
              <div
                onClick={() => nav(screen === "product" ? "catalogue" : "portfolio")}
                style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", color: "#56627A", fontSize: 13, fontWeight: 600, background: "#F5F6F9", border: "1px solid #E8EBF1", padding: "7px 12px", borderRadius: 8 }}
              >
                ‹ Back
              </div>
            )}
            <div>
              <div style={{ fontFamily: GROTESK, fontSize: 17, fontWeight: 600, color: "#19202E", letterSpacing: "-0.3px" }}>{pageTitle}</div>
              <div style={{ fontSize: 12, color: "#8A93A6", marginTop: 1 }}>{pageSub}</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
              onClick={() => nav("catalogue")}
              style={{ width: 248, height: 38, background: "#F5F6F9", borderRadius: 9, border: "1px solid #E8EBF1", display: "flex", alignItems: "center", padding: "0 13px", fontSize: 12.5, color: "#8A93A6", cursor: "pointer", gap: 8 }}
            >
              <span style={{ width: 13, height: 13, border: "2px solid #b6bdcb", borderRadius: "50%", display: "inline-block" }} />
              Search SKUs, brands, projects…
            </div>
            <div onClick={() => nav("cart")} style={{ position: "relative", width: 38, height: 38, borderRadius: 9, border: "1px solid #E8EBF1", background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ width: 15, height: 13, border: "2px solid #56627A", borderRadius: 3, display: "inline-block" }} />
              {cartCount > 0 && (
                <span style={{ position: "absolute", top: -6, right: -6, minWidth: 18, height: 18, padding: "0 4px", background: "#E0612A", color: "#fff", fontSize: 10.5, fontWeight: 700, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {cartCount}
                </span>
              )}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 9, paddingLeft: 6 }}>
              <div style={{ width: 36, height: 36, borderRadius: "50%", background: "linear-gradient(135deg,#3a2d6b,#E0612A)", color: "#fff", fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center" }}>RM</div>
              <div style={{ lineHeight: 1.2 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: "#19202E" }}>Rohit Malhotra</div>
                <div style={{ fontSize: 11, color: "#8A93A6" }}>Meridian Developments</div>
              </div>
            </div>
          </div>
        </div>

        {/* CONTENT */}
        <div ref={contentRef} style={{ flex: 1, overflowY: "auto", overflowX: "hidden" }}>
          {screen === "portfolio" && <Portfolio projects={PROJECTS} onProject={() => nav("project")} onReleaseAutoPO={releaseAutoPO} />}
          {screen === "catalogue" && <Catalogue products={catProducts} cats={CATS} cat={cat} setCat={setCat} onOpen={openProduct} onAdd={add} />}
          {screen === "product" && pd && <ProductDetail p={pd} qty={pdQty} setQty={setPdQty} onAdd={() => addQty(pd, pdQty)} onCatalogue={() => nav("catalogue")} onProject={() => nav("smartbom")} />}
          {screen === "project" && <ProjectDetail stages={STAGES} bomRows={BOM_ROWS} onReleaseAutoPO={releaseAutoPO} onSmartBom={() => nav("smartbom")} />}
          {screen === "smartbom" && <SmartBom parsedRows={PARSED_ROWS} state={bomState} onUpload={uploadBOQ} onProject={() => nav("project")} />}
          {screen === "cart" && (
            <Cart
              cart={cart}
              calc={calc}
              credit={credit}
              setPay={setPay}
              onCatalogue={() => nav("catalogue")}
              onQty={setQty}
              onRemove={remove}
              onPlace={placeOrder}
            />
          )}
          {screen === "confirm" && order && <Confirmation trackSteps={TRACK_STEPS} order={order} onPortfolio={() => nav("portfolio")} />}
        </div>
      </div>

      {/* TOAST */}
      {toast && (
        <div style={{ position: "fixed", bottom: 26, left: "50%", transform: "translateX(-50%)", background: "#161D2B", color: "#fff", fontSize: 13, fontWeight: 500, padding: "13px 20px", borderRadius: 11, boxShadow: "0 8px 30px rgba(0,0,0,.25)", animation: "elumeToast .3s ease", zIndex: 50, display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#4fd591" }} />
          {toast}
        </div>
      )}
    </div>
  );
}

/* ============================ PORTFOLIO ============================ */
function Portfolio({ projects: PROJECTS, onProject, onReleaseAutoPO }: { projects: SiteContent["projects"]; onProject: () => void; onReleaseAutoPO: () => void }) {
  return (
    <div style={{ padding: "26px 30px", animation: "elumeFade .35s ease" }}>
      {/* KPI ROW */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 15, marginBottom: 18 }}>
        <div style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 14, padding: "17px 18px" }}>
          <div style={{ fontSize: 11.5, color: "#8A93A6", marginBottom: 10 }}>Committed · this quarter</div>
          <div style={{ fontFamily: GROTESK, fontSize: 27, fontWeight: 600, letterSpacing: "-0.6px" }}>
            ₹2.42<span style={{ fontSize: 16, color: "#56627A" }}> Cr</span>
          </div>
          <div style={{ fontSize: 11.5, color: "#1F9D63", marginTop: 6, fontWeight: 600 }}>▲ 12% vs last quarter</div>
        </div>
        <div style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 14, padding: "17px 18px" }}>
          <div style={{ fontSize: 11.5, color: "#8A93A6", marginBottom: 10 }}>Outstanding deliveries</div>
          <div style={{ fontFamily: GROTESK, fontSize: 27, fontWeight: 600, letterSpacing: "-0.6px" }}>
            ₹38.2<span style={{ fontSize: 16, color: "#56627A" }}> L</span>
          </div>
          <div style={{ fontSize: 11.5, color: "#56627A", marginTop: 6 }}>14 POs in transit</div>
        </div>
        <div style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 14, padding: "17px 18px" }}>
          <div style={{ fontSize: 11.5, color: "#8A93A6", marginBottom: 10 }}>Credit utilised</div>
          <div style={{ fontFamily: GROTESK, fontSize: 27, fontWeight: 600, letterSpacing: "-0.6px" }}>
            43<span style={{ fontSize: 16, color: "#56627A" }}>%</span>
          </div>
          <div style={{ height: 5, background: "#EEF0FD", borderRadius: 3, marginTop: 11, overflow: "hidden" }}>
            <div style={{ width: "43%", height: "100%", background: "linear-gradient(90deg,#5b3aa6,#E0612A)" }} />
          </div>
        </div>
        <div style={{ background: "#10271C", border: "1px solid #1a4530", borderRadius: 14, padding: "17px 18px" }}>
          <div style={{ fontSize: 11.5, color: "#8fd9b3", marginBottom: 10 }}>Saved vs MRP · YTD</div>
          <div style={{ fontFamily: GROTESK, fontSize: 27, fontWeight: 600, color: "#fff", letterSpacing: "-0.6px" }}>
            ₹17.8<span style={{ fontSize: 16, color: "#8fd9b3" }}> L</span>
          </div>
          <div style={{ fontSize: 11.5, color: "#4fd591", marginTop: 6, fontWeight: 700 }}>▼ 7.4% avg landed price</div>
        </div>
      </div>

      {/* ACTION STRIP */}
      <div style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 14, padding: "15px 18px", marginBottom: 18, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: "#FBF1E0", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ width: 9, height: 9, borderRadius: 2, background: "#C5841C" }} />
          </div>
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: "#19202E" }}>2 actions need you today</div>
            <div style={{ fontSize: 12, color: "#8A93A6" }}>Auto-PO ready for Aurelia Towers · Smart BOM review for Civic Square Mall</div>
          </div>
        </div>
        <div onClick={onReleaseAutoPO} style={{ background: "#4E5BDC", color: "#fff", fontWeight: 600, fontSize: 13, padding: "10px 17px", borderRadius: 9, cursor: "pointer" }}>
          Review Aurelia PO →
        </div>
      </div>

      {/* ACTIVE PROJECTS TABLE */}
      <div style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 14, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "15px 18px", borderBottom: "1px solid #F0F2F6" }}>
          <span style={{ fontFamily: GROTESK, fontWeight: 600, fontSize: 14.5 }}>
            Active projects <span style={{ color: "#8A93A6", fontWeight: 400 }}>· 6 sites</span>
          </span>
          <span style={{ fontSize: 12.5, color: "#4E5BDC", fontWeight: 600, cursor: "pointer" }}>+ New project</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1.8fr 1fr 1.05fr 1fr 1.35fr 1.3fr", gap: 12, padding: "11px 18px", fontFamily: MONO, fontSize: 10, letterSpacing: "0.5px", color: "#8A93A6", textTransform: "uppercase", borderBottom: "1px solid #F0F2F6" }}>
          <span>Project</span>
          <span>Stage</span>
          <span>Committed</span>
          <span>Delivered</span>
          <span>Credit · cycle</span>
          <span>Next action</span>
        </div>
        {PROJECTS.map((p) => {
          const [stageBg, stageFg] = STAGE_COLORS[p.stage];
          const [actBg, actFg] = ACT_COLORS[p.kind];
          return (
            <div key={p.name} onClick={onProject} style={{ display: "grid", gridTemplateColumns: "1.8fr 1fr 1.05fr 1fr 1.35fr 1.3fr", gap: 12, padding: "15px 18px", alignItems: "center", borderBottom: "1px solid #F5F6F9", cursor: "pointer" }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13.5, color: "#19202E" }}>{p.name}</div>
                <div style={{ fontSize: 11, color: "#8A93A6" }}>{p.loc}</div>
              </div>
              <span>
                <span style={{ display: "inline-block", fontSize: 12, fontWeight: 600, padding: "3px 9px", borderRadius: 6, whiteSpace: "nowrap", background: stageBg, color: stageFg }}>{p.stage}</span>
              </span>
              <span style={{ fontFamily: GROTESK, fontSize: 14 }}>{p.committed}</span>
              <div>
                <div style={{ height: 5, width: 80, background: "#F0F2F6", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ height: "100%", background: "#1F9D63", width: p.pct + "%" }} />
                </div>
                <span style={{ fontSize: 10.5, color: "#8A93A6" }}>{p.pct}%</span>
              </div>
              <span style={{ fontSize: 12.5, color: "#56627A" }}>{p.credit}</span>
              <span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontWeight: 600, fontSize: 11.5, padding: "5px 10px", borderRadius: 7, whiteSpace: "nowrap", background: actBg, color: actFg }}>{p.action}</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ============================ CATALOGUE ============================ */
function Catalogue({
  products,
  cats: CATS,
  cat,
  setCat,
  onOpen,
  onAdd,
}: {
  products: Product[];
  cats: SiteContent["categories"];
  cat: string;
  setCat: (c: string) => void;
  onOpen: (p: Product) => void;
  onAdd: (p: Product) => void;
}) {
  return (
    <div style={{ padding: "24px 30px", animation: "elumeFade .35s ease" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {CATS.map((label) => {
            const active = cat === label;
            return (
              <div key={label} onClick={() => setCat(label)} style={{ fontSize: 12.5, fontWeight: 600, padding: "8px 14px", borderRadius: 20, cursor: "pointer", background: active ? "#19202E" : "#fff", color: active ? "#fff" : "#56627A", border: `1px solid ${active ? "#19202E" : "#E8EBF1"}` }}>
                {label}
              </div>
            );
          })}
        </div>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "#E6F5EE", color: "#1F9D63", fontWeight: 700, fontSize: 12, padding: "7px 13px", borderRadius: 20 }}>
          ▼ Transparent pricing · avg 9% below MRP
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
        {products.map((p) => {
          const save = Math.round((1 - p.price / p.market) * 100) + "%";
          return (
            <div key={p.id} onClick={() => onOpen(p)} style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 14, overflow: "hidden", display: "flex", flexDirection: "column", cursor: "pointer" }}>
              <div style={{ height: 128, position: "relative" }}>
                <ImageSlot id={`img-${p.sku}`} tile={tileFor(p.cat)} />
                <span style={{ position: "absolute", left: 11, bottom: 11, zIndex: 2, pointerEvents: "none", fontFamily: MONO, fontSize: 9.5, color: "#6b748c", background: "rgba(255,255,255,0.88)", padding: "3px 6px", borderRadius: 5 }}>{p.sku}</span>
                <span style={{ position: "absolute", right: 11, bottom: 11, zIndex: 2, pointerEvents: "none", fontSize: 11, fontWeight: 700, color: "#1F9D63", background: "#fff", padding: "4px 8px", borderRadius: 6 }}>↓ {save}</span>
              </div>
              <div style={{ padding: "15px 16px 16px", flex: 1, display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#1F9D63" }} />
                  <span style={{ fontSize: 11, color: "#8A93A6", fontWeight: 600, letterSpacing: "0.2px" }}>{p.brand}</span>
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#19202E", margin: "4px 0 4px", lineHeight: 1.3 }}>{p.name}</div>
                <div style={{ fontFamily: MONO, fontSize: 10.5, color: "#8A93A6", marginBottom: 13 }}>{p.spec}</div>
                <div style={{ marginTop: "auto", display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontFamily: GROTESK, fontSize: 19, fontWeight: 600, color: "#19202E" }}>{fmt(p.price)}</div>
                    <div style={{ fontSize: 11.5, color: "#A0A7B5" }}>MRP <span style={{ textDecoration: "line-through" }}>{fmt(p.market)}</span></div>
                  </div>
                  <div onClick={(e) => { e.stopPropagation(); onAdd(p); }} style={{ background: "#EEF0FD", color: "#4E5BDC", fontWeight: 700, fontSize: 13, width: 38, height: 38, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>+</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}


/* ============================ PROJECT DETAIL ============================ */
function ProjectDetail({ stages: STAGES, bomRows: BOM_ROWS, onReleaseAutoPO, onSmartBom }: { stages: SiteContent["stages"]; bomRows: SiteContent["bomRows"]; onReleaseAutoPO: () => void; onSmartBom: () => void }) {
  return (
    <div style={{ padding: "24px 30px", animation: "elumeFade .35s ease" }}>
      {/* project header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
            <h2 style={{ fontFamily: GROTESK, fontSize: 22, fontWeight: 600, margin: 0, lineHeight: 1.15, letterSpacing: "-0.5px" }}>Aurelia Towers</h2>
            <span style={{ display: "inline-block", fontSize: 12, fontWeight: 600, padding: "4px 10px", borderRadius: 7, whiteSpace: "nowrap", background: "#EEF0FD", color: "#4E5BDC" }}>Wiring stage</span>
          </div>
          <div style={{ fontSize: 13, color: "#8A93A6", marginTop: 4 }}>Noida · Sector 150 · 14 floors · Meridian Developments</div>
        </div>
        <div style={{ display: "flex", gap: 24 }}>
          <HeaderStat label="Committed" value="₹64.0L" />
          <HeaderStat label="Saved" value="₹6.7L" color="#1F9D63" />
          <HeaderStat label="Credit cycle" value="28d left" />
        </div>
      </div>

      {/* phased procurement timeline */}
      <div style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 14, padding: "20px 22px", marginBottom: 18 }}>
        <div style={{ fontFamily: GROTESK, fontWeight: 600, fontSize: 14.5, marginBottom: 4 }}>Phased procurement schedule</div>
        <div style={{ fontSize: 12.5, color: "#8A93A6", marginBottom: 22 }}>POs auto-release as the site reaches each construction stage — you just approve.</div>
        <div style={{ display: "flex", alignItems: "flex-start" }}>
          {STAGES.map((s) => {
            const v = STAGE_KINDS[s.kind];
            return (
              <div key={s.label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", position: "relative" }}>
                <div style={{ display: "flex", alignItems: "center", width: "100%" }}>
                  <div style={{ flex: 1, height: 2, background: s.lineL }} />
                  <div style={{ width: 16, height: 16, borderRadius: "50%", flex: "none", background: v.dotBg, border: v.dotBorder, boxShadow: v.dotGlow }} />
                  <div style={{ flex: 1, height: 2, background: s.lineR }} />
                </div>
                <div style={{ fontSize: 12.5, fontWeight: v.weight as React.CSSProperties["fontWeight"], color: v.fg, marginTop: 10, whiteSpace: "nowrap" }}>{s.label}</div>
                <div style={{ fontFamily: GROTESK, fontSize: 13, color: "#56627A", marginTop: 3 }}>{s.value}</div>
                <div style={{ fontSize: 11, marginTop: 4, color: v.tagFg, background: v.tagBg, padding: "2px 8px", borderRadius: 10 }}>{s.tag}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* auto-PO ready card */}
      <div style={{ background: "linear-gradient(100deg,#1d1240,#3a1d52 55%,#5a2433)", borderRadius: 14, padding: "20px 24px", marginBottom: 18, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "rgba(224,97,42,0.22)", color: "#ffb98f", fontWeight: 700, fontSize: 11, letterSpacing: "0.4px", padding: "5px 11px", borderRadius: 20, marginBottom: 11 }}>● AUTO-PO READY · PANEL STAGE</div>
          <div style={{ fontFamily: GROTESK, fontSize: 19, fontWeight: 600, color: "#fff" }}>Switchgear &amp; DBs · ₹8.42L</div>
          <div style={{ fontSize: 13, color: "#cdc6e0", marginTop: 5 }}>160× RCCBs, 420× MCBs, 120× DBs · Elume saved you ₹1.09L vs MRP on this order.</div>
        </div>
        <div onClick={onReleaseAutoPO} style={{ background: "#fff", color: "#3a1d52", fontWeight: 700, fontSize: 13.5, padding: "13px 22px", borderRadius: 11, cursor: "pointer", whiteSpace: "nowrap" }}>Review &amp; release →</div>
      </div>

      {/* BOM with compatibility flag */}
      <div style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 14, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "15px 18px", borderBottom: "1px solid #F0F2F6" }}>
          <span style={{ fontFamily: GROTESK, fontWeight: 600, fontSize: 14.5 }}>
            Bill of Materials <span style={{ color: "#8A93A6", fontWeight: 400 }}>· 142 line items</span>
          </span>
          <div onClick={onSmartBom} style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12.5, fontWeight: 600, color: "#4E5BDC", background: "#EEF0FD", padding: "7px 13px", borderRadius: 8, cursor: "pointer" }}>✦ Open in Smart BOM</div>
        </div>
        {/* compatibility flag */}
        <div style={{ margin: "16px 18px", background: "#FBF1E0", border: "1px solid #F0E0BE", borderRadius: 11, padding: "14px 16px", display: "flex", alignItems: "flex-start", gap: 12 }}>
          <div style={{ width: 24, height: 24, flex: "none", borderRadius: 7, background: "#C5841C", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13 }}>!</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#8a5a10" }}>Compatibility check · Circuit DB-3</div>
            <div style={{ fontSize: 12.5, color: "#9a7426", marginTop: 2 }}>A 6A MCB is under-rated for the 2.5 mm² wire load on this circuit. Elume suggests a <strong>10A &apos;C&apos;-curve MCB</strong> to stay within BIS limits.</div>
          </div>
          <div style={{ background: "#fff", border: "1px solid #E8D4A8", color: "#8a5a10", fontWeight: 600, fontSize: 12, padding: "8px 13px", borderRadius: 8, cursor: "pointer", whiteSpace: "nowrap" }}>Apply fix</div>
        </div>
        {/* bom rows */}
        {BOM_ROWS.map((r) => (
          <div key={r.sku} style={{ display: "grid", gridTemplateColumns: "2.4fr 1fr 0.7fr 0.9fr", gap: 12, padding: "13px 18px", alignItems: "center", borderTop: "1px solid #F5F6F9" }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{r.name}</div>
              <div style={{ fontFamily: MONO, fontSize: 10.5, color: "#8A93A6" }}>{r.sku} · {r.brand}</div>
            </div>
            <div style={{ fontSize: 12, color: "#56627A" }}>{r.stage}</div>
            <div style={{ fontFamily: GROTESK, fontSize: 13, color: "#56627A" }}>{r.qty}</div>
            <div style={{ fontFamily: GROTESK, fontSize: 13.5, fontWeight: 600, textAlign: "right" }}>{r.total}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function HeaderStat({ label, value, color = "#19202E" }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: "#8A93A6" }}>{label}</div>
      <div style={{ fontFamily: GROTESK, fontSize: 18, fontWeight: 600, color }}>{value}</div>
    </div>
  );
}

/* ============================ SMART BOM ============================ */
function SmartBom({ parsedRows: PARSED_ROWS, state, onUpload, onProject }: { parsedRows: SiteContent["parsedRows"]; state: BomState; onUpload: () => void; onProject: () => void }) {
  return (
    <div style={{ padding: "24px 30px", maxWidth: 1080, animation: "elumeFade .35s ease" }}>
      {state === "idle" && (
        <div>
          <div style={{ fontFamily: GROTESK, fontSize: 20, fontWeight: 600, letterSpacing: "-0.4px" }}>Smart BOM</div>
          <div style={{ fontSize: 13.5, color: "#56627A", margin: "5px 0 24px" }}>Drop in your existing BOQ — any format. Elume normalises every line against the multi-brand catalogue, runs compatibility checks, and prices it transparently.</div>
          <div onClick={onUpload} style={{ background: "#fff", border: "2px dashed #C7CEDC", borderRadius: 16, padding: "60px 30px", textAlign: "center", cursor: "pointer" }}>
            <div style={{ width: 56, height: 56, margin: "0 auto 16px", borderRadius: 14, background: "#EEF0FD", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 24, color: "#4E5BDC" }}>✦</span>
            </div>
            <div style={{ fontSize: 15, fontWeight: 600, color: "#19202E" }}>Upload BOQ · PDF, Excel, or scan</div>
            <div style={{ fontSize: 12.5, color: "#8A93A6", marginTop: 5 }}>Or drag &amp; drop — Aurelia_Towers_BOQ_rev3.xlsx</div>
            <div style={{ display: "inline-block", marginTop: 18, background: "#4E5BDC", color: "#fff", fontWeight: 600, fontSize: 13, padding: "11px 22px", borderRadius: 10 }}>Choose file</div>
          </div>
        </div>
      )}
      {state === "parsing" && (
        <div style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 16, padding: "60px 30px", textAlign: "center" }}>
          <div style={{ width: 40, height: 40, margin: "0 auto 18px", border: "4px solid #EEF0FD", borderTopColor: "#4E5BDC", borderRadius: "50%", animation: "elumeSpin .8s linear infinite" }} />
          <div style={{ fontSize: 15, fontWeight: 600 }}>Parsing Aurelia_Towers_BOQ_rev3.xlsx…</div>
          <div style={{ fontSize: 12.5, color: "#8A93A6", marginTop: 6 }}>Normalising 142 line items · matching catalogue · running compatibility checks</div>
        </div>
      )}
      {state === "ready" && (
        <div style={{ animation: "elumeFade .4s ease" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
            <div>
              <div style={{ fontFamily: GROTESK, fontSize: 20, fontWeight: 600, letterSpacing: "-0.4px" }}>BOQ parsed · 142 items matched</div>
              <div style={{ fontSize: 13, color: "#56627A", marginTop: 4 }}>100% matched to catalogue · 2 compatibility flags · priced ₹4.1L below MRP.</div>
            </div>
            <div onClick={onProject} style={{ background: "#4E5BDC", color: "#fff", fontWeight: 600, fontSize: 13, padding: "11px 18px", borderRadius: 10, cursor: "pointer" }}>Add all to project →</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, marginBottom: 18 }}>
            <div style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 12, padding: "15px 16px" }}>
              <div style={{ fontSize: 11.5, color: "#8A93A6" }}>Lines matched</div>
              <div style={{ fontFamily: GROTESK, fontSize: 22, fontWeight: 600 }}>142 / 142</div>
            </div>
            <div style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 12, padding: "15px 16px" }}>
              <div style={{ fontSize: 11.5, color: "#8A93A6" }}>Compatibility flags</div>
              <div style={{ fontFamily: GROTESK, fontSize: 22, fontWeight: 600, color: "#C5841C" }}>2 to review</div>
            </div>
            <div style={{ background: "#10271C", border: "1px solid #1a4530", borderRadius: 12, padding: "15px 16px" }}>
              <div style={{ fontSize: 11.5, color: "#8fd9b3" }}>Priced below MRP</div>
              <div style={{ fontFamily: GROTESK, fontSize: 22, fontWeight: 600, color: "#fff" }}>₹4.1L</div>
            </div>
          </div>
          <div style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 14, overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1.4fr 2fr 0.8fr 1fr", gap: 12, padding: "12px 18px", fontFamily: MONO, fontSize: 10, letterSpacing: "0.5px", color: "#8A93A6", textTransform: "uppercase", borderBottom: "1px solid #F0F2F6" }}>
              <span>BOQ line (raw)</span>
              <span>Matched SKU</span>
              <span>Qty</span>
              <span>Elume price</span>
            </div>
            {PARSED_ROWS.map((r) => (
              <div key={r.sku} style={{ display: "grid", gridTemplateColumns: "1.4fr 2fr 0.8fr 1fr", gap: 12, padding: "13px 18px", alignItems: "center", borderTop: "1px solid #F5F6F9" }}>
                <div style={{ fontFamily: MONO, fontSize: 11, color: "#8A93A6" }}>{r.raw}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ color: "#1F9D63", fontWeight: 700, fontSize: 13 }}>→</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{r.match}</div>
                    <div style={{ fontFamily: MONO, fontSize: 10, color: "#8A93A6" }}>{r.sku}</div>
                  </div>
                </div>
                <div style={{ fontFamily: GROTESK, fontSize: 13 }}>{r.qty}</div>
                <div style={{ fontFamily: GROTESK, fontSize: 13.5, fontWeight: 600 }}>{r.price}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================ CART ============================ */
function Cart({
  cart,
  calc,
  credit,
  setPay,
  onCatalogue,
  onQty,
  onRemove,
  onPlace,
}: {
  cart: CartItem[];
  calc: { sub: number; mkt: number; list: number; wholesaleSaved: number; save: number; gst: number; total: number };
  credit: boolean;
  setPay: (p: Pay) => void;
  onCatalogue: () => void;
  onQty: (id: string, d: number) => void;
  onRemove: (id: string) => void;
  onPlace: () => void;
}) {
  const sel = (on: boolean) => ({ bd: on ? "#4E5BDC" : "#E8EBF1", bg: on ? "#F7F8FF" : "#fff", dot: on ? "#4E5BDC" : "#C7CEDC", fill: on ? "#4E5BDC" : "transparent" });
  const pn = sel(!credit);
  const cr = sel(credit);

  if (cart.length === 0) {
    return (
      <div style={{ padding: "24px 30px", animation: "elumeFade .35s ease" }}>
        <div style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 16, padding: "70px 30px", textAlign: "center" }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: "#19202E" }}>No items in this purchase order yet</div>
          <div style={{ fontSize: 13, color: "#8A93A6", margin: "6px 0 18px" }}>Browse the catalogue or release an auto-PO from a project.</div>
          <div onClick={onCatalogue} style={{ display: "inline-block", background: "#4E5BDC", color: "#fff", fontWeight: 600, fontSize: 13, padding: "11px 20px", borderRadius: 10, cursor: "pointer" }}>Browse catalogue</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "24px 30px", animation: "elumeFade .35s ease" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 20, alignItems: "start" }}>
        {/* line items */}
        <div style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 14, overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid #F0F2F6" }}>
            <div style={{ fontFamily: GROTESK, fontWeight: 600, fontSize: 15 }}>Purchase order · {cart.length} items</div>
            <div style={{ fontSize: 12.5, color: "#8A93A6", marginTop: 2 }}>Delivering to Aurelia Towers · Noida Sec 150</div>
          </div>
          {cart.map((it) => (
            <div key={it.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "15px 20px", borderBottom: "1px solid #F5F6F9" }}>
              <div style={{ width: 52, height: 52, flex: "none", borderRadius: 10, background: "repeating-linear-gradient(135deg,#F3F4F8,#F3F4F8 7px,#EDEFF4 7px,#EDEFF4 14px)" }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, color: "#8A93A6", fontWeight: 600 }}>{it.brand}</div>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: "#19202E" }}>{it.name}</div>
                <div style={{ fontFamily: MONO, fontSize: 10.5, color: "#8A93A6" }}>
                  {it.sku} · {fmt(unitPriceFor(it.price, it.qty))} each
                  {it.qty >= WHOLESALE_MIN_QTY && (
                    <span style={{ fontFamily: GROTESK, color: "#1F9D63", fontWeight: 700, marginLeft: 6 }}>· wholesale</span>
                  )}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 0, border: "1px solid #E8EBF1", borderRadius: 9, overflow: "hidden" }}>
                <div onClick={() => onQty(it.id, -1)} style={{ width: 30, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#56627A", fontSize: 16 }}>−</div>
                <div style={{ width: 44, textAlign: "center", fontFamily: GROTESK, fontSize: 13.5, fontWeight: 600 }}>{it.qty}</div>
                <div onClick={() => onQty(it.id, 1)} style={{ width: 30, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#56627A", fontSize: 16 }}>+</div>
              </div>
              <div style={{ width: 96, textAlign: "right" }}>
                <div style={{ fontFamily: GROTESK, fontSize: 14, fontWeight: 600 }}>{fmt(unitPriceFor(it.price, it.qty) * it.qty)}</div>
                <div style={{ fontSize: 11, color: "#1F9D63", fontWeight: 600 }}>save {fmt((it.market - unitPriceFor(it.price, it.qty)) * it.qty)}</div>
              </div>
              <div onClick={() => onRemove(it.id)} style={{ color: "#C7CEDC", cursor: "pointer", fontSize: 18, width: 20, textAlign: "center" }}>×</div>
            </div>
          ))}
          <div onClick={onCatalogue} style={{ padding: "14px 20px", fontSize: 12.5, fontWeight: 600, color: "#4E5BDC", cursor: "pointer" }}>+ Add more from catalogue</div>
        </div>

        {/* summary + credit */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16, position: "sticky", top: 0 }}>
          <div style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 14, padding: "18px 20px" }}>
            <div style={{ fontFamily: GROTESK, fontWeight: 600, fontSize: 14.5, marginBottom: 14 }}>Order summary</div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#56627A", marginBottom: 9 }}>
              <span>Subtotal</span>
              <span style={{ fontFamily: GROTESK, color: "#19202E" }}>{fmt(calc.sub)}</span>
            </div>
            {calc.wholesaleSaved > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#56627A", marginBottom: 9 }}>
                <span>Wholesale discount <span style={{ fontSize: 11, color: "#8A93A6" }}>(15+ units)</span></span>
                <span style={{ fontFamily: GROTESK, color: "#1F9D63", fontWeight: 600 }}>−{fmt(calc.wholesaleSaved)}</span>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#56627A", marginBottom: 9 }}>
              <span>GST (18%)</span>
              <span style={{ fontFamily: GROTESK, color: "#19202E" }}>{fmt(calc.gst)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#56627A", marginBottom: 9 }}>
              <span>Delivery · Noida</span>
              <span style={{ color: "#1F9D63", fontWeight: 600 }}>Free</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#E6F5EE", borderRadius: 9, padding: "10px 12px", margin: "13px 0" }}>
              <span style={{ fontSize: 12.5, color: "#137a4b", fontWeight: 600 }}>You save vs MRP</span>
              <span style={{ fontFamily: GROTESK, fontSize: 15, fontWeight: 700, color: "#1F9D63" }}>{fmt(calc.save)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderTop: "1px solid #F0F2F6", paddingTop: 13 }}>
              <span style={{ fontWeight: 600, fontSize: 14 }}>Total</span>
              <span style={{ fontFamily: GROTESK, fontSize: 22, fontWeight: 700 }}>{fmt(calc.total)}</span>
            </div>
          </div>

          {/* payment / credit */}
          <div style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 14, padding: "18px 20px" }}>
            <div style={{ fontFamily: GROTESK, fontWeight: 600, fontSize: 14.5, marginBottom: 13 }}>Payment</div>
            <div onClick={() => setPay("now")} style={{ display: "flex", alignItems: "center", gap: 11, border: `1.5px solid ${pn.bd}`, background: pn.bg, borderRadius: 11, padding: 13, marginBottom: 10, cursor: "pointer" }}>
              <div style={{ width: 18, height: 18, borderRadius: "50%", border: `2px solid ${pn.dot}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: pn.fill }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>Pay on delivery</div>
                <div style={{ fontSize: 11.5, color: "#8A93A6" }}>Settle the full amount when goods arrive</div>
              </div>
            </div>
            <div onClick={() => setPay("credit")} style={{ border: `1.5px solid ${cr.bd}`, background: cr.bg, borderRadius: 11, padding: 13, cursor: "pointer" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                <div style={{ width: 18, height: 18, borderRadius: "50%", border: `2px solid ${cr.dot}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: cr.fill }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>
                    Elume Credit · 30 days <span style={{ fontSize: 10, color: "#4E5BDC", background: "#EEF0FD", padding: "2px 7px", borderRadius: 10, marginLeft: 4 }}>NBFC partner</span>
                  </div>
                  <div style={{ fontSize: 11.5, color: "#8A93A6" }}>Pre-approved · pay nothing today</div>
                </div>
              </div>
              {credit && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px dashed #E0E4ED", fontSize: 12, color: "#56627A", lineHeight: 1.6 }}>
                  Due Thu, 25 Jul · 0% for 30 days, then 1.5%/mo. Funded by Elume&apos;s NBFC partner — approval powered by your on-platform repayment history.
                </div>
              )}
            </div>
          </div>

          <div onClick={onPlace} style={{ background: "#4E5BDC", color: "#fff", fontWeight: 700, fontSize: 14.5, textAlign: "center", padding: 15, borderRadius: 12, cursor: "pointer" }}>
            {credit ? "Place order on 30-day credit" : "Place order · " + fmt(calc.total)}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================ CONFIRMATION ============================ */
function Confirmation({ trackSteps: TRACK_STEPS, order, onPortfolio }: { trackSteps: SiteContent["trackSteps"]; order: { id: string; total: string; pay: string; eta: string }; onPortfolio: () => void }) {
  return (
    <div style={{ padding: "34px 30px", maxWidth: 760, margin: "0 auto", animation: "elumeFade .4s ease" }}>
      <div style={{ textAlign: "center", marginBottom: 26 }}>
        <div style={{ width: 64, height: 64, margin: "0 auto 16px", borderRadius: "50%", background: "#E6F5EE", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ color: "#1F9D63", fontSize: 30 }}>✓</span>
        </div>
        <div style={{ fontFamily: GROTESK, fontSize: 24, fontWeight: 600, letterSpacing: "-0.5px" }}>Purchase order placed</div>
        <div style={{ fontSize: 13.5, color: "#56627A", marginTop: 6 }}>{order.id} · {order.total} · {order.pay}</div>
      </div>
      <div style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 14, padding: "22px 24px", marginBottom: 16 }}>
        <div style={{ fontFamily: GROTESK, fontWeight: 600, fontSize: 14.5, marginBottom: 20 }}>Delivery tracking · ETA {order.eta}</div>
        <div style={{ display: "flex", alignItems: "flex-start" }}>
          {TRACK_STEPS.map((t) => {
            const v = TRACK_KINDS[t.kind];
            return (
              <div key={t.label} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
                <div style={{ display: "flex", alignItems: "center", width: "100%" }}>
                  <div style={{ flex: 1, height: 2, background: t.lineL }} />
                  <div style={{ width: 14, height: 14, borderRadius: "50%", flex: "none", background: v.bg, border: v.border }} />
                  <div style={{ flex: 1, height: 2, background: t.lineR }} />
                </div>
                <div style={{ fontSize: 12, fontWeight: v.weight as React.CSSProperties["fontWeight"], color: v.fg, marginTop: 9 }}>{t.label}</div>
                <div style={{ fontSize: 11, color: "#8A93A6", marginTop: 2 }}>{t.sub}</div>
              </div>
            );
          })}
        </div>
      </div>
      <div style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 14, padding: "18px 24px", marginBottom: 22, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 12, color: "#8A93A6" }}>Delivering to</div>
          <div style={{ fontSize: 13.5, fontWeight: 600 }}>Aurelia Towers · Noida Sector 150</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 12, color: "#8A93A6" }}>Payment</div>
          <div style={{ fontSize: 13.5, fontWeight: 600 }}>{order.pay}</div>
        </div>
      </div>
      <div style={{ textAlign: "center" }}>
        <div onClick={onPortfolio} style={{ display: "inline-block", background: "#4E5BDC", color: "#fff", fontWeight: 600, fontSize: 13.5, padding: "13px 26px", borderRadius: 11, cursor: "pointer" }}>Back to portfolio</div>
      </div>
    </div>
  );
}
