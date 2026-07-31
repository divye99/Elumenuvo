/**
 * Business identity - one source of truth for the footer, the About / Contact /
 * Shipping / Returns pages and the Organization structured data.
 *
 * Google's Merchant Center "Misrepresentation" check looks for a real,
 * reachable business: a legal name, a registered address, a company number,
 * more than one way to make contact, and published policies. Everything below
 * is rendered wherever it is relevant, so this file is the only place any of it
 * needs to change.
 */

type Office = {
  label: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pin: string;
};

export const COMPANY = {
  legalName: "Elume Nuvotech Private Limited",
  tradingName: "Elume",
  email: "info@elumenuvo.com",
  phone: "+919818821175",
  phoneDisplay: "+91 98188 21175",
  /** Support availability, shown on Contact and in the Organization markup. */
  hours: "Open 24 hours, every day",
  /** schema.org opening-hours shorthand for round-the-clock availability. */
  hoursSpec: "Mo-Su 00:00-23:59",
  /** Registered office. Returns and all postal correspondence go here. */
  registeredOffice: {
    label: "Registered office",
    line1: "Atarpura Cholpla, Garh Road",
    city: "Hapur",
    state: "Uttar Pradesh",
    pin: "245101",
  } as Office,
  /** Second working location. */
  additionalOffice: {
    label: "Additional office",
    line1: "C-20, 1/1A, Coast Guard Golf Ground Road",
    line2: "C Block, Phase 2, Industrial Area, Sector 62",
    city: "Noida",
    state: "Uttar Pradesh",
    pin: "201309",
  } as Office,
  /** Corporate Identity Number from the certificate of incorporation. */
  cin: "U27320UP2026PTC243960",
  /** GST registration number - add once available. */
  gstin: "",
  country: "India",
} as const;

/** Live social profiles - shown in the footer and mirrored in the
 *  Organization `sameAs` markup (lib/seo.ts). */
export const SOCIALS = [
  { name: "Facebook", href: "https://www.facebook.com/profile.php?id=61592404302026" },
  { name: "Instagram", href: "https://www.instagram.com/elumenuvo/" },
  { name: "YouTube", href: "https://www.youtube.com/@ElumeNuvo" },
] as const;

/** An office as a single line of text. */
export function officeLine(o: Office): string {
  return [o.line1, o.line2, o.city, `${o.state} ${o.pin}`, COMPANY.country].filter(Boolean).join(", ");
}

/** The registered office as one line (used in the footer and Returns). */
export function addressLine(): string {
  return officeLine(COMPANY.registeredOffice);
}

/** schema.org PostalAddress for an office. */
export function postalAddressOf(o: Office) {
  return {
    "@type": "PostalAddress",
    streetAddress: [o.line1, o.line2].filter(Boolean).join(", "),
    addressLocality: o.city,
    addressRegion: o.state,
    postalCode: o.pin,
    addressCountry: "IN",
  };
}

/** The registered office in schema.org form - the address Google looks for. */
export function postalAddress() {
  return postalAddressOf(COMPANY.registeredOffice);
}
