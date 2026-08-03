import { NextResponse } from "next/server";
import { createHmac } from "node:crypto";
import { adminClient } from "@/lib/supabase/admin";
import { recordTick, marketDay, getFeedState, setFeedState, SERIES } from "@/lib/metals-market";

/**
 * MCX copper snapshot → internal reference series (metal_market_ticks/_daily).
 *
 * Source: Angel One SmartAPI (free market data with a free trading account).
 * Flow per run: TOTP session login → resolve the near-month COPPER future
 * (searchScrip, cached in metal_feed_state and re-resolved when the cached
 * contract expires) → FULL quote → store LTP + change vs previous close.
 * MCX copper trades in INR per kg. Runs every 15 minutes during MCX hours
 * from GitHub Actions (.github/workflows/metals-market-ingest.yml).
 *
 * Env (all four required, else the run is a graceful no-op):
 *   ANGEL_API_KEY, ANGEL_CLIENT_CODE, ANGEL_PIN, ANGEL_TOTP_SECRET
 * Auth: `Authorization: Bearer $CRON_SECRET`.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const BASE = "https://apiconnect.angelone.in";
const CONTRACT_KEY = "mcx_copper_contract";

/* ── RFC 6238 TOTP (SHA-1, 30s step, 6 digits) - no dependency needed ── */
function base32Decode(s: string): Buffer {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const clean = s.toUpperCase().replace(/[^A-Z2-7]/g, "");
  const out: number[] = [];
  let bits = 0;
  let value = 0;
  for (const ch of clean) {
    value = (value << 5) | alphabet.indexOf(ch);
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

function totp(secret: string): string {
  const counter = Math.floor(Date.now() / 30_000);
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const h = createHmac("sha1", base32Decode(secret)).update(msg).digest();
  const off = h[h.length - 1] & 0x0f;
  const code = (((h[off] & 0x7f) << 24) | (h[off + 1] << 16) | (h[off + 2] << 8) | h[off + 3]) % 1_000_000;
  return String(code).padStart(6, "0");
}

function angelHeaders(apiKey: string, jwt?: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    "X-UserType": "USER",
    "X-SourceID": "WEB",
    "X-ClientLocalIP": "127.0.0.1",
    "X-ClientPublicIP": "106.193.147.98",
    "X-MACAddress": "00:00:00:00:00:00",
    "X-PrivateKey": apiKey,
    ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
  };
}

async function angelPost(path: string, apiKey: string, body: unknown, jwt?: string): Promise<any> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: angelHeaders(apiKey, jwt),
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json || json.status === false || json.success === false) {
    throw new Error(`${path} → ${res.status}: ${JSON.stringify(json)?.slice(0, 300)}`);
  }
  return json;
}

const MONTHS: Record<string, number> = { JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5, JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11 };

/** Parse an Angel MCX futures tradingsymbol like COPPER29AUG25FUT →
 *  expiry date (or null when the shape doesn't match, e.g. COPPERM mini). */
function parseExpiry(tradingsymbol: string): Date | null {
  const m = /^COPPER(\d{1,2})([A-Z]{3})(\d{2,4})FUT$/.exec(tradingsymbol);
  if (!m) return null;
  const mon = MONTHS[m[2]];
  if (mon == null) return null;
  const year = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  return new Date(Date.UTC(year, mon, Number(m[1]), 23, 59, 59));
}

type Contract = { token: string; symbol: string; expiry: string };

/** Near-month COPPER future (not the COPPERM mini), cached until expiry. */
async function resolveContract(db: NonNullable<ReturnType<typeof adminClient>>, apiKey: string, jwt: string): Promise<Contract> {
  const cached = await getFeedState<Contract>(db, CONTRACT_KEY);
  if (cached?.token && cached.expiry >= marketDay("Asia/Kolkata")) return cached;

  const res = await angelPost("/rest/secure/angelbroking/order/v1/searchScrip", apiKey, { exchange: "MCX", searchscrip: "COPPER" }, jwt);
  const rows: { tradingsymbol: string; symboltoken: string }[] = res?.data ?? [];
  const candidates = rows
    .map((r) => ({ ...r, expiryDate: parseExpiry(r.tradingsymbol) }))
    .filter((r): r is typeof r & { expiryDate: Date } => r.expiryDate != null && r.expiryDate.getTime() > Date.now())
    .sort((a, b) => a.expiryDate.getTime() - b.expiryDate.getTime());
  if (!candidates.length) {
    throw new Error(`no COPPER future found in searchScrip (${rows.length} rows: ${rows.slice(0, 5).map((r) => r.tradingsymbol).join(", ")})`);
  }
  const next: Contract = {
    token: candidates[0].symboltoken,
    symbol: candidates[0].tradingsymbol,
    expiry: candidates[0].expiryDate.toISOString().slice(0, 10),
  };
  await setFeedState(db, CONTRACT_KEY, next);
  return next;
}

export async function GET(request: Request) {
  const secret = (process.env.CRON_SECRET || "").trim();
  const auth = request.headers.get("authorization") ?? "";
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const apiKey = (process.env.ANGEL_API_KEY || "").trim();
  const clientCode = (process.env.ANGEL_CLIENT_CODE || "").trim();
  const pin = (process.env.ANGEL_PIN || "").trim();
  const totpSecret = (process.env.ANGEL_TOTP_SECRET || "").trim();
  if (!apiKey || !clientCode || !pin || !totpSecret) {
    return NextResponse.json({ ok: true, skipped: "ANGEL_* env unset" });
  }

  const db = adminClient();
  if (!db) return NextResponse.json({ error: "Database unavailable." }, { status: 500 });

  try {
    const login = await angelPost("/rest/auth/angelbroking/user/v1/loginByPassword", apiKey, {
      clientcode: clientCode,
      password: pin,
      totp: totp(totpSecret),
    });
    const jwt: string | undefined = login?.data?.jwtToken;
    if (!jwt) throw new Error(`login returned no jwtToken: ${JSON.stringify(login).slice(0, 200)}`);

    const contract = await resolveContract(db, apiKey, jwt);

    const quote = await angelPost(
      "/rest/secure/angelbroking/market/v1/quote/",
      apiKey,
      { mode: "FULL", exchangeTokens: { MCX: [contract.token] } },
      jwt
    );
    const q = quote?.data?.fetched?.[0];
    const price = Number(q?.ltp);
    if (!Number.isFinite(price) || price <= 0) {
      throw new Error(`quote unparseable for ${contract.symbol}: ${JSON.stringify(q).slice(0, 300)}`);
    }
    const change = q?.netChange != null && Number.isFinite(Number(q.netChange)) ? Number(q.netChange) : null;
    const changePct = q?.percentChange != null && Number.isFinite(Number(q.percentChange)) ? Number(q.percentChange) : null;

    const saved = await recordTick(db, {
      series: SERIES.MCX,
      day: marketDay("Asia/Kolkata"), // MCX market day
      price,
      currency: "INR",
      unit: "kg",
      change,
      changePct,
      meta: { source: "angelone", symbol: contract.symbol, expiry: contract.expiry },
    });
    if (!saved.ok) return NextResponse.json({ error: saved.error }, { status: 500 });

    console.log(`[ingest-mcx] ${contract.symbol} ₹${price}/kg (ch ${change ?? "-"} / ${changePct ?? "-"}%)`);
    return NextResponse.json({ ok: true, symbol: contract.symbol, price, change, changePct });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn(`[ingest-mcx] failed: ${msg}`);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
