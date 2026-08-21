/** The "I am a person" pass (owner rule: never strand a real visitor).
 *
 *  A refused visitor can press a plain HTML button (no JavaScript needed);
 *  /api/bouncer-pass sets this cookie and sends them back where they were.
 *  The value is signed, so a scraper cannot simply type the cookie in:
 *  `<issuedMs>.<base64url HMAC-SHA256(secret, "pass.<issuedMs>")>`, valid
 *  for PASS_DAYS. Web Crypto only, so the same code verifies at the edge
 *  (src/proxy.ts) and signs in the Node route. */
export const PASS_COOKIE = "elume_pass";
export const PASS_DAYS = 30;

const enc = new TextEncoder();
const b64url = (buf: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

async function hmac(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(await crypto.subtle.sign("HMAC", key, enc.encode(payload)));
}

function secret(): string {
  return (process.env.SANDBOX_COOKIE_SECRET || "").trim();
}

export async function mintPass(now = Date.now()): Promise<string | null> {
  const s = secret();
  if (!s) return null;
  return `${now}.${await hmac(s, `pass.${now}`)}`;
}

export async function verifyPass(value: string | undefined, now = Date.now()): Promise<boolean> {
  const s = secret();
  if (!s || !value) return false;
  const [issuedStr, sig] = value.split(".");
  const issued = Number(issuedStr);
  if (!Number.isFinite(issued) || issued > now + 60_000 || now - issued > PASS_DAYS * 86_400_000) return false;
  const expected = await hmac(s, `pass.${issuedStr}`);
  if (expected.length !== (sig ?? "").length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  return diff === 0;
}
