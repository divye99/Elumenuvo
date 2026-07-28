/**
 * Indian mobile numbers — one rule, used by the checkout form AND the server.
 *
 * The old rule was /^[0-9+\-\s]{8,15}$/, i.e. "between 8 and 15 characters".
 * A 9-digit number sailed through it, and at least one real order was created
 * with an uncontactable number: we could not call the customer about their own
 * delivery. A mobile here is exactly 10 digits starting 6-9, optionally written
 * with +91, 91 or a leading 0, and with spaces or dashes anywhere.
 */

/** Strip formatting and any +91 / 91 / 0 prefix, leaving the 10 national digits. */
export function normalizeIndianMobile(raw: string): string | null {
  const digits = (raw ?? "").replace(/[^\d]/g, "");
  const national =
    digits.length === 12 && digits.startsWith("91") ? digits.slice(2) :
    digits.length === 11 && digits.startsWith("0") ? digits.slice(1) :
    digits;
  return /^[6-9]\d{9}$/.test(national) ? national : null;
}

export function isValidIndianMobile(raw: string): boolean {
  return normalizeIndianMobile(raw) !== null;
}

/** Why a number was rejected, phrased for the person typing it. */
export function mobileError(raw: string): string | null {
  const digits = (raw ?? "").replace(/[^\d]/g, "");
  if (!digits) return "Please enter your mobile number - the courier needs it for delivery.";
  if (isValidIndianMobile(raw)) return null;
  const national =
    digits.length === 12 && digits.startsWith("91") ? digits.slice(2) :
    digits.length === 11 && digits.startsWith("0") ? digits.slice(1) :
    digits;
  if (national.length < 10) return `That's only ${national.length} digit${national.length === 1 ? "" : "s"} - an Indian mobile number has 10.`;
  if (national.length > 10) return `That's ${national.length} digits - an Indian mobile number has 10.`;
  return "Please check the mobile number - Indian mobile numbers start with 6, 7, 8 or 9.";
}
