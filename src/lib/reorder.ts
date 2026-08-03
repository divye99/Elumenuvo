import { COUNTRIES, DEFAULT_COUNTRY } from "@/lib/phone";

/**
 * Split a stored E.164 number back into the country + national parts the
 * checkout form uses. Shared by "buy it again" and anything else that has to
 * push a saved number back into that form.
 *
 * Longest dial code first, so "+971…" is not read as "+9…". Anything
 * unrecognised falls back to India with the digits left as typed, which the
 * form will then validate normally rather than silently dropping.
 */
export function splitE164ForDraft(stored: string): { iso: string; national: string } {
  const digits = (stored ?? "").replace(/\D/g, "");
  if (!digits) return { iso: DEFAULT_COUNTRY.iso, national: "" };
  const byLongestDial = [...COUNTRIES].sort((a, b) => b.dial.length - a.dial.length);
  for (const c of byLongestDial) {
    if (digits.startsWith(c.dial)) return { iso: c.iso, national: digits.slice(c.dial.length) };
  }
  return { iso: DEFAULT_COUNTRY.iso, national: digits };
}
