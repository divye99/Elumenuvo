/**
 * The trade-outreach campaign roster: the 80 firms emailed from
 * info@elumenuvo.com on 3 August 2026.
 *
 * Attribution works two ways, because this first batch went out BEFORE
 * per-company link tagging existed:
 *   - `domain` matches an identified visitor's email domain back to the firm.
 *     This is the only per-company signal available for the August batch.
 *   - `utm_content` (the slug) is read when present, for future campaigns
 *     whose links carry it. See analytics "Email outreach".
 * `bounced` marks addresses the mail server rejected outright - those firms
 * never received anything, so silence from them means nothing.
 *
 * Contact details deliberately live OUTSIDE the repo (CSVs on the founder's
 * machine); this file holds only what the analytics view needs to put a name
 * against a session.
 */
export type OutreachCompany = { slug: string; company: string; segment: string; domain: string; bounced?: boolean };

export const OUTREACH_SENT_ON = "2026-08-03";

export const OUTREACH_ROSTER: OutreachCompany[] = [
  { slug: "iad-studio", company: "IAD Studio", segment: "architect", domain: "iadstudio.com" },
  { slug: "42mm-architecture", company: "42mm Architecture", segment: "architect", domain: "42mm.in" },
  { slug: "thd-design-studio", company: "THD Design Studio", segment: "architect", domain: "thddesignstudio.com" },
  { slug: "cadence-architects", company: "Cadence Architects", segment: "architect", domain: "cadencearchitects.com" },
  { slug: "delhi-electric", company: "Delhi Electric", segment: "contractor", domain: "delhielectric.com" },
  { slug: "vanshul-electricals", company: "Vanshul Electricals", segment: "contractor", domain: "vanshulelectricals.com" },
  { slug: "turnkey-electrical-engineers-pvt-ltd", company: "Turnkey Electrical Engineers Pvt Ltd", segment: "contractor", domain: "turnkeyengg.com" },
  { slug: "canscorp", company: "Canscorp", segment: "contractor", domain: "canscorp.com" },
  { slug: "expert-electrical-and-engineers", company: "Expert Electrical & Engineers", segment: "contractor", domain: "expertelectricals.com" },
  { slug: "balaji-engineers", company: "Balaji Engineers", segment: "contractor", domain: "balajiengineers.in" },
  { slug: "srinivasa-electricals", company: "Srinivasa Electricals", segment: "contractor", domain: "srinivasaelectricals.com" },
  { slug: "envigaurd-engineering-and-turnkey-projects-pvt-ltd", company: "Envigaurd Engineering and Turnkey Projects Pvt Ltd", segment: "contractor", domain: "envigaurd.com" },
  { slug: "pawan-electricals-and-civil-works", company: "Pawan Electricals & Civil Works", segment: "contractor", domain: "pawanelectricals.in" },
  { slug: "studio-interplay", company: "Studio Interplay", segment: "architect", domain: "studiointerplay.com" },
  { slug: "studio-a-i", company: "Studio a+i", segment: "architect", domain: "studioaplusi.com" },
  { slug: "envisage-architects", company: "Envisage Architects", segment: "architect", domain: "envisageprojects.in" },
  { slug: "spaces-architects-ka", company: "Spaces Architects@ka", segment: "architect", domain: "spacesarchitects-ka.com" },
  { slug: "sculpt-design-studio", company: "Sculpt Design Studio", segment: "architect", domain: "sculptdesignstudio.com" },
  { slug: "acasa-studios", company: "ACASA Studios", segment: "architect", domain: "acasastudios.in" },
  { slug: "urbanscape-architects", company: "Urbanscape Architects", segment: "architect", domain: "urbanscapearchitects.com" },
  { slug: "groupdca", company: "groupDCA", segment: "architect", domain: "groupdca.in" },
  { slug: "muselab", company: "MuseLAB", segment: "architect", domain: "muselab.in" },
  { slug: "designology", company: "Designology", segment: "architect", domain: "designology.co.in" },
  { slug: "studio-osmosis", company: "Studio Osmosis", segment: "architect", domain: "studioosmosis.com" },
  { slug: "quirk-studio", company: "Quirk Studio", segment: "architect", domain: "quirkstudio.in" },
  { slug: "khosla-associates", company: "Khosla Associates", segment: "architect", domain: "khoslaassociates.com" },
  { slug: "fadd-studio", company: "FADD Studio", segment: "architect", domain: "faddstudio.com" },
  { slug: "the-purple-ink-studio", company: "The Purple Ink Studio", segment: "architect", domain: "thepurpleinkstudio.com" },
  { slug: "ava-architects", company: "AVA Architects", segment: "architect", domain: "avaarchitects.in" },
  { slug: "4th-axis-design-studio", company: "4th Axis Design Studio", segment: "architect", domain: "4thaxis.in" },
  { slug: "dhiraj-bhumkar-architects", company: "Dhiraj Bhumkar Architects", segment: "architect", domain: "atelieroffice.com" },
  { slug: "charged-voids", company: "Charged Voids", segment: "architect", domain: "chargedvoids.in", bounced: true },
  { slug: "studio-ardete", company: "Studio Ardete", segment: "architect", domain: "studioardete.com" },
  { slug: "asd-studio", company: "ASD Studio", segment: "architect", domain: "asdstudio.in" },
  { slug: "prateek-group", company: "Prateek Group", segment: "builder", domain: "prateekgroup.com" },
  { slug: "purvanchal-projects", company: "Purvanchal Projects", segment: "builder", domain: "purvanchalprojects.com" },
  { slug: "panchsheel-group", company: "Panchsheel Group", segment: "builder", domain: "panchsheelgroup.com" },
  { slug: "svp-group", company: "SVP Group", segment: "builder", domain: "svpgroup.in" },
  { slug: "charms-india", company: "Charms India", segment: "builder", domain: "charmsindia.com" },
  { slug: "ashiana-homes", company: "Ashiana Homes", segment: "builder", domain: "ashianahomes.com" },
  { slug: "rishita-developers", company: "Rishita Developers", segment: "builder", domain: "rishitadevelopers.com" },
  { slug: "trimurty-builders", company: "Trimurty Builders", segment: "builder", domain: "trimurty.com" },
  { slug: "grace-electrical-and-contractors-pvt-ltd", company: "Grace Electrical & Contractors Pvt Ltd", segment: "contractor", domain: "gracemep.com" },
  { slug: "brilltech-engineers-pvt-ltd", company: "Brilltech Engineers Pvt Ltd", segment: "contractor", domain: "brilltech.co.in" },
  { slug: "daksh-enterprises", company: "Daksh Enterprises", segment: "contractor", domain: "thedakshenterprises.com" },
  { slug: "workforce-mep-services-pvt-ltd", company: "Workforce MEP Services Pvt Ltd", segment: "contractor", domain: "workforcencr.com" },
  { slug: "e-and-a-engineering-solutions-pvt-ltd", company: "E & A Engineering Solutions Pvt Ltd", segment: "contractor", domain: "eaengineeringsolutions.com" },
  { slug: "ms-elect-services", company: "MS Elect Services", segment: "contractor", domain: "mselectservices.com" },
  { slug: "radiant-info-solutions-pvt-ltd", company: "Radiant Info Solutions Pvt Ltd", segment: "contractor", domain: "radiant.in" },
  { slug: "sankhla-engineers", company: "Sankhla Engineers", segment: "contractor", domain: "sankhlaengineers.com" },
  { slug: "pr-mep-services", company: "PR MEP Services", segment: "contractor", domain: "prmeps.com" },
  { slug: "minj-electrical-contractors-pvt-ltd", company: "Minj Electrical Contractors Pvt Ltd", segment: "contractor", domain: "minjelectrical.in" },
  { slug: "shubham-engineering-mep-solutions-pvt-ltd", company: "Shubham Engineering MEP Solutions Pvt Ltd", segment: "contractor", domain: "theshubhameng.com" },
  { slug: "shreeraj-consultants-and-contractors", company: "ShreeRaj Consultants and Contractors", segment: "contractor", domain: "shreerajconsultants.com" },
  { slug: "asp-electricals-and-engineering-services", company: "ASP Electricals & Engineering Services", segment: "contractor", domain: "aspelectricals.in" },
  { slug: "mahalaxmi-electromech-pvt-ltd", company: "Mahalaxmi Electromech Pvt Ltd", segment: "contractor", domain: "mahalaxmielectromech.in", bounced: true },
  { slug: "vaibhav-electrics", company: "Vaibhav Electrics", segment: "contractor", domain: "vaibhavelectrics.com" },
  { slug: "sa-electricals", company: "SA Electricals", segment: "contractor", domain: "saelectricals.co.in" },
  { slug: "perfect-engineers", company: "Perfect Engineers", segment: "contractor", domain: "perfectengineer.in" },
  { slug: "paradigm-integrated-facility-management-services-pvt-ltd", company: "Paradigm Integrated Facility Management Services Pvt Ltd", segment: "contractor", domain: "paradigmfms.com" },
  { slug: "universal-enterprises", company: "Universal Enterprises", segment: "contractor", domain: "universalmincon.com" },
  { slug: "v3-electricals-pvt-ltd", company: "V3 Electricals Pvt Ltd", segment: "contractor", domain: "v3electricals.com" },
  { slug: "gulshan-group", company: "Gulshan Group", segment: "builder", domain: "gulshangroup.com" },
  { slug: "county-group", company: "County Group", segment: "builder", domain: "countygroup.in" },
  { slug: "exotica-housing", company: "Exotica Housing", segment: "builder", domain: "exoticahousing.in" },
  { slug: "sikka-group", company: "Sikka Group", segment: "builder", domain: "sikka.in" },
  { slug: "kw-group", company: "KW Group", segment: "builder", domain: "kwgroup.in" },
  { slug: "ace-group", company: "ACE Group", segment: "builder", domain: "acegroupindia.com" },
  { slug: "bhutani-infra", company: "Bhutani Infra", segment: "builder", domain: "bhutanigroup.com" },
  { slug: "saya-group", company: "Saya Group", segment: "builder", domain: "sayahomes.in" },
  { slug: "landcraft-developers", company: "LandCraft Developers", segment: "builder", domain: "landcraft.in" },
  { slug: "migsun-group", company: "Migsun Group", segment: "builder", domain: "migsun.in" },
  { slug: "eldeco-group", company: "Eldeco Group", segment: "builder", domain: "eldecoproperties.com" },
  { slug: "adore-realtech", company: "Adore Realtech", segment: "builder", domain: "adorerealtech.com" },
  { slug: "4s-developers", company: "4S Developers", segment: "builder", domain: "4sdevelopers.in" },
  { slug: "excella-infrazone", company: "Excella Infrazone", segment: "builder", domain: "excellainfra.in" },
  { slug: "manglam-group", company: "Manglam Group", segment: "builder", domain: "manglamgroup.com" },
  { slug: "motia-group", company: "Motia Group", segment: "builder", domain: "motiagroup.com" },
  { slug: "gillco-group", company: "Gillco Group", segment: "builder", domain: "gillcogroup.com" },
  { slug: "detrica-electro-mechanical-pvt-ltd", company: "Detrica Electro Mechanical Pvt Ltd", segment: "contractor", domain: "detricamep.com" },
];

export const OUTREACH_BY_SLUG: Map<string, OutreachCompany> = new Map(OUTREACH_ROSTER.map((c) => [c.slug, c]));
export const OUTREACH_BY_DOMAIN: Map<string, OutreachCompany> = new Map(OUTREACH_ROSTER.map((c) => [c.domain, c]));

/** Company matching an email address, by its domain. */
export function outreachByEmail(email: string | null | undefined): OutreachCompany | undefined {
  if (!email || !email.includes("@")) return undefined;
  return OUTREACH_BY_DOMAIN.get(email.split("@")[1].toLowerCase());
}

/** Display name for a utm_content slug, falling back to a de-slugified guess
 *  so a link we did not generate still reads sensibly. */
export function outreachName(slug: string | null | undefined): string | null {
  if (!slug) return null;
  return OUTREACH_BY_SLUG.get(slug)?.company ?? slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
