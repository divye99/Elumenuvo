/**
 * Pincode geocoding - offline, zero-dependency, server-only.
 *
 * pincodes.json maps every Indian pincode (19,238 of them) to its centroid
 * [lat, lng], built from the GeoNames postal dataset (post-office points
 * averaged per pincode, 3-decimal precision ~ 100 m). No network call, no
 * API key, no rate limit - it scales to every quote we ever log.
 *
 * Used by the courier rate-intelligence pipeline: every quote records the
 * straight-line distance from the pickup warehouse to the delivery pincode,
 * so pricing can be analysed per km and per lane. Straight-line (haversine)
 * is deliberate - road distance needs a paid routing API and adds nothing
 * for comparing couriers on the SAME lane.
 *
 * Import from server code only: the JSON is ~500 KB and must never enter a
 * client bundle.
 */
import PINCODES from "@/lib/geo/pincodes.json";

const table = PINCODES as unknown as Record<string, [number, number]>;

export function geocodePin(pin: string | null | undefined): [number, number] | null {
  if (!pin) return null;
  const p = String(pin).trim();
  return /^\d{6}$/.test(p) ? table[p] ?? null : null;
}

/** Great-circle distance in km between two [lat, lng] points. */
export function haversineKm(a: [number, number], b: [number, number]): number {
  const R = 6371;
  const dLat = ((b[0] - a[0]) * Math.PI) / 180;
  const dLng = ((b[1] - a[1]) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a[0] * Math.PI) / 180) * Math.cos((b[0] * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** Distance in km between two pincodes, or null when either is unknown. */
export function pinDistanceKm(fromPin: string | null | undefined, toPin: string | null | undefined): number | null {
  const a = geocodePin(fromPin);
  const b = geocodePin(toPin);
  if (!a || !b) return null;
  return Math.round(haversineKm(a, b));
}
