/**
 * Internal LME/MCX copper reference series (server-only; service role).
 *
 * Data lands in metal_market_ticks (intraday snapshots) and metal_market_daily
 * (one close per market day) via the ingest cron routes. This data is
 * INTERNAL: it powers the /admin/metals price console and analysis. Public
 * pages embed TradingView widgets instead - never render these numbers on
 * the storefront (exchange display-licensing decision, Aug 2026).
 */
import { adminClient } from "@/lib/supabase/admin";

export const SERIES = {
  MCX: "mcx_copper", // MCX near-month copper future, INR/kg
  LME: "lme_copper_3m", // LME copper 3-month, USD/tonne
} as const;

export type MarketReading = {
  series: string;
  ts: string;
  price: number;
  currency: string;
  unit: string;
  change: number | null;
  changePct: number | null;
  meta?: Record<string, unknown> | null;
};

type Db = NonNullable<ReturnType<typeof adminClient>>;

export async function latestReading(db: Db, series: string): Promise<MarketReading | null> {
  try {
    const { data } = await db
      .from("metal_market_ticks")
      .select("*")
      .eq("series", series)
      .order("ts", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!data) return null;
    return {
      series: data.series,
      ts: data.ts,
      price: Number(data.price),
      currency: data.currency,
      unit: data.unit,
      change: data.change != null ? Number(data.change) : null,
      changePct: data.change_pct != null ? Number(data.change_pct) : null,
      meta: data.meta ?? null,
    };
  } catch {
    return null; // table may not exist yet (migration 0087 not run)
  }
}

/** Latest MCX + LME readings for the console/reminder email. Null-safe when
 *  the service role or the tables are missing. */
export async function latestReadings(): Promise<{ mcx: MarketReading | null; lme: MarketReading | null }> {
  const db = adminClient();
  if (!db) return { mcx: null, lme: null };
  const [mcx, lme] = await Promise.all([latestReading(db, SERIES.MCX), latestReading(db, SERIES.LME)]);
  return { mcx, lme };
}

/** Record one ingest snapshot + roll it into the market-day close.
 *  `day` is the series' market day (IST date for MCX, UTC date for LME);
 *  the last tick of the day naturally becomes the stored close. */
export async function recordTick(
  db: Db,
  r: Omit<MarketReading, "ts"> & { day: string }
): Promise<{ ok: boolean; error?: string }> {
  const { error: tickErr } = await db.from("metal_market_ticks").insert({
    series: r.series,
    price: r.price,
    currency: r.currency,
    unit: r.unit,
    change: r.change,
    change_pct: r.changePct,
    meta: r.meta ?? null,
  });
  if (tickErr) return { ok: false, error: tickErr.message };
  const { error: dayErr } = await db.from("metal_market_daily").upsert(
    { series: r.series, day: r.day, close: r.price, currency: r.currency, unit: r.unit, meta: r.meta ?? null },
    { onConflict: "series,day" }
  );
  if (dayErr) return { ok: false, error: dayErr.message };
  return { ok: true };
}

/** YYYY-MM-DD in a given IANA zone (market-day key). */
export function marketDay(zone: "Asia/Kolkata" | "UTC"): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

/* ── Feed worker state (e.g. resolved MCX contract token) ── */

export async function getFeedState<T>(db: Db, key: string): Promise<T | null> {
  try {
    const { data } = await db.from("metal_feed_state").select("value").eq("key", key).maybeSingle();
    return (data?.value as T) ?? null;
  } catch {
    return null;
  }
}

export async function setFeedState(db: Db, key: string, value: unknown): Promise<void> {
  try {
    await db.from("metal_feed_state").upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" });
  } catch {
    /* best-effort */
  }
}
