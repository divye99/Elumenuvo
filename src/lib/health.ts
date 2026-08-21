import { adminClient } from "@/lib/supabase/admin";
import { sendHealthAlert } from "@/lib/email";

/**
 * Uptime monitor (owner, 21 Aug 2026). Runs from /api/cron/health every five
 * minutes and from the "Check now" button on /admin/health. One run times:
 *   - the database through PostgREST (and picks the product page to test:
 *     the best-selling active product, so a deactivated SKU never raises a
 *     false alarm),
 *   - Supabase Auth,
 *   - the home page, the catalogue page and that product page, fetched as a
 *     self-identified monitor (the edge bouncer lets monitors through).
 * Verdict: "down" when the database or any page fails, "slow" when a page
 * takes over SLOW_PAGE_MS or the database over SLOW_DB_MS (or auth is
 * unhealthy), else "ok". Results are stored for a week; alerts go by email
 * with a 15-minute cooldown, plus one "recovered" mail.
 *
 * Limit worth knowing: this runs ON Vercel. If Vercel itself is down, no
 * check runs; an outside checker (UptimeRobot or similar) covers that case.
 */
export type HealthStatus = "ok" | "slow" | "down";
export type HealthRow = {
  at: string;
  status: HealthStatus;
  db_ok: boolean; db_ms: number | null;
  auth_ok: boolean; auth_ms: number | null;
  home_status: number | null; home_ms: number | null;
  catalogue_status: number | null; catalogue_ms: number | null;
  pdp_status: number | null; pdp_ms: number | null; pdp_path: string | null;
  note: string | null;
};

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || "https://elumenuvo.com").replace(/\/+$/, "");
export const HEALTH_UA = "ElumeHealthMonitor/1.0 (+https://elumenuvo.com)";
const LIMIT_MS = 15_000;
export const SLOW_PAGE_MS = 8_000;
export const SLOW_DB_MS = 3_000;
const ALERT_COOLDOWN_MS = 15 * 60_000;
const RECOVERY_GAP_MS = 12 * 60_000;
const KEEP_DAYS = 7;

type Timing = { status: number | null; ms: number; body: string };

async function timed(url: string, init?: RequestInit): Promise<Timing> {
  const t = Date.now();
  try {
    const r = await fetch(url, { ...init, cache: "no-store", signal: AbortSignal.timeout(LIMIT_MS) });
    const body = await r.text().catch(() => "");
    return { status: r.status, ms: Date.now() - t, body };
  } catch {
    return { status: null, ms: Date.now() - t, body: "" };
  }
}

export function statusOf(r: Omit<HealthRow, "status" | "note">): HealthStatus {
  const pageOk = (s: number | null) => s === 200;
  if (!r.db_ok || !pageOk(r.home_status) || !pageOk(r.catalogue_status) || (r.pdp_path && !pageOk(r.pdp_status))) return "down";
  const slow =
    (r.db_ms ?? 0) > SLOW_DB_MS || (r.home_ms ?? 0) > SLOW_PAGE_MS || (r.catalogue_ms ?? 0) > SLOW_PAGE_MS || (r.pdp_ms ?? 0) > SLOW_PAGE_MS || !r.auth_ok;
  return slow ? "slow" : "ok";
}

export function noteOf(r: Omit<HealthRow, "note">): string | null {
  const bits: string[] = [];
  const page = (label: string, status: number | null, ms: number | null) => {
    if (status !== 200) bits.push(`${label} ${status == null ? "no response" : `HTTP ${status}`}`);
    else if ((ms ?? 0) > SLOW_PAGE_MS) bits.push(`${label} ${((ms ?? 0) / 1000).toFixed(1)} s`);
  };
  if (!r.db_ok) bits.push(r.db_ms != null && r.db_ms >= LIMIT_MS ? "database timed out" : "database unreachable");
  else if ((r.db_ms ?? 0) > SLOW_DB_MS) bits.push(`database ${((r.db_ms ?? 0) / 1000).toFixed(1)} s`);
  if (!r.auth_ok) bits.push("auth unhealthy");
  page("home", r.home_status, r.home_ms);
  page("catalogue", r.catalogue_status, r.catalogue_ms);
  if (r.pdp_path) page("product page", r.pdp_status, r.pdp_ms);
  return bits.length ? bits.join(", ") : null;
}

export async function runHealthCheck(): Promise<HealthRow> {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const sb = base && anon ? { apikey: anon, Authorization: `Bearer ${anon}` } : null;
  const pageHdr = { "user-agent": HEALTH_UA, accept: "text/html" };
  const none: Timing = { status: null, ms: 0, body: "" };

  // Database first: it also names the product page to test.
  const db = sb ? await timed(`${base}/rest/v1/products?select=id&is_active=eq.true&order=units_sold.desc.nullslast&limit=1`, { headers: sb }) : none;
  let pdpPath: string | null = null;
  try {
    const id = (JSON.parse(db.body || "[]") as { id?: string }[])[0]?.id;
    if (id) pdpPath = `/catalogue/${id}`;
  } catch { /* no product page this round */ }

  const [auth, home, cat, pdp] = await Promise.all([
    sb ? timed(`${base}/auth/v1/health`, { headers: sb }) : Promise.resolve(none),
    timed(`${SITE}/`, { headers: pageHdr }),
    timed(`${SITE}/catalogue`, { headers: pageHdr }),
    pdpPath ? timed(`${SITE}${pdpPath}`, { headers: pageHdr }) : Promise.resolve(none),
  ]);

  const partial = {
    at: new Date().toISOString(),
    db_ok: db.status === 200, db_ms: sb ? db.ms : null,
    auth_ok: auth.status === 200, auth_ms: sb ? auth.ms : null,
    home_status: home.status, home_ms: home.ms,
    catalogue_status: cat.status, catalogue_ms: cat.ms,
    pdp_status: pdpPath ? pdp.status : null, pdp_ms: pdpPath ? pdp.ms : null, pdp_path: pdpPath,
  };
  const status = statusOf(partial);
  return { ...partial, status, note: noteOf({ ...partial, status }) };
}

