import { adminClient } from "@/lib/supabase/admin";
import { sendHealthAlert } from "@/lib/email";

/**
 * Uptime monitor (owner, 21 Aug 2026). Runs from /api/cron/health once an
 * hour (CHECK_INTERVAL_MS; the recovery heuristic is derived from it, change
 * both together) and from the "Check now" button on /admin/health. One run:
 *   - times the database through PostgREST and picks the product page to
 *     test (the best-selling active product, deterministic tiebreak, so a
 *     deactivated SKU never raises a false alarm; HEALTH_PDP_ID pins it),
 *   - times Supabase Auth,
 *   - fetches the home page, the catalogue page and that product page as a
 *     self-identified monitor (the edge bouncer lets monitors through; if
 *     Vercel Bot Protection is ever set to Challenge, add a Bypass rule for
 *     the ElumeHealthMonitor user agent or every page reads HTTP 403).
 * Verdict: "down" when the database or any page fails, "slow" when a page
 * takes over SLOW_PAGE_MS or the database over SLOW_DB_MS (or auth is
 * unhealthy), else "ok".
 *
 * Alerts: "down" mails every scheduled run while it lasts, "slow" mails once
 * per episode, then one "recovered" mail (only if an alert actually went
 * out). When the database itself is down nothing can be stored, so the run
 * keeps its rows and state in memory, flushes them on the first healthy run,
 * and if the instance was cold meanwhile reconstructs one "down" row from
 * the gap so uptime and incidents still count the outage.
 *
 * Every database call inside the monitor carries its own short abort
 * (DB_OP_MS), never the general 60 s ceiling: the alert must go out inside
 * the cron's budget even when the database is flapping.
 *
 * Limit worth knowing: this runs ON Vercel. If Vercel itself is down, no
 * check runs; an outside checker (UptimeRobot or similar) covers that case.
 */
