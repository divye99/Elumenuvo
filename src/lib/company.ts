/**
 * Business identity — one source of truth for the footer, the About/Contact
 * pages and the Organization structured data.
 *
 * Google's Merchant Center "Misrepresentation" check looks for a real,
 * reachable business: a legal name, a postal address, more than one way to
 * contact you, and published policies. Anything left blank below is simply
 * not rendered, so filling these in is what closes the gap.
 *
 * FILL THESE IN (they are deliberately empty rather than guessed):
 *   registeredAddress, cin, gstin
 */
export const COMPANY = {
  legalName: "Elume Nuvotech Private Limited",
  tradingName: "Elume",
  email: "info@elumenuvo.com",
  phone: "+919818821175",
  phoneDisplay: "+91 98188 21175",
  /** Support hours, shown on Contact. */
  hours: "Monday to Saturday, 10:00 to 19:00 IST",
  /** Registered office. REQUIRED by the misrepresentation check — a business
   *  with no address on the site reads as anonymous. e.g.
   *  { line1: "…", line2: "…", city: "New Delhi", state: "Delhi", pin: "110001" } */
  registeredAddress: null as null | { line1: string; line2?: string; city: string; state: string; pin: string },
  /** Corporate Identity Number from the certificate of incorporation. */
  cin: "",
  /** GST registration number. */
  gstin: "",
  country: "India",
} as const;

/** Address as one line, or null when it has not been filled in yet. */
export function addressLine(): string | null {
  const a = COMPANY.registeredAddress;
  if (!a) return null;
  return [a.line1, a.line2, a.city, `${a.state} ${a.pin}`, COMPANY.country].filter(Boolean).join(", ");
}

/** schema.org PostalAddress, or undefined when the address is not set. */
export function postalAddress() {
  const a = COMPANY.registeredAddress;
  if (!a) return undefined;
  return {
    "@type": "PostalAddress",
    streetAddress: [a.line1, a.line2].filter(Boolean).join(", "),
    addressLocality: a.city,
    addressRegion: a.state,
    postalCode: a.pin,
    addressCountry: "IN",
  };
}
