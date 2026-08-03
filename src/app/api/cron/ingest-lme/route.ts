import { NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { recordTick, marketDay, SERIES } from "@/lib/metals-market";

/**
 * LME copper snapshot → internal reference series (metal_market_ticks/_daily).
 *
 * Source: metals.dev free tier (symbol lme_copper = LME Copper 3-month,
 * USD/tonne, includes change vs previous market day). Free tier is 100
 * requests/month, so this runs TWICE per weekday from GitHub Actions
 * (.github/workflows/metals-market-ingest.yml), not on a tight loop.
 * Graceful no-op when METALS_DEV_API_KEY is unset.
 *
 * Auth: `Authorization: Bearer $CRON_SECRET` (same contract as the other
 * /api/cron routes). Vercel Hobby crons are daily-max, hence GitHub Actions.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = (process.env.CRON_SECRET || "").trim();
  const auth = request.headers.get("authorization") ?? "";
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const key = (process.env.METALS_DEV_API_KEY || "").trim();
  if (!key) return NextResponse.json({ ok: true, skipped: "METALS_DEV_API_KEY unset" });

  const db = adminClient();
  if (!db) return NextResponse.json({ error: "Database unavailable." }, { status: 500 });

  let body: any;
  try {
    const res = await fetch(
      `https://api.metals.dev/v1/metal/spot?api_key=${encodeURIComponent(key)}&metal=lme_copper&currency=USD`,
      { cache: "no-store" }
    );
    body = await res.json();
    if (!res.ok || body?.status === "failure") {
      return NextResponse.json({ error: `metals.dev ${res.status}: ${JSON.stringify(body).slice(0, 300)}` }, { status: 502 });
    }
  } catch (e) {
    return NextResponse.json({ error: `metals.dev fetch failed: ${e instanceof Error ? e.message : e}` }, { status: 502 });
  }

  // Response shapes seen in metals.dev docs: { rate: { price, ch, chp, ... } }
  // for /metal/spot; be tolerant of number-vs-object variants.
  const rate = body?.rate;
  const price = Number(typeof rate === "object" && rate !== null ? rate.price : rate);
  if (!Number.isFinite(price) || price <= 0) {
    return NextResponse.json({ error: `metals.dev unparseable: ${JSON.stringify(body).slice(0, 300)}` }, { status: 502 });
  }
  const change = typeof rate === "object" && rate?.ch != null && Number.isFinite(Number(rate.ch)) ? Number(rate.ch) : null;
  const changePct = typeof rate === "object" && rate?.chp != null && Number.isFinite(Number(rate.chp)) ? Number(rate.chp) : null;

  const saved = await recordTick(db, {
    series: SERIES.LME,
    day: marketDay("UTC"), // LME market day
    price,
    currency: "USD",
    unit: "mt",
    change,
    changePct,
    meta: { source: "metals.dev", symbol: "lme_copper" },
  });
  if (!saved.ok) return NextResponse.json({ error: saved.error }, { status: 500 });

  console.log(`[ingest-lme] lme_copper_3m ${price} USD/mt (ch ${change ?? "-"} / ${changePct ?? "-"}%)`);
  return NextResponse.json({ ok: true, price, change, changePct });
}
