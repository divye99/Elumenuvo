/**
 * Signed sandbox cookie. Holds only the sandbox org id + expiry, HMAC-signed so
 * a visitor can't point themselves at another org. No Supabase Auth needed for
 * trials — the cookie *is* the trial identity.
 */
import { createHmac, timingSafeEqual } from "crypto";

export const SANDBOX_COOKIE = "elume_sandbox";
export const SANDBOX_TTL_MS = 24 * 60 * 60 * 1000; // 24h

const secret =
  process.env.SANDBOX_COOKIE_SECRET || "dev-only-insecure-sandbox-secret-change-me";

function sign(payload: string) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

/** Returns the cookie value for a sandbox org valid until `exp` (epoch ms). */
export function makeSandboxToken(orgId: string, exp: number): string {
  const payload = `${orgId}.${exp}`;
  return `${payload}.${sign(payload)}`;
}

/** Verifies a cookie value; returns the orgId if valid + unexpired, else null. */
export function readSandboxToken(value: string | undefined): string | null {
  if (!value) return null;
  const parts = value.split(".");
  if (parts.length !== 3) return null;
  const [orgId, expStr, sig] = parts;
  const expected = sign(`${orgId}.${expStr}`);
  // Constant-time compare to avoid signature-guessing.
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < Date.now()) return null;
  return orgId;
}
