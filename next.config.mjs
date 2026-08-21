/** @type {import('next').NextConfig} */

/**
 * Short outreach links.
 *
 * Phase 2 of outreach is hand-sent on LinkedIn, WhatsApp and website contact
 * forms. A raw UTM URL pasted into a two-line personal message reads as a mass
 * campaign and kills the tone that makes those channels work, so each channel
 * gets a short path that expands to the tracked URL on the way through.
 *
 *   /li            -> LinkedIn, campaign level
 *   /li/bhutani    -> LinkedIn, attributed to that firm (utm_content)
 *   /wa , /wa/:who -> WhatsApp
 *   /hi , /hi/:who -> website contact forms and anything else typed by hand
 *
 * `utm_medium=outreach` is what the admin analytics "Cold outreach only"
 * filter keys on, and utm_content is what the Email outreach tab uses to name
 * the firm, so these land in the same reporting as the August email batch.
 * Use the roster slug from src/lib/admin/outreach-roster.ts as :who when the
 * firm is on it, so both channels aggregate to one company.
 *
 * 307, not 308: these are marketing links whose destination will change, and a
 * permanent redirect would sit in browser caches forever.
 */
const CHANNELS = [
  ["li", "linkedin"],
  ["wa", "whatsapp"],
  ["hi", "direct"],
];

const outreachRedirects = CHANNELS.flatMap(([path, source]) => [
  {
    source: `/${path}`,
    destination: `/?utm_source=${source}&utm_medium=outreach&utm_campaign=phase2-${source}`,
    permanent: false,
  },
  {
    source: `/${path}/:who`,
    destination: `/?utm_source=${source}&utm_medium=outreach&utm_campaign=phase2-${source}&utm_content=:who`,
    permanent: false,
  },
]);

const nextConfig = {
  // Pin the workspace root to this project (a stray lockfile in the home
  // directory otherwise makes Next infer the wrong root).
  turbopack: { root: import.meta.dirname },
  async redirects() {
    return [
      ...outreachRedirects,
      // Smart BOM and the quotation exporter were removed on 21 Aug 2026;
      // four business customers still hold the invite link.
      { source: "/app/boq", destination: "/bulk-enquiry", permanent: false },
      { source: "/admin/boq", destination: "/admin/orders/new", permanent: false },
      { source: "/admin/quotation", destination: "/admin/orders/new", permanent: false },
    ];
  },
};

export default nextConfig;
