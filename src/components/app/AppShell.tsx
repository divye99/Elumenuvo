"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Mark, Wordmark } from "@/components/Brand";
import ImageSlot from "@/components/ImageSlot";
import { GROTESK, MONO } from "@/lib/fonts";
import { fmt } from "@/lib/format";
import ProductDetail from "@/components/app/ProductDetail";
import { tileFor, type Product } from "@/lib/data";
import { type SiteContent } from "@/lib/content";
import { type LiveWorkspace } from "@/lib/workspace";
import { createAppProject, deleteAppProject } from "@/lib/workspace-actions";
import { updatePersonalDetails, upgradeToBusiness } from "@/lib/profile-actions";
import { searchTokens, matchesAll } from "@/lib/search-normalize";
import { unitPriceFor, WHOLESALE_MIN_QTY, exGst, baseExGst } from "@/lib/pricing";

type Screen = "portfolio" | "catalogue" | "product" | "project" | "smartbom" | "cart" | "confirm" | "account";
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

export default function AppShell({ products, content, user, live }: { products: Product[]; content: SiteContent; user?: { email: string; name?: string; org?: string; accountType?: "business" | "individual"; gstin?: string }; live?: LiveWorkspace }) {
  const { projects: PROJECTS, stages: STAGES, bomRows: BOM_ROWS, parsedRows: PARSED_ROWS, trackSteps: TRACK_STEPS, categories: CATS, autoPo: AUTOPO } = content;
  const userEmail = user?.email ?? "";
  const isBusiness = user?.accountType === "business";
  const userInitials = (user?.name || userEmail || "U").slice(0, 2).toUpperCase();
  const userName = user?.name || (userEmail ? userEmail.split("@")[0] : "Guest");
  const userOrg = user?.org || (isBusiness ? "Business account" : "Individual account");
  // Live accounts (real users) get the real screens: Overview, Catalogue,
  // Cart and Orders. The Smart BOM / Projects demo screens and "PO" language
  // stay demo-only until those features actually exist.
  const NAV = live
    ? ([
        { key: "portfolio", label: "Overview" },
        { key: "catalogue", label: "Catalogue" },
        { key: "cart", label: "Cart" },
        { key: "confirm", label: "Orders" },
      ] as { key: Screen; label: string }[])
    : isBusiness ? NAV_META : NAV_META.filter((n) => !["smartbom", "project"].includes(n.key));
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
  const [topQ, setTopQ] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [acctSection, setAcctSection] = useState<"personal" | "business">("personal");

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
    flash(p.name + (live ? " added to cart" : " added to PO"));
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
    flash(qty + "× " + p.name + (live ? " added to cart" : " added to PO"));
  };

  const releaseAutoPO = () => {
    const next = AUTOPO.map((a) => {
      const p = products.find((x) => x.id === a.id)!;
      return { ...p, qty: a.qty };
    });
    setCart(next);
    setScreen("cart");
    setPay("now"); // credit is waitlist-only until the NBFC feature ships
    scrollTop();
    flash("Auto-PO loaded · review and release");
  };

  const uploadBOQ = () => {
    setBomState("parsing");
    setTimeout(() => setBomState("ready"), 1900);
  };

  const calc = useMemo(() => {
    // Wholesale (−5%) applies per line at 15+ units. All prices are
    // GST-INCLUSIVE: the payable total = subtotal; GST billing merely splits
    // out the tax contained in it (taxable value + GST = total).
    const sub = cart.reduce((s, i) => s + unitPriceFor(i.price, i.qty) * i.qty, 0);
    const mkt = cart.reduce((s, i) => s + i.market * i.qty, 0);
    const list = cart.reduce((s, i) => s + i.price * i.qty, 0); // pre-wholesale Elume total
    // Per-category GST split (Lighting 12%, Pumps/EV 5%, rest 18%) — matches
    // the storefront cart and the eventual invoice.
    const taxable = cart.reduce((s, i) => s + baseExGst(unitPriceFor(i.price, i.qty), i.cat) * i.qty, 0);
    const gst = sub - taxable;
    return { sub, mkt, list, wholesaleSaved: list - sub, save: mkt - sub, taxable, gst, total: sub };
  }, [cart]);

  const placeOrder = () => {
    if (live) {
      // Live accounts check out for real: merge the PO lines into the
      // storefront cart (same localStorage store) and go to payment.
      try {
        const KEY = "elume.cart";
        const existing: any[] = JSON.parse(localStorage.getItem(KEY) || "[]");
        for (const i of cart) {
          const hit = existing.find((x) => x.id === i.id);
          if (hit) hit.qty += i.qty;
          else existing.push({ id: i.id, name: i.name, brand: i.brand, price: i.price, mrp: i.market, unit: i.unit, cat: i.cat, image: i.image, qty: i.qty });
        }
        localStorage.setItem(KEY, JSON.stringify(existing));
      } catch { /* checkout page will show an empty cart at worst */ }
      router.push("/checkout");
      return;
    }
    const payLabel = pay === "credit" ? "Elume Credit · 30 days" : "Pay on delivery";
    setOrder({ id: "ELM-2406-0142", total: fmt(calc.total), pay: payLabel, eta: "Thu, 25 Jun" });
    setCart([]);
    setScreen("confirm");
    scrollTop();
  };

  const titles: Record<Screen, [string, string]> = {
    portfolio: ["Portfolio", live ? `${userOrg} · ${live.projects.length} project${live.projects.length === 1 ? "" : "s"}` : "Meridian Developments · 6 active sites"],
    catalogue: ["Catalogue", "Multi-brand FMEG · transparent pricing"],
    project: ["Aurelia Towers", "Project procurement plan"],
    smartbom: ["Smart BOM", "Upload a BOQ — Elume does the rest"],
    cart: [live ? "Cart" : "Purchase order", cart.length + " line item" + (cart.length === 1 ? "" : "s")],
    confirm: live ? ["Orders", "Every order with live tracking"] : ["Order placed", "Delivery tracking"],
    product: [pd ? pd.name : "Product", pd ? pd.brand : ""],
    account: ["Your account", userEmail],
  };
  const [pageTitle, pageSub] = titles[screen];
  const showBack = ["project", "catalogue", "cart", "smartbom", "confirm", "product", "account"].includes(screen);
  const cartCount = cart.reduce((a, i) => a + i.qty, 0);
  const credit = pay === "credit";

  const searchTokensMemo = useMemo(() => searchTokens(topQ), [topQ]);
  const catProducts = products.filter((p) =>
    (cat === "All" || p.cat === cat) &&
    (searchTokensMemo.length === 0 || matchesAll(`${p.brand} ${p.name} ${p.spec} ${p.sku} ${p.cat}`, searchTokensMemo))
  );

  return (
    <div style={{ height: "100vh", display: "flex", overflow: "hidden", fontFamily: "var(--hanken)", color: "#19202E", background: "#F5F6F9" }}>
      {/* ===================== SIDEBAR ===================== */}
      <div style={{ width: 224, flex: "none", background: "#161D2B", padding: "20px 15px", display: "flex", flexDirection: "column" }}>
        <div onClick={() => router.push("/")} style={{ display: "flex", alignItems: "center", gap: 9, margin: "6px 6px 26px", cursor: "pointer" }}>
          <Mark height={30} />
          <Wordmark height={17} white opacity={0.96} />
        </div>

        {NAV.map((n) => {
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

        <a href="/credit" style={{ display: "block", marginTop: "auto", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 12, padding: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 7 }}>
            <span style={{ fontSize: 11, color: "#9aa3b8" }}>NBFC credit line</span>
            <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "0.5px", color: "#9DB0FF", background: "rgba(110,123,240,0.16)", padding: "2px 7px", borderRadius: 8, textTransform: "uppercase" }}>Coming soon</span>
          </div>
          <div style={{ fontFamily: GROTESK, fontSize: 14.5, color: "#fff", fontWeight: 600, lineHeight: 1.35 }}>
            30-day purchase credit with NBFC partners.
          </div>
          <div style={{ fontSize: 10.5, color: "#9DB0FF", marginTop: 8, fontWeight: 600 }}>Join the waitlist →</div>
        </a>
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
            <div style={{ position: "relative", width: 264, height: 38, background: "#F5F6F9", borderRadius: 9, border: "1px solid #E8EBF1", display: "flex", alignItems: "center", padding: "0 11px", gap: 8 }}>
              <span style={{ width: 13, height: 13, flex: "none", border: "2px solid #b6bdcb", borderRadius: "50%", display: "inline-block" }} />
              <input
                value={topQ}
                onChange={(e) => { setTopQ(e.target.value); if (screen !== "catalogue" && e.target.value.trim()) nav("catalogue"); }}
                onFocus={() => { if (screen !== "catalogue" && topQ.trim()) nav("catalogue"); }}
                placeholder="Search the catalogue…"
                style={{ border: "none", outline: "none", background: "transparent", fontSize: 12.5, color: "#19202E", width: "100%" }}
              />
              {topQ && (
                <span onClick={() => setTopQ("")} style={{ cursor: "pointer", color: "#8A93A6", fontSize: 14, lineHeight: 1 }}>×</span>
              )}
            </div>
            <div onClick={() => nav("cart")} style={{ position: "relative", width: 38, height: 38, borderRadius: 9, border: "1px solid #E8EBF1", background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ width: 15, height: 13, border: "2px solid #56627A", borderRadius: 3, display: "inline-block" }} />
              {cartCount > 0 && (
                <span style={{ position: "absolute", top: -6, right: -6, minWidth: 18, height: 18, padding: "0 4px", background: "#E0612A", color: "#fff", fontSize: 10.5, fontWeight: 700, borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {cartCount}
                </span>
              )}
            </div>
            <div style={{ position: "relative", paddingLeft: 6 }}>
              <div onClick={() => setMenuOpen((o) => !o)} style={{ display: "flex", alignItems: "center", gap: 9, cursor: "pointer", userSelect: "none" }}>
                <div style={{ width: 36, height: 36, borderRadius: "50%", background: "linear-gradient(135deg,#3a2d6b,#E0612A)", color: "#fff", fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center" }}>{userInitials}</div>
                <div style={{ lineHeight: 1.2 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: "#19202E" }}>{userName}</div>
                  <div style={{ fontSize: 11, color: "#8A93A6" }}>{userOrg}</div>
                </div>
                <span style={{ color: "#8A93A6", fontSize: 10, transform: menuOpen ? "rotate(180deg)" : "none", transition: "transform .15s" }}>▼</span>
              </div>
              {menuOpen && (
                <>
                  <div onClick={() => setMenuOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 40 }} />
                  <div style={{ position: "absolute", top: "calc(100% + 10px)", right: 0, zIndex: 50, width: 230, background: "#fff", border: "1px solid #E0E4ED", borderRadius: 12, boxShadow: "0 16px 40px rgba(20,24,45,.14)", overflow: "hidden", padding: "6px 0" }}>
                    {([
                      ["Account details", () => { setAcctSection("business"); nav("account"); }],
                      ["Personal details", () => { setAcctSection("personal"); nav("account"); }],
                      ...(!isBusiness ? [["Switch to Business account", () => { setAcctSection("business"); nav("account"); }] as [string, () => void]] : []),
                    ] as [string, () => void][]).map(([label, fn]) => (
                      <div key={label} onClick={() => { setMenuOpen(false); fn(); }} style={{ padding: "10px 16px", fontSize: 13, fontWeight: 600, color: "#19202E", cursor: "pointer" }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "#F5F6F9")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "#fff")}
                      >{label}</div>
                    ))}
                    {userEmail && (
                      <form action="/auth/signout" method="post" style={{ borderTop: "1px solid #F0F2F6", marginTop: 4, paddingTop: 4 }}>
                        <button style={{ width: "100%", textAlign: "left", padding: "10px 16px", fontSize: 13, fontWeight: 600, color: "#B43A16", background: "none", border: "none", cursor: "pointer" }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = "#FBF1EC")}
                          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                        >Sign out</button>
                      </form>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* CONTENT */}
        <div ref={contentRef} style={{ flex: 1, overflowY: "auto", overflowX: "hidden" }}>
          {screen === "portfolio" && (live
            ? <LivePortfolio live={live} onCatalogue={() => nav("catalogue")} />
            : <Portfolio projects={PROJECTS} onProject={() => nav("project")} onReleaseAutoPO={releaseAutoPO} />)}
          {screen === "catalogue" && <Catalogue products={catProducts} cats={CATS} cat={cat} setCat={setCat} onOpen={openProduct} onAdd={add} q={topQ} onClearQ={() => setTopQ("")} allowUpload={!live} />}
          {screen === "product" && pd && <ProductDetail p={pd} qty={pdQty} setQty={setPdQty} onAdd={() => addQty(pd, pdQty)} onCatalogue={() => nav("catalogue")} onProject={live ? undefined : () => nav("smartbom")} showGst={isBusiness} />}
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
              business={isBusiness}
              liveMode={!!live}
              gstinDefault={user?.gstin ?? ""}
            />
          )}
          {screen === "confirm" && (live
            ? <LiveOrders live={live} onCatalogue={() => nav("catalogue")} />
            : order && <Confirmation trackSteps={TRACK_STEPS} order={order} onPortfolio={() => nav("portfolio")} />)}
          {screen === "account" && user && (
            <AccountScreen
              user={user}
              section={acctSection}
            />
          )}
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
  q = "",
  onClearQ,
  allowUpload = true,
}: {
  products: Product[];
  cats: SiteContent["categories"];
  cat: string;
  setCat: (c: string) => void;
  onOpen: (p: Product) => void;
  onAdd: (p: Product) => void;
  q?: string;
  onClearQ?: () => void;
  allowUpload?: boolean;
}) {
  const [shown, setShown] = useState(48);
  useEffect(() => { setShown(48); }, [q, cat]);
  return (
    <div style={{ padding: "24px 30px", animation: "elumeFade .35s ease" }}>
      {q.trim() && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, fontSize: 13.5 }}>
          <span style={{ color: "#56627A" }}>
            <b style={{ color: "#19202E" }}>{products.length}</b> result{products.length === 1 ? "" : "s"} for &ldquo;{q.trim()}&rdquo;
          </span>
          {onClearQ && <span onClick={onClearQ} style={{ color: "#4E5BDC", fontWeight: 700, cursor: "pointer" }}>Clear search</span>}
        </div>
      )}
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

      {products.length === 0 && (
        <div style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 14, padding: "44px 20px", textAlign: "center", color: "#8A93A6", fontSize: 14 }}>
          Nothing matches{q.trim() ? ` “${q.trim()}”` : ""} in {cat === "All" ? "the catalogue" : cat}. Try fewer words.
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
        {products.slice(0, shown).map((p) => {
          const save = Math.round((1 - p.price / p.market) * 100) + "%";
          return (
            <div key={p.id} onClick={() => onOpen(p)} style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 14, overflow: "hidden", display: "flex", flexDirection: "column", cursor: "pointer" }}>
              <div style={{ height: 128, position: "relative" }}>
                <ImageSlot id={`img-${p.sku}`} tile={tileFor(p.cat)} imageUrl={p.image} allowUpload={allowUpload} />
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
      {products.length > shown && (
        <div style={{ textAlign: "center", marginTop: 22 }}>
          <button onClick={() => setShown((n) => n + 48)} style={{ background: "#fff", border: "1px solid #E0E4ED", borderRadius: 10, padding: "10px 24px", fontSize: 13, fontWeight: 700, color: "#19202E", cursor: "pointer" }}>
            Show more · {products.length - shown} left
          </button>
        </div>
      )}
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
  business = false,
  gstinDefault = "",
  liveMode = false,
}: {
  cart: CartItem[];
  calc: { sub: number; mkt: number; list: number; wholesaleSaved: number; save: number; taxable: number; gst: number; total: number };
  credit: boolean;
  setPay: (p: Pay) => void;
  onCatalogue: () => void;
  onQty: (id: string, d: number) => void;
  onRemove: (id: string) => void;
  onPlace: () => void;
  business?: boolean;
  gstinDefault?: string;
  liveMode?: boolean;
}) {
  const sel = (on: boolean) => ({ bd: on ? "#4E5BDC" : "#E8EBF1", bg: on ? "#F7F8FF" : "#fff", dot: on ? "#4E5BDC" : "#C7CEDC", fill: on ? "#4E5BDC" : "transparent" });
  const pn = sel(!credit);
  // GST billing: split the GST-inclusive total into taxable value + tax on the
  // invoice. Business accounts get it on by default with their GSTIN prefilled.
  const [gstBilling, setGstBilling] = useState(business);
  const [gstin, setGstin] = useState(gstinDefault);

  if (cart.length === 0) {
    return (
      <div style={{ padding: "24px 30px", animation: "elumeFade .35s ease" }}>
        <div style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 16, padding: "70px 30px", textAlign: "center" }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: "#19202E" }}>{liveMode ? "Your cart is empty" : "No items in this purchase order yet"}</div>
          <div style={{ fontSize: 13, color: "#8A93A6", margin: "6px 0 18px" }}>{liveMode ? "Add products from the catalogue; wholesale pricing kicks in at 15+ units." : "Browse the catalogue or release an auto-PO from a project."}</div>
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
              <span>Subtotal <span style={{ fontSize: 11, color: "#8A93A6" }}>(incl. GST)</span></span>
              <span style={{ fontFamily: GROTESK, color: "#19202E" }}>{fmt(calc.list)}</span>
            </div>
            {calc.wholesaleSaved > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#56627A", marginBottom: 9 }}>
                <span>Wholesale discount <span style={{ fontSize: 11, color: "#8A93A6" }}>(15+ units)</span></span>
                <span style={{ fontFamily: GROTESK, color: "#1F9D63", fontWeight: 600 }}>−{fmt(calc.wholesaleSaved)}</span>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "#56627A", marginBottom: 9 }}>
              <span>Delivery · Noida</span>
              <span style={{ color: "#1F9D63", fontWeight: 600 }}>Free</span>
            </div>

            {/* GST billing toggle — splits tax out on the invoice */}
            <div style={{ border: `1.5px solid ${gstBilling ? "#C9CFF6" : "#EEF0F4"}`, background: gstBilling ? "#F7F8FF" : "#FAFBFD", borderRadius: 10, padding: "11px 12px", margin: "4px 0 11px" }}>
              <label style={{ display: "flex", alignItems: "center", gap: 9, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={gstBilling}
                  onChange={(e) => setGstBilling(e.target.checked)}
                  style={{ width: 15, height: 15, accentColor: "#4E5BDC", cursor: "pointer" }}
                />
                <span style={{ fontSize: 12.5, fontWeight: 600, color: "#19202E" }}>
                  GST billing <span style={{ fontSize: 11, color: "#8A93A6", fontWeight: 500 }}>· invoice with tax shown separately</span>
                </span>
              </label>
              {gstBilling && (
                <div style={{ marginTop: 10 }}>
                  <input
                    value={gstin}
                    onChange={(e) => setGstin(e.target.value.toUpperCase())}
                    placeholder="GSTIN (e.g. 09AABCS1429K1Z5)"
                    maxLength={15}
                    style={{ width: "100%", border: "1px solid #E0E4ED", borderRadius: 8, padding: "9px 11px", fontSize: 12.5, fontFamily: MONO, color: "#19202E", outline: "none", background: "#fff" }}
                  />
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: "#56627A", marginTop: 11 }}>
                    <span>Taxable value</span>
                    <span style={{ fontFamily: GROTESK, color: "#19202E" }}>{fmt(calc.taxable)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, color: "#56627A", marginTop: 6 }}>
                    <span>GST (at category rates)</span>
                    <span style={{ fontFamily: GROTESK, color: "#19202E" }}>{fmt(calc.gst)}</span>
                  </div>
                  <div style={{ fontSize: 11, color: "#8A93A6", marginTop: 7 }}>
                    Both appear on your invoice — the total payable doesn&apos;t change.
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#E6F5EE", borderRadius: 9, padding: "10px 12px", margin: "0 0 13px" }}>
              <span style={{ fontSize: 12.5, color: "#137a4b", fontWeight: 600 }}>You save vs MRP</span>
              <span style={{ fontFamily: GROTESK, fontSize: 15, fontWeight: 700, color: "#1F9D63" }}>{fmt(calc.save)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", borderTop: "1px solid #F0F2F6", paddingTop: 13 }}>
              <span style={{ fontWeight: 600, fontSize: 14 }}>Total <span style={{ fontSize: 11, color: "#8A93A6", fontWeight: 500 }}>incl. GST</span></span>
              <span style={{ fontFamily: GROTESK, fontSize: 22, fontWeight: 700 }}>{fmt(calc.total)}</span>
            </div>
          </div>

          {/* payment / credit */}
          <div style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 14, padding: "18px 20px" }}>
            <div style={{ fontFamily: GROTESK, fontWeight: 600, fontSize: 14.5, marginBottom: 13 }}>Payment</div>
            {liveMode ? (
              <div style={{ fontSize: 12.5, color: "#56627A", lineHeight: 1.6 }}>
                Choose how to pay at the next step: UPI, cards and netbanking via secure checkout. 🔒
              </div>
            ) : (<>
            {/* Elume-branded online payment (Razorpay powers it — coming soon) */}
            <div style={{ display: "flex", alignItems: "center", gap: 11, border: "1.5px solid #E8EBF1", background: "#FAFBFD", borderRadius: 11, padding: 13, marginBottom: 10 }}>
              <div style={{ width: 18, height: 18, borderRadius: "50%", border: "2px solid #D5DAE4" }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#56627A" }}>
                  Pay online <span style={{ fontSize: 10, fontWeight: 700, color: "#4E5BDC", background: "#EEF0FD", padding: "2px 7px", borderRadius: 10, marginLeft: 4, letterSpacing: "0.4px", textTransform: "uppercase" }}>Coming soon</span>
                </div>
                <div style={{ fontSize: 11.5, color: "#8A93A6" }}>UPI, cards &amp; netbanking — secure Elume checkout</div>
              </div>
              <span style={{ fontSize: 10, color: "#A0A7B5" }}>🔒</span>
            </div>
            <div onClick={() => setPay("now")} style={{ display: "flex", alignItems: "center", gap: 11, border: `1.5px solid ${pn.bd}`, background: pn.bg, borderRadius: 11, padding: 13, marginBottom: 10, cursor: "pointer" }}>
              <div style={{ width: 18, height: 18, borderRadius: "50%", border: `2px solid ${pn.dot}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: pn.fill }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>Pay on delivery</div>
                <div style={{ fontSize: 11.5, color: "#8A93A6" }}>Settle the full amount when goods arrive</div>
              </div>
            </div>
            <a href="/credit" style={{ display: "block", border: "1.5px solid #E8EBF1", background: "#FAFBFD", borderRadius: 11, padding: 13, cursor: "pointer" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                <div style={{ width: 18, height: 18, borderRadius: "50%", border: "2px solid #D5DAE4", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: "transparent" }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#56627A" }}>
                    Elume Credit · 30 days <span style={{ fontSize: 10, fontWeight: 700, color: "#4E5BDC", background: "#EEF0FD", padding: "2px 7px", borderRadius: 10, marginLeft: 4, letterSpacing: "0.4px", textTransform: "uppercase" }}>Coming soon</span>
                  </div>
                  <div style={{ fontSize: 11.5, color: "#8A93A6" }}>
                    30-day NBFC credit is in development — <span style={{ color: "#4E5BDC", fontWeight: 600 }}>join the waitlist →</span>
                  </div>
                </div>
              </div>
            </a>
            </>)}
          </div>

          <div onClick={onPlace} style={{ background: "#4E5BDC", color: "#fff", fontWeight: 700, fontSize: 14.5, textAlign: "center", padding: 15, borderRadius: 12, cursor: "pointer" }}>
            {liveMode ? "Proceed to checkout · " + fmt(calc.total) : credit ? "Place order on 30-day credit" : "Place order · " + fmt(calc.total)}
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


/* ============================ LIVE MODE ============================
 * Real accounts on the live site: KPIs derived from the user's actual
 * orders, projects they create themselves, and honest zero-states. The
 * demo (Meridian Developments) renders only when no live data is passed. */

function LivePortfolio({ live, onCatalogue }: { live: LiveWorkspace; onCatalogue: () => void }) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [site, setSite] = useState("");
  const [stage, setStage] = useState("Rough-in");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  const submit = async () => {
    setBusy(true); setErr(null);
    try {
      const res = await createAppProject(name, site, stage);
      if (!res.ok) setErr(res.error);
      else { setCreating(false); setName(""); setSite(""); router.refresh(); }
    } catch {
      setErr("The site was updated while this page was open. Reload and try again.");
    } finally { setBusy(false); }
  };
  const removeProject = async (id: string) => {
    try { await deleteAppProject(id); router.refresh(); } catch { /* refresh shows truth */ }
  };

  const { stats } = live;
  return (
    <div style={{ padding: "26px 30px", animation: "elumeFade .35s ease" }}>
      {/* KPI ROW: real numbers, zeros stated plainly */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 15, marginBottom: 18 }}>
        <div style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 14, padding: "17px 18px" }}>
          <div style={{ fontSize: 11.5, color: "#8A93A6", marginBottom: 10 }}>Ordered · all time</div>
          <div style={{ fontFamily: GROTESK, fontSize: 27, fontWeight: 600, letterSpacing: "-0.6px" }}>{fmt(stats.committed)}</div>
          <div style={{ fontSize: 11.5, color: "#56627A", marginTop: 6 }}>{live.orders.length === 0 ? "your orders appear here" : `${live.orders.length} order${live.orders.length === 1 ? "" : "s"}`}</div>
        </div>
        <div style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 14, padding: "17px 18px" }}>
          <div style={{ fontSize: 11.5, color: "#8A93A6", marginBottom: 10 }}>In delivery</div>
          <div style={{ fontFamily: GROTESK, fontSize: 27, fontWeight: 600, letterSpacing: "-0.6px" }}>{fmt(stats.openValue)}</div>
          <div style={{ fontSize: 11.5, color: "#56627A", marginTop: 6 }}>{stats.openCount} in progress · {stats.deliveredCount} delivered</div>
        </div>
        <div style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 14, padding: "17px 18px" }}>
          <div style={{ fontSize: 11.5, color: "#8A93A6", marginBottom: 10 }}>Credit utilised</div>
          <div style={{ fontFamily: GROTESK, fontSize: 27, fontWeight: 600, letterSpacing: "-0.6px" }}>0<span style={{ fontSize: 16, color: "#56627A" }}>%</span></div>
          <div style={{ fontSize: 11.5, color: "#56627A", marginTop: 6 }}>NBFC credit line coming soon</div>
        </div>
        <div style={{ background: "#10271C", border: "1px solid #1a4530", borderRadius: 14, padding: "17px 18px" }}>
          <div style={{ fontSize: 11.5, color: "#8fd9b3", marginBottom: 10 }}>Wholesale saving</div>
          <div style={{ fontFamily: GROTESK, fontSize: 27, fontWeight: 600, color: "#fff", letterSpacing: "-0.6px" }}>−5%</div>
          <div style={{ fontSize: 11.5, color: "#4fd591", marginTop: 6, fontWeight: 700 }}>auto-applies at {WHOLESALE_MIN_QTY}+ units</div>
        </div>
      </div>

      {/* PROJECTS */}
      <div style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 14, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "15px 18px", borderBottom: "1px solid #F0F2F6" }}>
          <span style={{ fontFamily: GROTESK, fontWeight: 600, fontSize: 14.5 }}>
            Projects <span style={{ color: "#8A93A6", fontWeight: 400 }}>· {live.projects.length} site{live.projects.length === 1 ? "" : "s"}</span>
          </span>
          <span onClick={() => setCreating((c) => !c)} style={{ fontSize: 12.5, color: "#4E5BDC", fontWeight: 600, cursor: "pointer" }}>
            {creating ? "Close" : "+ New project"}
          </span>
        </div>

        {creating && (
          <div style={{ padding: "14px 18px", borderBottom: "1px solid #F0F2F6", display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", background: "#F8F9FC" }}>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Project name (e.g. Site A wiring)" style={{ border: "1px solid #E0E4ED", borderRadius: 9, padding: "9px 12px", fontSize: 13, minWidth: 220 }} />
            <input value={site} onChange={(e) => setSite(e.target.value)} placeholder="Location (optional)" style={{ border: "1px solid #E0E4ED", borderRadius: 9, padding: "9px 12px", fontSize: 13, minWidth: 180 }} />
            <select value={stage} onChange={(e) => setStage(e.target.value)} style={{ border: "1px solid #E0E4ED", borderRadius: 9, padding: "9px 12px", fontSize: 13, background: "#fff" }}>
              {["Rough-in", "Wiring", "Panel & DB", "Finishing"].map((st) => <option key={st}>{st}</option>)}
            </select>
            <button onClick={submit} disabled={busy || !name.trim()} style={{ background: "#4E5BDC", color: "#fff", fontWeight: 700, fontSize: 12.5, border: "none", padding: "10px 16px", borderRadius: 9, cursor: "pointer", opacity: busy || !name.trim() ? 0.6 : 1 }}>
              {busy ? "Creating…" : "Create project"}
            </button>
            {err && <span style={{ fontSize: 12.5, color: "#D14343", fontWeight: 600 }}>{err}</span>}
          </div>
        )}

        {live.projects.length === 0 ? (
          <div style={{ padding: "40px 20px", textAlign: "center" }}>
            <div style={{ fontSize: 26, marginBottom: 8 }}>🏗️</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#19202E" }}>A clean slate.</div>
            <div style={{ fontSize: 12.5, color: "#8A93A6", marginTop: 4, lineHeight: 1.6 }}>
              Create your first project to organise purchases by site, or head straight to the catalogue.
            </div>
            <div onClick={onCatalogue} style={{ display: "inline-block", marginTop: 14, background: "#4E5BDC", color: "#fff", fontWeight: 700, fontSize: 13, padding: "10px 18px", borderRadius: 9, cursor: "pointer" }}>
              Browse the catalogue →
            </div>
          </div>
        ) : (
          live.projects.map((pr) => {
            const [stageBg, stageFg] = STAGE_COLORS[pr.stage] ?? ["#F5F6F9", "#56627A"];
            return (
              <div key={pr.id} style={{ display: "flex", gap: 14, padding: "15px 18px", alignItems: "center", borderBottom: "1px solid #F5F6F9" }}>
                <div style={{ minWidth: 220 }}>
                  <div style={{ fontWeight: 600, fontSize: 13.5, color: "#19202E" }}>{pr.name}</div>
                  <div style={{ fontSize: 11, color: "#8A93A6" }}>{pr.site ?? "location not set"}</div>
                </div>
                <span style={{ display: "inline-block", fontSize: 12, fontWeight: 600, padding: "3px 9px", borderRadius: 6, background: stageBg, color: stageFg }}>{pr.stage}</span>
                <span style={{ fontSize: 11.5, color: "#A0A7B5", marginLeft: "auto" }}>
                  since {new Date(pr.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                </span>
                <span onClick={() => removeProject(pr.id)} title="Delete project" style={{ color: "#B43A16", cursor: "pointer", fontSize: 15, padding: "0 4px" }}>×</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function LiveOrders({ live, onCatalogue }: { live: LiveWorkspace; onCatalogue: () => void }) {
  // The fulfilment journey; an order's status maps to a position on it.
  const JOURNEY = ["placed", "confirmed", "packed", "shipped", "out_for_delivery", "delivered"];
  const LABEL: Record<string, string> = {
    placed: "Order placed", confirmed: "Confirmed", packed: "Packed",
    shipped: "Shipped", partially_shipped: "Partially shipped",
    out_for_delivery: "Out for delivery", delivered: "Delivered",
  };
  const badge: Record<string, [string, string]> = {
    placed: ["#EEF0FE", "#4E5BDC"], confirmed: ["#E6F0FF", "#2563C9"], packed: ["#FFF3E0", "#C77700"],
    shipped: ["#E7F3EC", "#1F9D63"], partially_shipped: ["#FBF0E4", "#B4690E"],
    out_for_delivery: ["#E7F3EC", "#1F8F5B"], delivered: ["#E6F5EE", "#137a4b"],
  };
  const posOf = (status: string) => {
    if (status === "partially_shipped") return JOURNEY.indexOf("shipped");
    const i = JOURNEY.indexOf(status);
    return i === -1 ? 0 : i;
  };

  return (
    <div style={{ padding: "26px 30px", animation: "elumeFade .35s ease" }}>
      <div style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 14, overflow: "hidden" }}>
        <div style={{ padding: "15px 18px", borderBottom: "1px solid #F0F2F6", fontFamily: GROTESK, fontWeight: 600, fontSize: 14.5 }}>
          Your orders <span style={{ color: "#8A93A6", fontWeight: 400 }}>· {live.orders.length}</span>
        </div>
        {live.orders.length === 0 ? (
          <div style={{ padding: "40px 20px", textAlign: "center" }}>
            <div style={{ fontSize: 26, marginBottom: 8 }}>📦</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#19202E" }}>No orders yet.</div>
            <div style={{ fontSize: 12.5, color: "#8A93A6", marginTop: 4 }}>Everything you buy shows up here with live tracking.</div>
            <div onClick={onCatalogue} style={{ display: "inline-block", marginTop: 14, background: "#4E5BDC", color: "#fff", fontWeight: 700, fontSize: 13, padding: "10px 18px", borderRadius: 9, cursor: "pointer" }}>
              Browse the catalogue →
            </div>
          </div>
        ) : (
          live.orders.map((o) => {
            const [bg, fg] = badge[o.status] ?? ["#F5F6F9", "#56627A"];
            const pos = posOf(o.status);
            return (
              <details key={o.id} style={{ borderBottom: "1px solid #F5F6F9" }}>
                <summary style={{ display: "flex", gap: 14, alignItems: "baseline", padding: "14px 18px", cursor: "pointer", listStyle: "none", flexWrap: "wrap" }}>
                  <span style={{ color: "#A0A7B5", fontSize: 11 }}>▸</span>
                  <span style={{ fontFamily: MONO, fontSize: 12.5, fontWeight: 700 }}>{o.id}</span>
                  <span style={{ fontSize: 12, color: "#8A93A6" }}>{o.items} item{o.items === 1 ? "" : "s"}</span>
                  <span style={{ fontFamily: GROTESK, fontSize: 14, fontWeight: 600 }}>{fmt(o.total)}</span>
                  <span style={{ display: "inline-block", fontSize: 11.5, fontWeight: 700, padding: "3px 10px", borderRadius: 7, background: bg, color: fg }}>{LABEL[o.status] ?? o.status.replace(/_/g, " ")}</span>
                  <span style={{ marginLeft: "auto", fontSize: 11.5, color: "#A0A7B5" }}>
                    {new Date(o.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                  </span>
                </summary>

                {/* Inline tracking: the full journey right here, no separate page. */}
                <div style={{ background: "#F8F9FC", borderTop: "1px solid #F0F2F6", padding: "18px 20px 16px 43px" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 0, marginBottom: 16, maxWidth: 640 }}>
                    {JOURNEY.map((st, i) => {
                      const done = i < pos, active = i === pos;
                      return (
                        <div key={st} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: i === 0 ? "flex-start" : "center", position: "relative" }}>
                          {i > 0 && (
                            <div style={{ position: "absolute", top: 7, right: "50%", width: "100%", height: 2, background: i <= pos ? "#1F9D63" : "#E0E4ED" }} />
                          )}
                          <span style={{ zIndex: 1, width: 15, height: 15, borderRadius: "50%", background: done || active ? "#1F9D63" : "#fff", border: done || active ? "none" : "2px solid #D6DBE6", boxShadow: active ? "0 0 0 4px #E6F5EE" : "none" }} />
                          <span style={{ fontSize: 10, marginTop: 6, fontWeight: active ? 700 : 500, color: done || active ? "#137a4b" : "#A0A7B5", textAlign: i === 0 ? "left" : "center", lineHeight: 1.25 }}>
                            {LABEL[st]}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  {o.status === "partially_shipped" && (
                    <div style={{ fontSize: 12, color: "#B4690E", fontWeight: 600, marginBottom: 10 }}>Part of this order has shipped; the rest is on its way.</div>
                  )}
                  {o.lines.length > 0 && (
                    <div style={{ background: "#fff", border: "1px solid #EEF0F4", borderRadius: 10, padding: "10px 14px", maxWidth: 640 }}>
                      {o.lines.map((l, i) => (
                        <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 12.5, color: "#2c3550", padding: "3px 0" }}>
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.name}</span>
                          <span style={{ color: "#8A93A6", flex: "none" }}>× {l.qty}</span>
                        </div>
                      ))}
                      {o.items > o.lines.length && <div style={{ fontSize: 11.5, color: "#A0A7B5", paddingTop: 4 }}>+ {o.items - o.lines.length} more item{o.items - o.lines.length === 1 ? "" : "s"}</div>}
                    </div>
                  )}
                </div>
              </details>
            );
          })
        )}
      </div>
    </div>
  );
}

/* ============================ ACCOUNT ============================ */

function AccountScreen({ user, section }: { user: { email: string; name?: string; org?: string; accountType?: "business" | "individual"; gstin?: string }; section: "personal" | "business" }) {
  const router = useRouter();
  const isBiz = user.accountType === "business";
  const [name, setName] = useState(user.name ?? "");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState(user.org && user.org !== "Business account" && user.org !== "Individual account" ? user.org : "");
  const [gstin, setGstin] = useState(user.gstin ?? "");
  const [busy, setBusy] = useState<"personal" | "business" | null>(null);
  const [note, setNote] = useState<{ where: "personal" | "business"; ok: boolean; text: string } | null>(null);
  const bizRef = useRef<HTMLDivElement>(null);
  const persRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (section === "business" ? bizRef : persRef).current?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [section]);

  const savePersonal = async () => {
    setBusy("personal"); setNote(null);
    try {
      const res = await updatePersonalDetails(name, phone);
      setNote({ where: "personal", ok: res.ok, text: res.ok ? "Saved." : res.error });
      if (res.ok) router.refresh();
    } catch { setNote({ where: "personal", ok: false, text: "The site was updated while this page was open. Reload and try again." }); }
    finally { setBusy(null); }
  };
  const saveBusiness = async () => {
    setBusy("business"); setNote(null);
    try {
      const res = await upgradeToBusiness(company, gstin);
      setNote({ where: "business", ok: res.ok, text: res.ok ? (isBiz ? "Saved." : "You're on a business account now. GST details will appear on your invoices.") : res.error });
      if (res.ok) router.refresh();
    } catch { setNote({ where: "business", ok: false, text: "The site was updated while this page was open. Reload and try again." }); }
    finally { setBusy(null); }
  };

  const card: React.CSSProperties = { background: "#fff", border: "1px solid #E8EBF1", borderRadius: 14, padding: "20px 22px", maxWidth: 560, marginBottom: 16 };
  const label: React.CSSProperties = { display: "block", fontSize: 11.5, fontWeight: 700, color: "#8A93A6", textTransform: "uppercase", letterSpacing: "0.4px", margin: "12px 0 5px" };
  const input: React.CSSProperties = { width: "100%", boxSizing: "border-box", border: "1px solid #E0E4ED", borderRadius: 9, padding: "10px 12px", fontSize: 13.5 };
  const saveBtn = (b: boolean): React.CSSProperties => ({ marginTop: 14, background: "#4E5BDC", color: "#fff", fontWeight: 700, fontSize: 13, border: "none", padding: "10px 20px", borderRadius: 9, cursor: "pointer", opacity: b ? 0.6 : 1 });

  return (
    <div style={{ padding: "26px 30px", animation: "elumeFade .35s ease" }}>
      {/* ── Account details ── */}
      <div ref={bizRef} style={card}>
        <div style={{ fontFamily: GROTESK, fontWeight: 600, fontSize: 15.5, marginBottom: 4 }}>Account details</div>
        <div style={{ fontSize: 12.5, color: "#8A93A6" }}>How you sign in, and what kind of account this is.</div>
        <span style={label}>Email</span>
        <div style={{ ...input, background: "#F5F6F9", color: "#56627A" }}>{user.email}</div>
        <span style={label}>Account type</span>
        <div style={{ ...input, background: "#F5F6F9", color: "#56627A", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>{isBiz ? "Business" : "Individual"}</span>
          {isBiz && <span style={{ fontSize: 10.5, fontWeight: 800, color: "#4E5BDC", background: "#EEF0FE", padding: "2px 8px", borderRadius: 7, textTransform: "uppercase" }}>GST invoicing on</span>}
        </div>

        {/* Business fields (editable) or the switch form */}
        <div style={{ marginTop: 18, paddingTop: 14, borderTop: "1px solid #F0F2F6" }}>
          <div style={{ fontWeight: 700, fontSize: 13.5, color: "#19202E" }}>{isBiz ? "Business details" : "Switch to a Business account"}</div>
          {!isBiz && <div style={{ fontSize: 12.5, color: "#8A93A6", marginTop: 3 }}>Add your company and GSTIN to get GST invoices with input credit on every order.</div>}
          <span style={label}>Company name</span>
          <input style={input} value={company} onChange={(e) => setCompany(e.target.value)} placeholder="e.g. Sharma Electricals" />
          <span style={label}>GSTIN</span>
          <input style={input} value={gstin} onChange={(e) => setGstin(e.target.value.toUpperCase())} placeholder="15-character GSTIN" maxLength={15} />
          <div>
            <button onClick={saveBusiness} disabled={busy === "business"} style={saveBtn(busy === "business")}>
              {busy === "business" ? "Saving…" : isBiz ? "Save business details" : "Switch to Business"}
            </button>
          </div>
          {note?.where === "business" && <div style={{ marginTop: 10, fontSize: 12.5, fontWeight: 600, color: note.ok ? "#1F9D63" : "#D14343" }}>{note.text}</div>}
        </div>
      </div>

      {/* ── Personal details ── */}
      <div ref={persRef} style={card}>
        <div style={{ fontFamily: GROTESK, fontWeight: 600, fontSize: 15.5, marginBottom: 4 }}>Personal details</div>
        <div style={{ fontSize: 12.5, color: "#8A93A6" }}>The name on your orders and how we reach you about deliveries.</div>
        <span style={label}>Full name</span>
        <input style={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
        <span style={label}>Phone</span>
        <input style={input} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="10-digit mobile (optional)" />
        <div>
          <button onClick={savePersonal} disabled={busy === "personal"} style={saveBtn(busy === "personal")}>
            {busy === "personal" ? "Saving…" : "Save personal details"}
          </button>
        </div>
        {note?.where === "personal" && <div style={{ marginTop: 10, fontSize: 12.5, fontWeight: 600, color: note.ok ? "#1F9D63" : "#D14343" }}>{note.text}</div>}
      </div>
    </div>
  );
}

