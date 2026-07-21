/**
 * Admin auth — a signed httpOnly cookie gate (no Supabase Auth needed).
 * Login checks ADMIN_PASSWORD; the cookie is HMAC-signed with SANDBOX_COOKIE_SECRET.
 */
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createHmac, timingSafeEqual } from "crypto";

export const ADMIN_COOKIE = "elume_admin";
export const ADMIN_TTL_MS = 12 * 60 * 60 * 1000; // 12h

// Fail CLOSED: without the signing secret, admin tokens can neither be
// minted nor verified — nobody gets in, instead of everybody.
const secret = (process.env.SANDBOX_COOKIE_SECRET || "").trim();

function sign(payload: string) {
  if (!secret) throw new Error("SANDBOX_COOKIE_SECRET is not set — admin auth disabled.");
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function makeAdminToken(exp: number): string {
  const payload = `admin.${exp}`;
  return `${payload}.${sign(payload)}`;
}

export function readAdminToken(value: string | undefined): boolean {
  if (!value || !secret) return false;
  const parts = value.split(".");
  if (parts.length !== 3) return false;
  const [a, expStr, sig] = parts;
  const expected = sign(`${a}.${expStr}`);
  const ab = Buffer.from(sig);
  const bb = Buffer.from(expected);
  if (ab.length !== bb.length || !timingSafeEqual(ab, bb)) return false;
  const exp = Number(expStr);
  return Number.isFinite(exp) && exp >= Date.now();
}

export async function isAdmin(): Promise<boolean> {
  return readAdminToken((await cookies()).get(ADMIN_COOKIE)?.value);
}

/** Redirect to the admin login if not authenticated. */
export async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) redirect("/admin/login");
}
