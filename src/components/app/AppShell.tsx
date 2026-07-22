"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Mark, Wordmark } from "@/components/Brand";
import { GROTESK, MONO } from "@/lib/fonts";
import { fmt } from "@/lib/format";
import { type LiveWorkspace } from "@/lib/workspace";
import { createAppProject, deleteAppProject } from "@/lib/workspace-actions";
import { updatePersonalDetails, upgradeToBusiness } from "@/lib/profile-actions";
import { WHOLESALE_MIN_QTY } from "@/lib/pricing";

/**
 * The buyer workspace: Overview (projects + real KPIs), Orders (inline
 * tracking) and Account. Catalogue and Cart route to the STOREFRONT — one
 * catalogue, one cart, one learning loop. The old in-app demo (Meridian
 * Developments) and its duplicate catalogue/cart were removed once every
 * real session started passing `live`.
 */

type Screen = "portfolio" | "confirm" | "account";

const NAV: { key: Screen | "catalogue" | "cart"; label: string }[] = [
  { key: "portfolio", label: "Overview" },
  { key: "catalogue", label: "Catalogue" },
  { key: "cart", label: "Cart" },
  { key: "confirm", label: "Orders" },
];

const STAGE_COLORS: Record<string, [string, string]> = {
  "Rough-in": ["#F5F6F9", "#56627A"],
  Wiring: ["#EEF0FD", "#4E5BDC"],
  "Panel & DB": ["#EEF0FD", "#4E5BDC"],
  Finishing: ["#E6F5EE", "#1F9D63"],
};

