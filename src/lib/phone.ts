/**
 * Phone numbers - one rule, shared by the checkout form and the server.
 *
 * The old rule was /^[0-9+\-\s]{8,15}$/, i.e. "between 8 and 15 characters".
 * A 9-digit number sailed through it and an order was created with a number we
 * could not call. Now the country is picked explicitly and the national number
 * is length-checked against it: India is exactly 10 digits starting 6-9.
 *
 * Stored shape is E.164 ("+919818821175") so a number is never ambiguous about
 * which country it belongs to.
 */

export type Country = {
  /** ISO code, used as the <select> value. */
  iso: string;
  name: string;
  /** Dial code without the plus. */
  dial: string;
  /** Exact national length, or a [min, max] range. */
  digits: number | [number, number];
  /** Leading digits a valid national number may start with. */
  startsWith?: RegExp;
  example: string;
};

/** India first (we deliver only in India); the rest cover customers whose
 *  phone is registered abroad but who ship to an Indian address. */
export const COUNTRIES: Country[] = [
  { iso: "IN", name: "India", dial: "91", digits: 10, startsWith: /^[6-9]/, example: "98765 43210" },
  { iso: "AE", name: "United Arab Emirates", dial: "971", digits: [8, 9], example: "50 123 4567" },
  { iso: "US", name: "United States", dial: "1", digits: 10, example: "201 555 0123" },
  { iso: "GB", name: "United Kingdom", dial: "44", digits: [9, 10], example: "7400 123456" },
  { iso: "SG", name: "Singapore", dial: "65", digits: 8, example: "8123 4567" },
  { iso: "AU", name: "Australia", dial: "61", digits: 9, example: "412 345 678" },
  { iso: "CA", name: "Canada", dial: "1", digits: 10, example: "204 555 0123" },
  { iso: "SA", name: "Saudi Arabia", dial: "966", digits: 9, example: "51 234 5678" },
  { iso: "QA", name: "Qatar", dial: "974", digits: 8, example: "3312 3456" },
  { iso: "OM", name: "Oman", dial: "968", digits: 8, example: "9212 3456" },
  { iso: "KW", name: "Kuwait", dial: "965", digits: 8, example: "5012 3456" },
  { iso: "BH", name: "Bahrain", dial: "973", digits: 8, example: "3600 1234" },
  { iso: "NP", name: "Nepal", dial: "977", digits: 10, example: "98 1234 5678" },
  { iso: "BD", name: "Bangladesh", dial: "880", digits: 10, example: "1712 345678" },
  { iso: "LK", name: "Sri Lanka", dial: "94", digits: 9, example: "71 234 5678" },
  { iso: "MY", name: "Malaysia", dial: "60", digits: [9, 10], example: "12 345 6789" },
];

export const DEFAULT_COUNTRY = COUNTRIES[0]; // India

export function countryByIso(iso: string): Country {
  return COUNTRIES.find((c) => c.iso === iso) ?? DEFAULT_COUNTRY;
}

/** Longest allowed national length, for the input's maxLength. */
export function maxDigits(c: Country): number {
  return Array.isArray(c.digits) ? c.digits[1] : c.digits;
}

function lengthOk(c: Country, national: string): boolean {
  return Array.isArray(c.digits)
    ? national.length >= c.digits[0] && national.length <= c.digits[1]
    : national.length === c.digits;
}

/** Digits only, with any dial-code or trunk prefix stripped off the front. */
export function nationalDigits(raw: string, c: Country = DEFAULT_COUNTRY): string {
  let d = (raw ?? "").replace(/\D/g, "");
  if (d.startsWith(c.dial) && d.length > maxDigits(c)) d = d.slice(c.dial.length);
  if (d.startsWith("0") && d.length > maxDigits(c)) d = d.replace(/^0+/, "");
  return d;
}

export function isValidPhone(raw: string, c: Country = DEFAULT_COUNTRY): boolean {
  const n = nationalDigits(raw, c);
  return lengthOk(c, n) && (c.startsWith ? c.startsWith.test(n) : true);
}

/** E.164 for storage, e.g. "+919818821175". Null when the number is invalid. */
export function toE164(raw: string, c: Country = DEFAULT_COUNTRY): string | null {
  const n = nationalDigits(raw, c);
  return isValidPhone(raw, c) ? `+${c.dial}${n}` : null;
}

/**
 * E.164 from a raw string that may already carry its dial code, e.g. a number
 * pasted back out of the database or typed with "+91" in front. Longest dial
 * code first, so "+971…" is not mistaken for "+9…". Falls back to reading the
 * input as a bare Indian national number.
 */
export function normalisePhoneE164(raw: string): string | null {
  const digits = (raw ?? "").replace(/\D/g, "");
  if (!digits) return null;
  const byLongestDial = [...COUNTRIES].sort((a, b) => b.dial.length - a.dial.length);
  for (const c of byLongestDial) {
    if (digits.startsWith(c.dial)) {
      const hit = toE164(digits.slice(c.dial.length), c);
      if (hit) return hit;
    }
  }
  return toE164(digits, DEFAULT_COUNTRY);
}

/** Why a number was rejected, phrased for the person typing it. */
export function phoneError(raw: string, c: Country = DEFAULT_COUNTRY): string | null {
  const n = nationalDigits(raw, c);
  if (!n) return "Please enter your mobile number - the courier needs it for delivery.";
  if (isValidPhone(raw, c)) return null;
  const want = Array.isArray(c.digits) ? `${c.digits[0]} to ${c.digits[1]} digits` : `${c.digits} digits`;
  if (!lengthOk(c, n)) {
    return `That's ${n.length} digit${n.length === 1 ? "" : "s"} - a ${c.name} mobile number has ${want}.`;
  }
  return `Please check the number - ${c.name} mobile numbers start with 6, 7, 8 or 9.`;
}

/** Digits for a wa.me link: always country code + national, no plus. */
export function whatsappDigits(stored: string): string {
  const d = (stored ?? "").replace(/\D/g, "");
  // Legacy rows hold a bare 10-digit Indian number with no country code.
  return d.length === 10 ? `91${d}` : d;
}

// ── Back-compat aliases (older call sites) ──
export const isValidIndianMobile = (raw: string) => isValidPhone(raw, DEFAULT_COUNTRY);
export const normalizeIndianMobile = (raw: string) =>
  isValidPhone(raw, DEFAULT_COUNTRY) ? nationalDigits(raw, DEFAULT_COUNTRY) : null;
export const mobileError = (raw: string) => phoneError(raw, DEFAULT_COUNTRY);
