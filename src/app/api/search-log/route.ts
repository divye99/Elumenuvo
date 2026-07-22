import { NextResponse } from "next/server";
import { adminClient } from "@/lib/supabase/admin";
import { rateLimited, requestIp } from "@/lib/rate-limit";

/**
 * Fire-and-forget search logging (see migration 0047). Called via
 * navigator.sendBeacon from the storefront, so it must always answer fast and
 * never surface an error to the shopper: every failure path is a silent 204.
 * Writes with the service role; the table has no anon policies.
 */

export const runtime = "nodejs";

const ok = () => new NextResponse(null, { status: 204 });

export async function POST(request: Request) {
  if (rateLimited(`slog:${requestIp(request.headers)}`, 40, 60_000)) return new Response(null, { status: 204 });
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return ok();
  }

  const q = String(body.q ?? "").trim().slice(0, 120);
  const source = body.source === "suggest" ? "suggest" : "search";
  if (q.length < 2) return ok();

  const db = adminClient();
  if (!db) return ok(); // local dev without the service key: logging is off

  const results = Number.isFinite(Number(body.results)) ? Math.max(0, Math.min(100000, Math.round(Number(body.results)))) : null;
  const picked = body.picked ? String(body.picked).slice(0, 160) : null;
  const category = body.cat ? String(body.cat).slice(0, 60) : null;
  const session = body.sid ? String(body.sid).slice(0, 40) : null;

  try {
    await db.from("search_queries").insert({
      query: q,
      normalized: q.toLowerCase().replace(/\s+/g, " "),
      source,
      results: source === "search" ? results : null,
      picked: source === "suggest" ? picked : null,
      category,
      session_id: session,
    });
  } catch {
    /* the log must never break search */
  }
  return ok();
}