export type HealthStatus = "ok" | "slow" | "down";
export type HealthRow = {
  id?: number;
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
const DB_OP_MS = 8_000;
export const SLOW_PAGE_MS = 8_000;
export const SLOW_DB_MS = 3_000;
export const CHECK_INTERVAL_MS = 60 * 60_000;
const ALERT_COOLDOWN_MS = CHECK_INTERVAL_MS - 10 * 60_000;
export const RECOVERY_GAP_MS = Math.round(CHECK_INTERVAL_MS * 2.5);
const KEEP_DAYS = 7;

/** In-memory fallback for the minutes or hours when the database cannot
 *  store anything. Survives only within a warm instance; a cold instance
 *  after an outage falls back to the last_ok_at gap (see alertOnHealth). */
const pendingRows: HealthRow[] = [];
let memFailingSince: string | null = null;
let memLastAlertAt: string | null = null;

type Timing = { status: number | null; ms: number; body: string };
const none: Timing = { status: null, ms: 0, body: "" };

function shortSignal(ms = DB_OP_MS): AbortSignal {
  const ctl = new AbortController();
  setTimeout(() => ctl.abort(), ms);
  return ctl.signal;
}

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

type Measured = Omit<HealthRow, "status" | "note"> & { db_status: number | null };

export function statusOf(r: Omit<HealthRow, "status" | "note">): HealthStatus {
  const pageOk = (s: number | null) => s === 200;
  if (!r.db_ok || !pageOk(r.home_status) || !pageOk(r.catalogue_status) || (r.pdp_path && !pageOk(r.pdp_status))) return "down";
  const slow =
    (r.db_ms ?? 0) > SLOW_DB_MS || (r.home_ms ?? 0) > SLOW_PAGE_MS || (r.catalogue_ms ?? 0) > SLOW_PAGE_MS || (r.pdp_ms ?? 0) > SLOW_PAGE_MS || !r.auth_ok;
  return slow ? "slow" : "ok";
}

function noteOf(r: Measured): string | null {
  const bits: string[] = [];
  const page = (label: string, status: number | null, ms: number | null) => {
    if (status !== 200) bits.push(`${label} ${status == null ? "no response" : `HTTP ${status}`}`);
    else if ((ms ?? 0) > SLOW_PAGE_MS) bits.push(`${label} ${((ms ?? 0) / 1000).toFixed(1)} s`);
  };
  if (!r.db_ok) {
    bits.push(r.db_status != null ? `database HTTP ${r.db_status}` : r.db_ms != null && r.db_ms >= LIMIT_MS ? "database timed out" : "database unreachable");
  } else if ((r.db_ms ?? 0) > SLOW_DB_MS) bits.push(`database ${((r.db_ms ?? 0) / 1000).toFixed(1)} s`);
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

  // Database first: it also names the product page to test.
  const pinned = (process.env.HEALTH_PDP_ID || "").trim();
  const dbQuery = pinned
    ? `${base}/rest/v1/products?select=id&id=eq.${encodeURIComponent(pinned)}&limit=1`
    : `${base}/rest/v1/products?select=id&is_active=eq.true&order=units_sold.desc.nullslast,id.asc&limit=1`;
  const db = sb ? await timed(dbQuery, { headers: sb }) : none;
  let pdpPath: string | null = null;
  try {
    const id = (JSON.parse(db.body || "[]") as { id?: string }[])[0]?.id;
    if (id) pdpPath = `/catalogue/${encodeURIComponent(id)}`;
  } catch { /* no product page this round */ }

  const [auth, home, cat, pdp] = await Promise.all([
    sb ? timed(`${base}/auth/v1/health`, { headers: sb }) : Promise.resolve(none),
    timed(`${SITE}/`, { headers: pageHdr }),
    timed(`${SITE}/catalogue`, { headers: pageHdr }),
    pdpPath ? timed(`${SITE}${pdpPath}`, { headers: pageHdr }) : Promise.resolve(none),
  ]);

  const measured: Measured = {
    at: new Date().toISOString(),
    db_ok: db.status === 200, db_ms: sb ? db.ms : null, db_status: db.status,
    auth_ok: auth.status === 200, auth_ms: sb ? auth.ms : null,
    home_status: home.status, home_ms: home.ms,
    catalogue_status: cat.status, catalogue_ms: cat.ms,
    pdp_status: pdpPath ? pdp.status : null, pdp_ms: pdpPath ? pdp.ms : null, pdp_path: pdpPath,
  };
  const { db_status: _omit, ...stored } = measured;
  void _omit;
  return { ...stored, status: statusOf(measured), note: noteOf(measured) };
}

/** Store the row (only possible when the database answers), flush anything
 *  held back during an outage, and trim history. */
export async function recordHealth(row: HealthRow): Promise<void> {
  const db = adminClient();
  if (!db || !row.db_ok) {
    if (pendingRows.length < 200) pendingRows.push(row);
    return;
  }
  try {
    const batch = [...pendingRows.splice(0, pendingRows.length), row];
    await db.from("site_health_checks").insert(batch).abortSignal(shortSignal());
  } catch { /* pre-0134 or transient; rows stay lost rather than blocking */ }
  try {
    await db.from("site_health_checks").delete().lt("at", new Date(Date.now() - KEEP_DAYS * 86_400_000).toISOString()).abortSignal(shortSignal());
  } catch { /* best effort */ }
}

type State = { last_ok_at: string | null; last_alert_at: string | null; failing_since: string | null };

/** Email the owner on trouble and once on recovery. See the header. */
export async function alertOnHealth(row: HealthRow): Promise<string> {
  const db = adminClient();
  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  let state: State | null = null;
  if (db && row.db_ok) {
    try {
      const { data, error } = await db.from("site_health_state").select("last_ok_at, last_alert_at, failing_since").eq("singleton", true).abortSignal(shortSignal()).maybeSingle();
      if (!error) state = (data as State | null) ?? null;
    } catch { /* pre-0134 or transient */ }
  }
  const failingSince = state?.failing_since ?? memFailingSince;
  const lastAlertAt = state?.last_alert_at ?? memLastAlertAt;
  const save = async (patch: Partial<State>) => {
    if ("failing_since" in patch) memFailingSince = patch.failing_since ?? null;
    if ("last_alert_at" in patch) memLastAlertAt = patch.last_alert_at ?? null;
    if (!db || !row.db_ok) return;
    try { await db.from("site_health_state").upsert({ singleton: true, ...patch }).abortSignal(shortSignal()); } catch { /* best effort */ }
  };

  if (row.status !== "ok") {
    if (!failingSince) await save({ failing_since: nowIso });
    const cooled = !lastAlertAt || now - Date.parse(lastAlertAt) > ALERT_COOLDOWN_MS;
    // "down" mails every scheduled run; "slow" mails once per episode.
    const due = row.status === "down" ? cooled : cooled && !failingSince;
    if (!due) return `${row.status}, no new mail`;
    const r = await sendHealthAlert({ kind: row.status, row, since: failingSince });
    if (r.ok) await save({ last_alert_at: nowIso });
    return r.ok ? `alert sent (${row.status})` : `alert failed: ${r.error ?? (r.skipped ? "email not configured" : "unknown")}`;
  }

  let out = "ok";
  const alerted = !!failingSince && !!lastAlertAt && Date.parse(lastAlertAt) >= Date.parse(failingSince);
  const gapFrom = state?.last_ok_at && now - Date.parse(state.last_ok_at) > RECOVERY_GAP_MS ? Date.parse(state.last_ok_at) : null;
  if (alerted) {
    const r = await sendHealthAlert({ kind: "recovered", row, since: failingSince });
    out = r.ok ? "recovery mail sent" : `recovery mail failed: ${r.error ?? "unknown"}`;
  } else if (gapFrom && !failingSince) {
    // The database was unreachable and a cold instance could store nothing:
    // reconstruct one "down" row for history and say so honestly.
    pendingRows.unshift({ ...row, at: new Date(gapFrom + 60_000).toISOString(), status: "down", db_ok: false, db_ms: null, note: "database unreachable (reconstructed on recovery)" });
    const r = await sendHealthAlert({ kind: "recovered", row, since: new Date(gapFrom).toISOString(), reconstructed: true });
    out = r.ok ? "recovery mail sent (reconstructed gap)" : `recovery mail failed: ${r.error ?? "unknown"}`;
  }
  await save({ last_ok_at: nowIso, failing_since: null });
  return out;
}

export type HealthSummary = {
  latest: HealthRow | null;
  rows: HealthRow[];
  uptime24h: number | null;
  uptime7d: number | null;
  incidents7d: number;
  p95: { db: number | null; home: number | null; pdp: number | null };
  error: string | null;
  alertsConfigured: boolean;
};

export async function loadHealthSummary(): Promise<HealthSummary> {
  const empty: HealthSummary = { latest: null, rows: [], uptime24h: null, uptime7d: null, incidents7d: 0, p95: { db: null, home: null, pdp: null }, error: null, alertsConfigured: !!process.env.RESEND_API_KEY };
  const db = adminClient();
  if (!db) return { ...empty, error: "service key missing" };
  try {
    const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
    const { data, error } = await db.from("site_health_checks").select("*").gte("at", since).order("at", { ascending: false }).limit(1000).abortSignal(shortSignal());
    if (error) return { ...empty, error: /schema cache|does not exist/i.test(error.message) ? "migration 0134 not run yet" : error.message };
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
    return { ...empty, latest: rows[0], rows, uptime24h: up(last24), uptime7d: up(rows), incidents7d: incidents, p95: { db: p95((r) => r.db_ms), home: p95((r) => r.home_ms), pdp: p95((r) => r.pdp_ms) } };
  } catch (e) {
    return { ...empty, error: e instanceof Error ? e.message : "could not read health history" };
  }
}
