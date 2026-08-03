/**
 * GSTIN inspection, done offline.
 *
 * A GSTIN is self-describing and self-checking, so a great deal can be
 * verified without calling anyone:
 *
 *   ┌── 2 ──┬───────── 10 ─────────┬─ 1 ─┬─ 1 ─┬─ 1 ─┐
 *   │ state │         PAN          │ ent │  Z  │ chk │
 *   └───────┴──────────────────────┴─────┴─────┴─────┘
 *
 *   1-2   state code (01-38, plus 97 "other territory", 99 centre)
 *   3-12  the holder's PAN (AAAAA9999A)
 *   13    entity number for that PAN within the state (1-9, A-Z)
 *   14    'Z' by convention for a normal taxpayer
 *   15    check digit, computed over the first 14 characters
 *
 * The check digit means a mistyped GSTIN is caught immediately, for free, with
 * no API and no key. The state code also tells us the place of supply, so the
 * State field can fill itself in.
 *
 * What this canNOT do is tell you the registered legal name of the business.
 * There is no free, official, machine-readable endpoint for that: the GST
 * portal's own search is captcha-gated, and the GSTN's real API is only
 * reachable through a licensed GSP. `lookupGstinName` below is the seam for a
 * paid provider; without a key configured it simply reports "unavailable" so
 * everything else keeps working.
 */

/** State/UT by GST state code (first two digits of a GSTIN). */
export const GST_STATE_BY_CODE: Record<string, string> = {
  "01": "Jammu and Kashmir", "02": "Himachal Pradesh", "03": "Punjab", "04": "Chandigarh",
  "05": "Uttarakhand", "06": "Haryana", "07": "Delhi", "08": "Rajasthan", "09": "Uttar Pradesh",
  "10": "Bihar", "11": "Sikkim", "12": "Arunachal Pradesh", "13": "Nagaland", "14": "Manipur",
  "15": "Mizoram", "16": "Tripura", "17": "Meghalaya", "18": "Assam", "19": "West Bengal",
  "20": "Jharkhand", "21": "Odisha", "22": "Chhattisgarh", "23": "Madhya Pradesh",
  "24": "Gujarat", "25": "Daman and Diu", "26": "Dadra and Nagar Haveli and Daman and Diu",
  "27": "Maharashtra", "28": "Andhra Pradesh", "29": "Karnataka", "30": "Goa",
  "31": "Lakshadweep", "32": "Kerala", "33": "Tamil Nadu", "34": "Puducherry",
  "35": "Andaman and Nicobar Islands", "36": "Telangana", "37": "Andhra Pradesh",
  "38": "Ladakh", "97": "Other Territory", "99": "Centre Jurisdiction",
};

const ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const SHAPE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z][A-Z][0-9A-Z]$/;

/**
 * The GSTIN check digit. Each of the first 14 characters is converted to its
 * position in 0-9A-Z, multiplied by 1 or 2 alternating, and the quotient and
 * remainder of that product against 36 are summed. The check digit is what
 * takes that sum up to the next multiple of 36.
 */
export function gstinCheckDigit(first14: string): string | null {
  if (first14.length !== 14) return null;
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const v = ALPHABET.indexOf(first14[i]);
    if (v < 0) return null;
    const p = v * (i % 2 === 0 ? 1 : 2);
    sum += Math.floor(p / 36) + (p % 36);
  }
  return ALPHABET[(36 - (sum % 36)) % 36];
}

export type GstinCheck = {
  /** Nothing typed yet: show no feedback at all. */
  empty: boolean;
  /** Passed shape, state code and check digit. */
  valid: boolean;
  /** Present when invalid: what specifically is wrong. */
  error?: string;
  /** Derived facts, present once valid. */
  state?: string;
  stateCode?: string;
  pan?: string;
};

/** Validate a GSTIN and pull out what it tells us. Pure and synchronous. */
export function inspectGstin(raw: string | null | undefined): GstinCheck {
  const g = (raw ?? "").toUpperCase().replace(/\s/g, "");
  if (!g) return { empty: true, valid: false };
  if (g.length < 15) return { empty: false, valid: false, error: `GSTIN is 15 characters (${g.length} so far).` };
  if (g.length > 15) return { empty: false, valid: false, error: "GSTIN is 15 characters." };
  if (!SHAPE.test(g)) return { empty: false, valid: false, error: "That does not look like a GSTIN. The format is 2 digits, then a 10-character PAN, then 3 more." };

  const stateCode = g.slice(0, 2);
  const state = GST_STATE_BY_CODE[stateCode];
  if (!state) return { empty: false, valid: false, error: `${stateCode} is not a valid GST state code.` };

  const expected = gstinCheckDigit(g.slice(0, 14));
  if (!expected || expected !== g[14]) {
    return { empty: false, valid: false, error: "This GSTIN fails its check digit, so there is a typo somewhere in it." };
  }
  return { empty: false, valid: true, state, stateCode, pan: g.slice(2, 12) };
}

/**
 * Registered legal name for a GSTIN, via a third-party GST lookup provider.
 *
 * Deliberately env-gated and failure-tolerant: no key configured means
 * "unavailable", never an error the customer has to deal with. Set
 * GSTIN_LOOKUP_URL to an endpoint that takes ?gstin= and returns JSON, and
 * GSTIN_LOOKUP_KEY for its bearer token.
 */
export async function lookupGstinName(gstin: string): Promise<{ ok: true; legalName: string; tradeName?: string } | { ok: false; reason: "unconfigured" | "not-found" | "error" }> {
  const url = (process.env.GSTIN_LOOKUP_URL || "").trim();
  const key = (process.env.GSTIN_LOOKUP_KEY || "").trim();
  if (!url) return { ok: false, reason: "unconfigured" };
  if (!inspectGstin(gstin).valid) return { ok: false, reason: "not-found" };
  try {
    const res = await fetch(`${url}${url.includes("?") ? "&" : "?"}gstin=${encodeURIComponent(gstin)}`, {
      headers: key ? { Authorization: `Bearer ${key}` } : {},
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return { ok: false, reason: res.status === 404 ? "not-found" : "error" };
    const j = (await res.json()) as Record<string, unknown>;
    // Providers disagree on field names; accept the common spellings.
    const legal = (j.legal_name ?? j.legalName ?? j.lgnm ?? j.name) as string | undefined;
    const trade = (j.trade_name ?? j.tradeName ?? j.tradeNam ?? j.tradenam) as string | undefined;
    if (!legal) return { ok: false, reason: "not-found" };
    return { ok: true, legalName: String(legal), ...(trade ? { tradeName: String(trade) } : {}) };
  } catch {
    return { ok: false, reason: "error" };
  }
}
