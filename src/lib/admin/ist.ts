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