/** Store the row (only possible when the database answers) and trim history. */
export async function recordHealth(row: HealthRow): Promise<void> {
  const db = adminClient();
  if (!db || !row.db_ok) return;
  try { await db.from("site_health_checks").insert(row); } catch { /* pre-0134 */ }
  if (new Date().getMinutes() < 5) {
    try { await db.from("site_health_checks").delete().lt("at", new Date(Date.now() - KEEP_DAYS * 86_400_000).toISOString()); } catch { /* best effort */ }
  }
}

type State = { last_ok_at: string | null; last_alert_at: string | null; failing_since: string | null };

/** Email the owner on trouble (15-minute cooldown) and once on recovery.
 *  While the database is down the cooldown state cannot be read, so the
 *  cron's five-minute cadence is bucketed to one mail per quarter hour. */
export async function alertOnHealth(row: HealthRow): Promise<string> {
  const db = adminClient();
  const now = Date.now();
  let state: State | null = null;
  if (db && row.db_ok) {
    try {
      const { data } = await db.from("site_health_state").select("last_ok_at, last_alert_at, failing_since").eq("singleton", true).maybeSingle();
      state = (data as State | null) ?? null;
    } catch { /* pre-0134 */ }
  }
  const save = async (patch: Partial<State>) => {
    if (!db || !row.db_ok) return;
    try { await db.from("site_health_state").upsert({ singleton: true, ...patch }); } catch { /* best effort */ }
  };

  if (row.status !== "ok") {
    const due = state
      ? !state.last_alert_at || now - Date.parse(state.last_alert_at) > ALERT_COOLDOWN_MS
      : new Date().getMinutes() % 15 < 5;
    if (!due) return `${row.status}, alert on cooldown`;
    const r = await sendHealthAlert({ kind: row.status, row, since: state?.failing_since ?? null });
    await save({ last_alert_at: new Date(now).toISOString(), failing_since: state?.failing_since ?? new Date(now).toISOString() });
    return r.ok ? `alert sent (${row.status})` : `alert failed: ${r.error ?? "unknown"}`;
  }

  let out = "ok";
  if (state) {
    const from = state.failing_since ? Date.parse(state.failing_since) : state.last_ok_at ? Date.parse(state.last_ok_at) : null;
    const wasDown = !!state.failing_since || (state.last_ok_at != null && now - Date.parse(state.last_ok_at) > RECOVERY_GAP_MS);
    if (wasDown && from) {
      const r = await sendHealthAlert({ kind: "recovered", row, since: new Date(from).toISOString() });
      out = r.ok ? "recovery mail sent" : `recovery mail failed: ${r.error ?? "unknown"}`;
    }
  }
  await save({ last_ok_at: new Date(now).toISOString(), failing_since: null, last_alert_at: null });
  return out;
}

export type HealthSummary = {
  latest: HealthRow | null;
  rows: HealthRow[];
  uptime24h: number | null;
  uptime7d: number | null;
  incidents7d: number;
  p95: { db: number | null; home: number | null; pdp: number | null };
};

export async function loadHealthSummary(): Promise<HealthSummary> {
  const empty: HealthSummary = { latest: null, rows: [], uptime24h: null, uptime7d: null, incidents7d: 0, p95: { db: null, home: null, pdp: null } };
  const db = adminClient();
  if (!db) return empty;
  try {
    const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
    const { data } = await db.from("site_health_checks").select("*").gte("at", since).order("at", { ascending: false }).limit(2100);
    const rows = (data ?? []) as HealthRow[];
    if (!rows.length) return empty;
    const dayAgo = Date.now() - 86_400_000;
    const last24 = rows.filter((r) => Date.parse(r.at) >= dayAgo);
    const up = (list: HealthRow[]) => (list.length ? Math.round((1000 * list.filter((r) => r.status !== "down").length) / list.length) / 10 : null);
    let incidents = 0;
    for (let i = rows.length - 1; i >= 0; i--) {
      const prev = rows[i + 1];
      if (rows[i].status === "down" && (!prev || prev.status !== "down")) incidents++;
    }
    const p95 = (pick: (r: HealthRow) => number | null) => {
      const v = last24.map(pick).filter((x): x is number => x != null).sort((a, b) => a - b);
      return v.length ? v[Math.min(v.length - 1, Math.floor(v.length * 0.95))] : null;
    };
    return { latest: rows[0], rows, uptime24h: up(last24), uptime7d: up(rows), incidents7d: incidents, p95: { db: p95((r) => r.db_ms), home: p95((r) => r.home_ms), pdp: p95((r) => r.pdp_ms) } };
  } catch {
    return empty;
  }
}