export default function AppShell({ user, live }: { user?: { email: string; name?: string; org?: string; accountType?: "business" | "individual"; gstin?: string }; live: LiveWorkspace }) {
  const userEmail = user?.email ?? "";
  const isBusiness = user?.accountType === "business";
  const userInitials = (user?.name || userEmail || "U").slice(0, 2).toUpperCase();
  const userName = user?.name || (userEmail ? userEmail.split("@")[0] : "Guest");
  const userOrg = user?.org || (isBusiness ? "Business account" : "Individual account");
  const router = useRouter();

  const [screen, setScreen] = useState<Screen>("portfolio");
  const [topQ, setTopQ] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [acctSection, setAcctSection] = useState<"personal" | "business">("personal");
  const contentRef = useRef<HTMLDivElement>(null);

  // Storefront cart badge (shared localStorage store).
  const [cartCount, setCartCount] = useState(0);
  useEffect(() => {
    const read = () => {
      try { setCartCount((JSON.parse(localStorage.getItem("elume.cart") || "[]") as { qty?: number }[]).reduce((a, i) => a + (i.qty ?? 1), 0)); } catch { /* fresh */ }
    };
    read();
    window.addEventListener("storage", read);
    window.addEventListener("focus", read);
    return () => { window.removeEventListener("storage", read); window.removeEventListener("focus", read); };
  }, []);

  const nav = (s: (typeof NAV)[number]["key"]) => {
    if (s === "catalogue") { router.push("/catalogue"); return; }
    if (s === "cart") { router.push("/cart"); return; }
    setScreen(s);
    if (contentRef.current) contentRef.current.scrollTop = 0;
  };

  const titles: Record<Screen, [string, string]> = {
    portfolio: ["Overview", `${userOrg} · ${live.projects.length} project${live.projects.length === 1 ? "" : "s"}`],
    confirm: ["Orders", "Every order with live tracking"],
    account: ["Your account", userEmail],
  };
  const [pageTitle, pageSub] = titles[screen];
  const showBack = screen !== "portfolio";

  return (
    <div style={{ height: "100vh", display: "flex", overflow: "hidden", fontFamily: "var(--hanken)", color: "#19202E", background: "#F5F6F9" }}>
      {/* ===================== SIDEBAR ===================== */}
      <div className="ws-sidebar" style={{ width: 224, flex: "none", background: "#161D2B", padding: "20px 15px", display: "flex", flexDirection: "column" }}>
        <div onClick={() => router.push("/")} style={{ display: "flex", alignItems: "center", gap: 9, margin: "6px 6px 26px", cursor: "pointer" }}>
          <Mark height={30} />
          <Wordmark height={17} white opacity={0.96} />
        </div>

        {NAV.map((n) => {
          const active = n.key === screen;
          return (
            <div key={n.key} onClick={() => nav(n.key)} style={{ display: "flex", alignItems: "center", gap: 11, padding: "9px 11px", borderRadius: 9, cursor: "pointer", fontSize: 13.5, marginBottom: 2, background: active ? "rgba(110,123,240,0.16)" : "transparent", color: active ? "#fff" : "#9aa3b8", fontWeight: active ? 600 : 500 }}>
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
        <div className="ws-topbar" style={{ height: 64, flex: "none", background: "#fff", borderBottom: "1px solid #E8EBF1", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 28px", zIndex: 5 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
            {showBack && (
              <div onClick={() => nav("portfolio")} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", color: "#56627A", fontSize: 13, fontWeight: 600, background: "#F5F6F9", border: "1px solid #E8EBF1", padding: "7px 12px", borderRadius: 8 }}>
                ‹ Back
              </div>
            )}
            <div>
              <div style={{ fontFamily: GROTESK, fontSize: 17, fontWeight: 600, color: "#19202E", letterSpacing: "-0.3px" }}>{pageTitle}</div>
              <div style={{ fontSize: 12, color: "#8A93A6", marginTop: 1 }}>{pageSub}</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <form
              className="ws-search"
              onSubmit={(e) => { e.preventDefault(); if (topQ.trim()) router.push(`/catalogue?q=${encodeURIComponent(topQ.trim())}`); }}
              style={{ position: "relative", width: 264, height: 38, background: "#F5F6F9", borderRadius: 9, border: "1px solid #E8EBF1", display: "flex", alignItems: "center", padding: "0 11px", gap: 8 }}
            >
              <span style={{ width: 13, height: 13, flex: "none", border: "2px solid #b6bdcb", borderRadius: "50%", display: "inline-block" }} />
              <input
                value={topQ}
                onChange={(e) => setTopQ(e.target.value)}
                placeholder="Search the catalogue…"
                style={{ border: "none", outline: "none", background: "transparent", fontSize: 12.5, color: "#19202E", width: "100%" }}
              />
              {topQ && <span onClick={() => setTopQ("")} style={{ cursor: "pointer", color: "#8A93A6", fontSize: 14, lineHeight: 1 }}>×</span>}
            </form>
            <div onClick={() => nav("cart")} className="ws-topcart" style={{ position: "relative", width: 38, height: 38, borderRadius: 9, border: "1px solid #E8EBF1", background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
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
                <div className="ws-usertext" style={{ lineHeight: 1.2 }}>
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
                      ["Account details", () => { setAcctSection("business"); setScreen("account"); }],
                      ["Personal details", () => { setAcctSection("personal"); setScreen("account"); }],
                      ...(!isBusiness ? [["Switch to Business account", () => { setAcctSection("business"); setScreen("account"); }] as [string, () => void]] : []),
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
          {screen === "portfolio" && <LivePortfolio live={live} onCatalogue={() => nav("catalogue")} />}
          {screen === "confirm" && <LiveOrders live={live} onCatalogue={() => nav("catalogue")} />}
          {screen === "account" && user && <AccountScreen user={user} section={acctSection} />}
        </div>

        {/* ═══ MOBILE TAB BAR (phones only; the sidebar hides) ═══ */}
        <div className="ws-bottombar" style={{ display: "none", position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 40, background: "#fff", borderTop: "1px solid #E8EBF1", boxShadow: "0 -6px 24px rgba(20,24,45,.06)", paddingBottom: "env(safe-area-inset-bottom)" }}>
          {NAV.map((n) => {
            const active = n.key === screen;
            const badge = n.key === "cart" ? cartCount : 0;
            return (
              <div key={n.key} onClick={() => nav(n.key)} style={{ flex: 1, padding: "9px 0 7px", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, cursor: "pointer", color: active ? "#4E5BDC" : "#8A93A6" }}>
                <span style={{ position: "relative", display: "inline-flex" }}>
                  <TabIcon name={n.key} active={active} />
                  {badge > 0 && (
                    <span style={{ position: "absolute", top: -5, right: -9, minWidth: 16, height: 16, padding: "0 4px", background: "#E0612A", color: "#fff", fontSize: 9.5, fontWeight: 700, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center" }}>{badge}</span>
                  )}
                </span>
                <span style={{ fontSize: 10, fontWeight: active ? 700 : 500, letterSpacing: "0.1px" }}>{n.label}</span>
              </div>
            );
          })}
        </div>
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
    <div className="ws-pad" style={{ padding: "26px 30px", animation: "elumeFade .35s ease" }}>
      {/* KPI ROW: real numbers, zeros stated plainly */}
      <div className="ws-kpis" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 15, marginBottom: 18 }}>
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
                <span style={{ fontSize: 11.5, color: "#A0A7B5", marginLeft: "auto", whiteSpace: "nowrap" }}>
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
    <div className="ws-pad" style={{ padding: "26px 30px", animation: "elumeFade .35s ease" }}>
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
                <div style={{ background: "#F8F9FC", borderTop: "1px solid #F0F2F6", padding: "18px 20px 16px 20px" }}>
                  <div className="ws-journey-scroll">
                  <div className="ws-journey" style={{ display: "flex", alignItems: "flex-start", gap: 0, marginBottom: 16, maxWidth: 640 }}>
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
    <div className="ws-pad" style={{ padding: "26px 30px", animation: "elumeFade .35s ease" }}>
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

/** Thin line icons for the mobile tab bar (currentColor, 22px). */
function TabIcon({ name, active }: { name: string; active: boolean }) {
  const sw = active ? 2 : 1.7;
  const common = { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: sw, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (name) {
    case "portfolio": // home
      return <svg {...common}><path d="M3 10.5 12 3l9 7.5" /><path d="M5.5 9.5V20h13V9.5" /><path d="M9.5 20v-5.5h5V20" /></svg>;
    case "catalogue": // grid
      return <svg {...common}><rect x="3.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="3.5" y="13.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="13.5" width="7" height="7" rx="1.5" /></svg>;
    case "cart":
      return <svg {...common}><path d="M3 4h2.2l2.1 11.2a1.6 1.6 0 0 0 1.6 1.3h7.9a1.6 1.6 0 0 0 1.6-1.2L20.5 8H6" /><circle cx="9.7" cy="20" r="1.3" /><circle cx="16.6" cy="20" r="1.3" /></svg>;
    case "confirm": // package
      return <svg {...common}><path d="M12 3 4 7v10l8 4 8-4V7l-8-4Z" /><path d="M4 7l8 4 8-4" /><path d="M12 11v9" /></svg>;
    default:
      return <svg {...common}><circle cx="12" cy="12" r="8" /></svg>;
  }
}