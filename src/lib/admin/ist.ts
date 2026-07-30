/**
 * IST date formatting for the admin.
 *
 * Admin pages render on Vercel, which runs in UTC, so a bare
 * toLocaleString("en-IN") shows UTC times to an Indian operator. Pinning the
 * timeZone makes every admin timestamp read as IST regardless of where it
 * renders (server or client), so a 10:12 pm order stays 10:12 pm.
 */
const TZ = "Asia/Kolkata";

/** "17 Jul, 10:12 pm" */
export const istDateTime = (v?: string | Date | null): string =>
  v ? new Date(v).toLocaleString("en-IN", { timeZone: TZ, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "–";

/** "17 Jul" */
export const istDate = (v?: string | Date | null): string =>
  v ? new Date(v).toLocaleDateString("en-IN", { timeZone: TZ, day: "numeric", month: "short" }) : "–";

/** "10:12:07 pm" */
export const istTime = (v?: string | Date | null): string =>
  v ? new Date(v).toLocaleTimeString("en-IN", { timeZone: TZ, hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "–";

/** "2026-07-28" - the IST calendar day, safe to use as a bucket key. */
export const istDayKey = (v: string | Date): string => {
  const d = new Date(v);
  // en-CA gives ISO-ordered y-m-d, so no manual padding is needed.
  return d.toLocaleDateString("en-CA", { timeZone: TZ });
};

/** "Tue" */
export const istWeekday = (v: string | Date): string =>
  new Date(v).toLocaleDateString("en-IN", { timeZone: TZ, weekday: "short" });

/** The IST day key N days before the given day key. */
export const shiftDayKey = (key: string, deltaDays: number): string => {
  const [y, m, d] = key.split("-").map(Number);
  const t = Date.UTC(y, m - 1, d) + deltaDays * 86_400_000;
  const dt = new Date(t);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
};
