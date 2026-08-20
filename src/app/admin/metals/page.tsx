import Link from "next/link";
import { requireAdmin } from "@/lib/admin/auth";
import { adminClient } from "@/lib/supabase/admin";
import { hasServiceRole } from "@/lib/admin/data";
import { latestReadings, type MarketReading } from "@/lib/metals-market";
import { METALS_CATEGORIES } from "@/lib/metals";
import { gstRateFor } from "@/lib/pricing";
import MetalsConsole, { type ConsoleProduct } from "./MetalsConsole";

/**
 * Metals price console: the thrice-daily (9am/11am/2pm IST) copper rate is set
 * here - the reminder emails deep-link to this page. Shows the latest INTERNAL
 * MCX/LME reference readings beside the rate inputs; that data never renders
 * on the public site (public pages embed TradingView widgets instead).
 */
export const dynamic = "force-dynamic";

const IST = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: true });

function ReadingCard({ label, unitLabel, r }: { label: string; unitLabel: string; r: MarketReading | null }) {
  const up = (r?.change ?? r?.changePct ?? 0) >= 0;
  return (
    <div style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 14, padding: "16px 20px", flex: 1, minWidth: 220 }}>
      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, textTransform: "uppercase", color: "#8A93A6" }}>{label}</div>
      {r ? (
        <>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 6 }}>
            <span style={{ fontSize: 26, fontWeight: 700 }}>{r.currency === "INR" ? "₹" : "$"}{r.price.toLocaleString("en-IN", { maximumFractionDigits: 2 })}<span style={{ fontSize: 13, color: "#8A93A6", fontWeight: 600 }}>{unitLabel}</span></span>
            {(r.change != null || r.changePct != null) && (
              <span style={{ fontSize: 13, fontWeight: 700, color: up ? "#1F9D63" : "#D14343" }}>
                {up ? "▲" : "▼"} {r.change != null ? Math.abs(r.change).toFixed(2) : ""}{r.changePct != null ? ` (${Math.abs(r.changePct).toFixed(2)}%)` : ""}
              </span>
            )}
          </div>
          <div style={{ fontSize: 12, color: "#8A93A6", marginTop: 4 }}>updated {IST.format(new Date(r.ts))} IST{r.meta && (r.meta as any).symbol ? ` · ${(r.meta as any).symbol}` : ""}</div>
        </>
      ) : (
        <div style={{ fontSize: 13, color: "#8A93A6", marginTop: 8 }}>No feed data yet - the ingest cron hasn't run (or its API keys aren't set).</div>
      )}
    </div>
  );
}

export default async function AdminMetals() {
  await requireAdmin();
  const db = adminClient();

  let products: ConsoleProduct[] = [];
  let enquiries = 0;
  if (db) {
    // supabase-js resolves errors into { data: null, error } (it never
    // rejects), so `?? []` alone is the whole missing-table guard.
    const { data } = await db
      .from("products")
      .select("id, name, spec, category, unit, elume_price, gst_rate, attrs, is_active")
      .in("category", METALS_CATEGORIES)
      .order("sort_order")
      .order("id");
    products = (data ?? []).map((r: any) => ({
      id: r.id,
      name: r.name,
      spec: r.spec ?? "",
      unit: r.unit,
      lot: r.attrs?.Lot ?? null,
      attrs: r.attrs ?? null,
      gstRate: gstRateFor(r.category, r.gst_rate != null ? Number(r.gst_rate) : null),
      price: Number(r.elume_price),
      active: Boolean(r.is_active),
    }));
    const { count } = await db.from("metal_enquiries").select("id", { count: "exact", head: true });
    enquiries = count ?? 0;
  }

  const { mcx, lme } = await latestReadings();

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 6 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Metals · price console</h1>
        <Link href="/admin/metals/enquiries" style={{ fontSize: 13, fontWeight: 600, color: "#1D2F8A" }}>
          Enquiries{enquiries > 0 ? ` (${enquiries})` : ""} →
        </Link>
      </div>
      <p style={{ fontSize: 14, color: "#56627A", margin: "0 0 18px" }}>
        Quote the <b>ex-GST ₹/kg</b> rate (trade convention); lot prices, GST and the storefront update automatically. Rates are due at 9:00 am, 11:00 am and 2:00 pm IST.
      </p>

      {!hasServiceRole() && (
        <div style={{ background: "#FBE9E4", border: "1px solid #f0c9bd", color: "#9a3b16", borderRadius: 10, padding: "12px 14px", fontSize: 13, marginBottom: 20 }}>
          <b>Writes are disabled.</b> Set <code>SUPABASE_SERVICE_ROLE_KEY</code> in the env to edit rates.
        </div>
      )}

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 8 }}>
        <ReadingCard label="MCX Copper · near month" unitLabel="/kg" r={mcx} />
        <ReadingCard label="LME Copper · 3-month" unitLabel="/t" r={lme} />
      </div>
      <p style={{ fontSize: 12, color: "#8A93A6", margin: "0 0 22px" }}>
        Internal reference only (delayed snapshots) - the public site shows TradingView charts, never these numbers.
      </p>

      {products.length === 0 ? (
        <div style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 14, padding: "22px 24px", fontSize: 14, color: "#56627A" }}>
          No metals products found. Run <code>supabase/migrations/0087_metals.sql</code> in the Supabase SQL editor to seed the copper catalogue (Super D, CCR Rod, CC Rod), then reload.
        </div>
      ) : (
        <MetalsConsole products={products} />
      )}
    </div>
  );
}
