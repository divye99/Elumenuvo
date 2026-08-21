/**
 * Internal wiki: brief articles on the logic behind every engine on the
 * platform. Written for two readers: a tech new-joiner who needs to know how
 * a system works before touching it, and a Key Account Manager who needs to
 * explain behaviour to a customer or brand without reading code.
 *
 * Unlisted by design: no nav links, noindex, not in the sitemap. Access is
 * business-account login OR the admin password (checked in the /wiki layout).
 *
 * Body format is deliberately tiny markdown: "## " headings, "- " bullets,
 * blank-line paragraphs. Rendered by the /wiki pages, nothing else.
 */

export type WikiArticle = {
  slug: string;
  title: string;
  summary: string;
  tags: string[];
  body: string;
};

export const WIKI: WikiArticle[] = [
  {
    slug: "search-lexicon",
    title: "Search: how a query is understood",
    summary: "Normalization, synonyms, units, plurals and typo tolerance before any ranking happens.",
    tags: ["search"],
    body: `Every query passes through the lexicon (src/lib/search-lexicon.ts) before ranking. The goal: the customer's words and our catalogue's words should land on the same tokens.

## Steps, in order
- Lowercase, strip punctuation, collapse spaces.
- Phrase rewrites: multi-word trade phrases map to catalogue vocabulary, e.g. "type 2" becomes the t2 form used in SPD names, "type 1+2" becomes t1plus2. Phrases run before token work so they see the original wording.
- Synonyms: per-token expansions from the SYNONYMS map (mcb, rccb, chokes, elcb and friends). This is the main extension point: when a real query fails, the fix is usually one SYNONYMS line.
- Unit canonicalization: "63a", "30ma", "45mts", "12switches" and similar are split into number + unit ("63 a", "30 ma", "45 m") so they match spec text written either way.
- Singularization: plural tokens also try their singular ("isolators" finds "isolator").
- Fuzzy correction: a token that matches nothing tries edit-distance up to 2 against the catalogue vocabulary. Applied silently: the corrected results speak for themselves, no banner (owner call, Aug 2026).

## Rules of thumb
- Never special-case one product. Fix the class of query in the lexicon.
- New brand or category vocabulary goes in SYNONYMS, not in ranking code.`,
  },
  {
    slug: "search-ranking",
    title: "Search: how results are ordered",
    summary: "Weighted coverage scoring, the strong-match cut, and the never-empty guarantee.",
    tags: ["search"],
    body: `Ranking lives in src/lib/search-rank.ts. It is pure relevance: no popularity term, no sales history. Popularity only enters later, through the merit engine, and only to break ties on the featured sort.

## Scoring
- Each query token is matched against name, brand, SKU, category and spec text. Whole-word and early-in-name matches score higher than substring matches.
- A product's score is the weighted coverage of query tokens. Products below the strong cut (0.55) are dropped while any strong match exists.
- Ties keep catalogue order, then the featured sort applies EMS (see the merit engine article).

## Never empty
If nothing survives, we relax: drop the weakest token and retry, widening until something honest matches. The results page then shows a note explaining what we relaxed. The rule is absolute: a customer must never see "no results" for a category we carry.

## Exact codes
A query that exactly matches a SKU, brand SKU or ELIN short-circuits everything and returns that product first.`,
  },
  {
    slug: "merit-engine",
    title: "EMS: the Elume Merit Score",
    summary: "The fair Layer-2 ranking: Demand 60, Quality 30, Value 10, plus the Brand Promoter term.",
    tags: ["ranking", "merit"],
    body: `EMS (src/lib/merit.ts) decides tie-breaks in featured ordering. It replaced raw lifetime glance views, which compounded early exposure: whoever got seen first kept winning. EMS is rate-based and smoothed, so a 3-day-old Rajdhani SKU competes with a 2-year-old Havells SKU on equal terms.

## Pillars
- Demand, 60%: view velocity per day live, search pick rate, cart rate, and 30-day buy rate. Buy rate carries the LEAST demand weight today and automatically becomes the HEAVIEST once total paid GMV crosses the 10 crore milestone. The flip needs no deploy; the panel shows which mode is live.
- Quality, 30%: smoothed review stars only. Dispatch and stock reliability are deliberately excluded: those are our operations, not the brand's merit.
- Value, 10%: savings depth vs MRP plus a bonus for beating the tracked market price.
- Brand Promoter: a small additive for brands we formally promote (we are Rajdhani's Brand Promoter), plus a 20% edge in the exploration-slot lottery (see the diversity article). Smallest terms by design.

Every rate is normalized against its category average and then squashed onto a 0 to 1 scale (0.5 means exactly average for the category). The squash matters: without it, a product with 75x the average traffic would swamp every other pillar, which is the rich-get-richer effect this engine exists to kill. Doubling a rate always helps, but with diminishing returns.

## Worked example (real numbers, Aug 2026)
The Orient Ecotech Volt BLDC fan, 10 days live, 24 human views and 5 cart adds in 30 days, priced 34% under MRP. The Fans category averages 0.0132 views per day per product, so the fan's smoothed velocity is 75.8x its category average, which squashes to 0.987. Its cart rate is 1.9x average, squashing to 0.655. Reviews: none yet, so exactly par, 0.5. Value: (1 + 0.34) / (2 + 0.34) = 0.572.

Demand pillar (early weights) = 0.4 x 0.987 + 0.3 x 0.5 (pick, par) + 0.2 x 0.655 + 0.1 x 0.70 (buy) = 0.75. EMS = 0.6 x 0.75 + 0.3 x 0.5 + 0.1 x 0.572 = about 0.65.

Now a Rajdhani switch listed 3 days ago with zero views. Every rate pillar sits at exactly par (0.5, that is the smoothing promise), and its 50% discount gives value (1 + 0.5) / (2 + 0.5) = 0.6. EMS = 0.6 x 0.5 + 0.3 x 0.5 + 0.1 x 0.6 + 0.06 promoter = 0.57. Brand new, zero data, and it sits within striking distance of the best performer on the site. Real demand still wins; nobody is buried for being new.

## Guardrails carried over from the visibility rules
- No photo: score multiplied by 0.2.
- Elume house brand: multiplied by 0.5 (we do not self-promote over partner brands).
- Admin suppression: score pinned below everything.

See /admin/merit for the live table, and the smoothing article for the maths.`,
  },
  {
    slug: "bayesian-smoothing",
    title: "EMS maths: Bayesian smoothing",
    summary: "Why a product with 2 views and 1 sale does not get a 50% conversion rate.",
    tags: ["ranking", "merit", "maths"],
    body: `Raw rates lie when data is thin. One sale on two views is not a 50% conversion rate; it is luck. Smoothing pulls every rate toward its category average until the product earns enough evidence to speak for itself.

## The formula
smoothed = (x + m * mu) / (n + m)

- x = the product's successes (e.g. units bought)
- n = its opportunities (e.g. views)
- mu = the category average rate
- m = the prior strength: how many opportunities of "benefit of the doubt" every product starts with. We use m = 25 views for pick/cart/buy rates, 14 days for velocity, 5 reviews for stars.

## Worked examples (category average 4%)
- 0 views, 0 sales: (0 + 25 * 0.04) / (0 + 25) = 4.0%. No data means exactly average, never zero.
- 2 views, 1 sale: (1 + 1) / (2 + 25) = 7.4%, not 50%. Promising, not crowned.
- 200 views, 1 sale: (1 + 1) / 225 = 0.9%. Plenty of chances, few takers: genuinely below average.
- 10,000 views, 800 sales: (800 + 1) / 10,025 = 8.0%. With heavy data the prior barely matters; the product's own rate wins.

The poor start at par and move on performance. Tenure and exposure volume buy nothing by themselves.

## The squash: why ratios alone are not enough
After smoothing, each rate is divided by its category average to give a ratio (1.0 = exactly average), then squashed with r / (1 + r) onto 0 to 1, where average lands at 0.5.

Why squash at all? A weighted average only means something when every pillar is marked out of the same maximum. Review stars have a natural ceiling (best possible is about 1.3x the average, since 5 stars vs a 3.8 average). Views have no ceiling, and because most products get almost no views, any product with real traffic is a huge multiple of the tiny average.

Real case, Aug 2026: the Orient Ecotech BLDC fan ran at 75.8x its category's average velocity. Unsquashed, its demand pillar alone would be worth about 30 points while a perfect review score was worth 0.39: traffic would decide everything and the "30% for quality" label would be a lie. Squashed, 75.8x becomes 0.987 and 1x becomes 0.5, so demand leads (as weighted) without silencing the other pillars.

The squash keeps order (more is always better) but pays diminishing returns: 2x average = 0.67, 10x = 0.91, 75x = 0.99. Being popular helps; being 10x more popular than the runner-up helps only a little more.`,
  },
  {
    slug: "diversity-exploration",
    title: "Search results: brand diversity and the exploration slot",
    summary: "The 4-per-brand cap in the first 12 results, the one exploration slot, and cooldowns.",
    tags: ["search", "ranking"],
    body: `Relevance alone can produce a wall of one brand. Two mechanisms in CatalogueBrowser keep the first screen honest without ever showing something irrelevant.

## Brand cap (Option A)
On generic featured-sorted queries, one brand can hold at most 4 of the first 12 results; overflow is deferred, never removed. The cap fully switches off when the customer shows brand intent: the brand name (or a 3+ letter prefix of it) in the query, an exact code, or a brand filter. Someone searching "havells rccb" sees all Havells.

## Exploration slot (Option D)
At most ONE slot in positions 3 to 12 (position picked deterministically from the query, so reloads do not shuffle) can go to a brand not already in the head. To qualify, a product must score at least 92% of the top relevance score, be in stock and have a photo. If nothing qualifies, there is no slot.

The winner is drawn by lottery: every qualifying product holds 1 ticket, and Brand Promoter products hold 1.2 tickets (a 20% edge, configurable in /admin/merit). With one Rajdhani and one other product qualifying, Rajdhani wins about 55 times in 100. The edge scales fairly as more brands join the promoter network, and every qualifying product always keeps a real chance.

## Cooldowns
Every exploration impression is logged (explore_log): an impression means the slot SHOWED the product, nothing more. A product shown 8+ times in a rolling 21 days with zero search picks enters cooldown and stops being explored. Cooldowns are ALWAYS temporary: either an admin timestamp or the 21-day evidence window expiring. The merit panel shows each product's wildcard impressions and the pick rate earned on those exact queries; being explored never changes EMS by itself.`,
  },
  {
    slug: "self-learning-search",
    title: "Search: the self-learning loops",
    summary: "How the search gets better every day with no manual work.",
    tags: ["search", "learning"],
    body: `Four loops run continuously off the search_queries log. None of them need owner input.

## The loops
- Pick learning: every click on a suggestion or a results card logs query + picked product. Picks boost that product for that query family and feed the pick-rate pillar of EMS.
- Alias learning: when a pick reveals that a query phrase means a specific product, the phrase is written to product_aliases and matches directly from then on.
- Reformulation mining: when a customer searches, gets nothing useful, rewords, and then succeeds, the failed form is linked to the successful one as a correction candidate.
- Popular queries: frequent queries power the suggest dropdown ordering.

## Hygiene
Bot traffic never enters any loop (see the analytics article). Rate limits cap logging per IP. The suggest dropdown and the results page share one lexicon, so learning in one place improves both.`,
  },
  {
    slug: "visibility-rules",
    title: "Visibility rules: what ranks, what sinks",
    summary: "The standing display guardrails that apply before and after any engine.",
    tags: ["ranking", "catalogue"],
    body: `These rules are constant across search, collections and the homepage. Engines rank within them, never around them.

- Out of stock: never featured, never explored, still findable by direct search.
- No photo: heavy penalty (0.2 multiplier in EMS). Products earn placement with a complete listing.
- Elume house brand: 0.5 multiplier. We are the marketplace; partner brands come first.
- Suppressed (admin): pinned to the bottom of featured ordering, still purchasable via direct link.
- Honest counts: every facet count in the filter rail reflects what clicking it will actually show. A filter must never lead to an empty or different-sized page.
- Card bullets: never repeat the title, never show import boilerplate. Every card renders at least one real spec bullet.`,
  },
  {
    slug: "boq-assistant",
    title: "Smart BOM assistant",
    summary: "Business-only beta: paste a BOQ, get a matched cart with review controls.",
    tags: ["b2b"],
    body: `The Smart BOM assistant parses a pasted or uploaded bill of quantities, matches each line to catalogue products, and builds a reviewable cart.

## Who can use it
- Customers: business accounts that have ordered at least once (early-access gate). Everyone else is redirected.
- The team: /admin/boq runs the same tool on a customer's behalf, for fulfilling BOQ enquiries. Its finish line is a shareable cart LINK (via Admin, then Cart links) sent on WhatsApp, instead of a cart push.

## How matching works
- Line parsing extracts quantity, unit, size, brand hints and free text.
- Part numbers match first: exact SKU codes (98%), then model codes mined from product names like "CR-M230AC4" (95%), then unambiguous code prefixes ("AF305-30" against our fuller variant codes, 90%). A name-derived code only counts when it belongs to exactly one product, so family codes shared by fifty variants can never fake certainty.
- Everything else scores on spec fit through the search lexicon.
- The honesty gate: a weak match (below 50%, or a different brand than the line names without a strong score) is reported as NOT STOCKED instead of guessed. The near misses stay attached as a one-click "closest we have" substitute dropdown, and rescuing one teaches the matcher an alias. Worked example: an ABB enquiry line for a panel heater must say "not stocked", never "Orient water heater, 52%".
- Confirmed matches are remembered (boq learning tables), so the next BOQ auto-matches better. Admin corrections train the same matcher.

Fully homegrown: no external AI calls. Leads from unmatched lines land in the admin Leads console under boq_unmatched (admin-run ones are labeled "Elume admin console").

## Quotation export (.docx)
/admin/quotation (also reachable from the console's approved lines via "export a quotation") turns an enquiry into the standard Elume quotation as an EDITABLE Word file: enquiry email + RFQ lines in, docx out. The format is owner-specified (Aug 2026): every figure EXCLUSIVE of GST, manufacturer MRP (ex-GST) next to the Elume price (ex-GST) with the discount computed between them, GST added once at the bottom (IGST or CGST/SGST), lean terms (no documents/specification rows), optional "This is our best offer." line. Edit the Word file, then print to PDF.`,
  },
  {
    slug: "price-sync-radar",
    title: "Pricing: brand syncs, market-beating, price radar",
    summary: "Where our prices come from and how we prove they are competitive.",
    tags: ["pricing"],
    body: `## Brand price syncs
For brands with official online stores we sync list prices per SKU on a schedule and price at a small fixed undercut. Each import migration snapshots the source price so changes are auditable.

## Market-beating logic
"Today's best price" claims are backed by market_low: the lowest tracked competitor price for that SKU. We only show best-price framing when our price actually beats it. The EMS value pillar pays a bonus for the same condition, so genuinely well-priced items also rank better.

## Price radar (/admin/radar)
Tracks competitor prices over time per SKU, flags where we have drifted above market, and feeds market_low. GST note: prices are stored inclusive and displayed ex-GST per category rules (Lighting 12%, most else 18%).`,
  },
  {
    slug: "norisys-premium",
    title: "Norisys: the premium brand treatment",
    summary: "Finish swatches, complete-the-plate pairing, engineering blocks and catalogue photography - Norisys-only.",
    tags: ["catalogue"],
    body: `Norisys (CUBE and TG9 series) gets a premium treatment no other brand has (owner call, Aug 2026). Everything is driven by the brand's own catalogue code system: <STEM>.<FINISH>, e.g. C5281.02 - the stem is the mechanism, the two-digit suffix is the finish.

## What is special, and where it lives (src/lib/norisys.ts)
- Finish swatches on PDPs: products sharing a stem are one family; a synthetic Finish attribute feeds the standard variant picker, so every Norisys listing shows its colour/material siblings one tap apart.
- Complete the plate: modules suggest same-series, same-module-count plates (finish-matched first); plates suggest mechanisms. Modular is a SYSTEM - this is the biggest basket and wrong-purchase lever.
- Engineering trust block: three bullets per series plus the catalogue exploded view, stored once per series, never per product. CE / RoHS / IS marks ride along.
- Photography: 60 SKU photos use exact-finish renders lifted from the catalogues via an OCR + geometry pipeline (scripts in the session archive; originals backed up and kept as second gallery image). 42 more were tried and reverted: the TG9 plate pages use one grey layout diagram for every material, so wood/marble/black SKUs kept their original true-finish photos. Never re-replace those from the catalogue.
- Card bullets: Norisys rows have no imported spec table, so cardHighlights (src/lib/card-specs.ts) adds catalogue-grounded engineering facts per product type (plates, sockets, switches, chargers).
- Two guides carry the long-form story: the CUBE vs TG9 series guide and the designer-finishes lookbook.

## Rules
- Norisys-only: never apply the treatment or its assets to another brand.
- The finish legend lives in NORISYS_FINISH; unknown suffixes fall back to the product's own name. Marble tones: .10 Sparkle White, .11 Terra Beige, .12 Salt White, .13 Onyx White. norisysFinishFamily groups labels into the material families used by the brand page's two-level Finish filter.`,
  },
  {
    slug: "elume-brand",
    title: "Elume house brand: identity and wire ranges",
    summary: "The Factor X identity (palette, fonts, logo, tagline rules) and the FR / HFFR house-wire ranges.",
    tags: ["catalogue"],
    body: `The Factor X identity (Aug 2026) is the site's design system AND the house-wire brand.

## Identity tokens
- Palette: Azule Blue #1D2F8A (primary accent), Midnight Blue #16215B (dark surfaces), Bright Orange #F25929 (highlight), Violet #723271, Spark Gold #D2AE6D (premium accents), Black #121212. Signature gradient: linear-gradient(133deg, #16215B, #1D2F8A 34%, #723271 70%, #F25929 104%).
- Fonts: the SITE stays on Hanken Grotesk (body) + Space Grotesk (headings) + Space Mono (SKU chips) - the kit's General Sans was tried sitewide and reverted (owner call, Aug 2026); General Sans remains the PRINT/collateral face (brochures, og image). Tw Cen MT is PRINT ONLY (Monotype license) - never embed either on the web.
- Logos: /assets/elume-mark.png (mark + gold star), elume-wordmark(.png/-white.png), elume-mark-square.png (SEO), elume-star.png (spark accent). App icons and og.png are generated from the kit.
- TAGLINE RULE: "Current ka naya standard" belongs to the HOUSEWIRES range only - the brand page and wire surfaces, never the marketplace chrome.

## The two wire ranges
- Elume FR: FR PVC, 0.5-10 sq mm, 7 marketing colours (Ultraviolet, Solar Flare, Aurora, Ember, Midnight, Moonlight, Eclipse - keep these names), 45/90/180 m coils.
- Elume HFFR: the FLAGSHIP. Halogen-free, PVC-free, 1-6 sq mm, same 7 colours, 90 m coils ONLY. Own variant family (root elume-hffr-2p5-90-ultraviolet), ELINs ELUME00174-00208. Launched at FR-parity pricing; packshots reuse the FR box until HFFR packaging exists.
- Spec data comes from the Elume product catalogue via scripts/elume-wires-backfill.ts (idempotent - extend the script, never hand-edit wire tech_specs).

KAM note: certifications to quote are IS 694 and IS 8130, ASTM D2863/D2843 fire tests, CE (generally conforming), RoHS and REACH - phrased exactly like that.`,
  },
  {
    slug: "elin",
    title: "ELIN: the Elume Listing Identifier",
    summary: "Our ASIN equivalent: stable short codes for every listing.",
    tags: ["catalogue"],
    body: `Every product has an ELIN: E followed by 9 characters from the unambiguous alphabet 234679CDFGHJKMPR (no 0/O, 1/I, 5/S lookalikes), derived deterministically from the product id, or ELUME##### for house SKUs.

- New imports use the ELIN as the product URL slug; older URLs stay untouched (never break an indexed URL).
- Search short-circuits on exact ELIN, SKU or brand SKU.
- The SQL and JS derivations of ELIN live in lockstep; if one changes both must change (migration 0116 seeded them).

KAM note: ELIN is the code to quote in tickets and with logistics partners; brand SKUs collide across brands, ELINs never do.`,
  },
  {
    slug: "invoicing",
    title: "Invoicing: tax and proforma documents",
    summary: "Serials, GSTIN, and what is generated when.",
    tags: ["operations"],
    body: `The invoice system generates tax invoices and proforma invoices as PDFs from order data.

- Serials: EN/<financial year>/#### sequence, gap-free per FY.
- Our GSTIN: 09AAJCE4953C1ZL, on every document.
- PDFs write "Rs." instead of the rupee symbol (font limitation in the PDF generator; do not "fix" this back).
- Proforma comes before payment for business quotes; the tax invoice generates on payment/dispatch.
- These are OUR documents. Shiprocket's label, manifest and courier invoice are separate downloads on the order page (see logistics).`,
  },
  {
    slug: "logistics",
    title: "Logistics: Shiprocket, rate intelligence, geocoding",
    summary: "Booking, tracking, documents, and how we quote delivery fees.",
    tags: ["operations"],
    body: `## Shiprocket
Bookings go from the admin order page (courier choice + address confirmation gate) and appear in the Shiprocket dashboard immediately. Tracking updates arrive on our webhook at /api/logistics/webhook (the alias exists because Shiprocket's panel blocks URLs containing their own name). Label, manifest and courier invoice download directly from the order row.

## Rate intelligence
Delivery fees are quoted from real courier rate cards by weight slab and zone, with our shipping fee engine deciding what the customer pays vs what we absorb. GST applies on delivery fees like any service.

## Failed deliveries and redelivery
When a parcel bounces (RTO, wrong address, refused, no attempt), the order page's Delivery issues panel records the incident: what happened, the EXACT reason, and whose fault it was. Fault matters: buyer faults never count against the courier on the scorecard; only courier faults do. The customer gets a tokened decision link (email and/or WhatsApp) and chooses on the platform: redeliver as-is, redeliver to a corrected address (one click applies it to the order), or cancel. Redelivery pricing is per incident: a fee, or explicitly free with the "on us" framing. Every incident and its reason shows in Logistics under "Failed deliveries and why".

## Geocoding
Pincode to zone mapping is offline (no per-request API): a bundled pincode dataset resolves zone and serviceability instantly at checkout.`,
  },
  {
    slug: "seo-engine",
    title: "SEO: how we earn search traffic",
    summary: "Structured data, the blog programme, price-list pages, IndexNow.",
    tags: ["growth"],
    body: `- Structured data: Organization JSON-LD sitewide; WebSite JSON-LD on the HOMEPAGE ONLY (Google reads the site name from the root document; a site-wide duplicate with conflicting fields was the bug that kept "Elume" from showing, fixed Aug 2026 - never re-add it to the layout); Product JSON-LD on PDPs (price, availability, ratings); FAQ schema on policy pages.
- Brand SERP (Aug 2026): homepage title is "Elume - India's Premier Electrical Marketplace" (title.absolute, or the layout template doubles the brand), the H1 carries "Elume", alternateName includes "Elumenuvo" (kills Google's elumelu typo-correction), the manifest short_name is Elume, and the footer carries server-rendered category links (sitelinks anchors: the header mega-menu is hover-gated client state Google never sees).
- Blog: 50 buyer-question guides written for queries electricians and buyers actually type. Guides interlink and link into category and price-list pages.
- Price-list pages: 41 brand/category price-list pages generated from OUR live prices (never scraped tables), refreshed with the catalogue.
- IndexNow: every publish pings search engines the same day; weekly full re-ping.
- Merchant Center: products flow via the /api/merchant-feed link Google fetches daily; promotions flow the same way via /api/merchant-promotions, managed in Admin, then Promotions (shared codes or no-code offers, never the one-time discount codes).
- Directory presence: Google Business (Hapur, Noida), IndiaMART, TradeIndia, Justdial, ExportersIndia, Sulekha.

KAM note: rankings compound slowly; the honest answer to "why are we not #1" is domain age and backlinks, both of which these programmes grow.`,
  },
  {
    slug: "bulk-enquiry",
    title: "Bulk enquiry: the header's B2B front door",
    summary: "The /bulk-enquiry form, where its submissions go, and the 24-hour promise.",
    tags: ["operations"],
    body: `/bulk-enquiry replaced "For business" in the header (Aug 2026; the business pitch page stays in the footer). One form: contact person, company, mobile, email, requirement.

## What a submission does
1. Emails info@elumenuvo.com with the CUSTOMER IN CC and reply-to set to them, so a plain "Reply all" starts the quote thread and the customer always holds a copy (lib/email.ts sendBulkEnquiryEmail).
2. Best-effort writes a partner_leads row with kind "bulk-enquiry" (migration 0130 widens the kind check). The email is the primary channel: it sends even if the insert fails.

## The promise
The page commits to a response WITHIN 24 HOURS, and the email footer repeats it. Whoever owns the inbox owns that clock.

KAM note: quote from the live price list; the automatic 15-unit wholesale rate is the floor, project volumes can go sharper line by line.`,
  },
  {
    slug: "analytics-bots",
    title: "Analytics: tracking and bot filtering",
    summary: "What we track, and the three layers that keep bots out of every number.",
    tags: ["analytics"],
    body: `## Pipeline
The /api/track beacon logs page views, product glances, PDP section funnels and cart events into events tables, rolled up nightly into product_metrics_daily (per product per day: glance views, unique viewers, cart adds, units, orders, revenue). That rollup feeds admin analytics AND the merit engine.

Daily traffic is aggregated IN the database (migration 0127, analytics_daily): the page never ships raw events for it, any window costs the same, and today can never fall off a fetch cap (the old in-app aggregation silently dropped the newest day once a window crossed 20,000 rows). Raw events are fetched, newest first and columns-only, just for the visitor journeys and product views actually shown. The analytics page defaults to 7 days, offers a rolling 24-hour view with hourly bars, shows top PRODUCT pages (resolved to name and brand), and filters by brand: sessions that viewed at least one product of that brand.

## Know the enemy
The hard case is not Googlebot (it announces itself). It is the residential-proxy crawl wave seen in Aug 2026: 74% of a week's sessions, spoofed desktop user agents, IPs scattered across Baghdad, Lahore, Karachi, Guyancourt. These bots execute JavaScript and even fire the leave-timer, so they produce fake "time on page". What they cannot fake: browser freshness (real browsers auto-update; the wave shipped frozen Chrome 118-121 and Firefox 120-121 from late 2023 while every engaged human ran current builds) and UA diversity (the wave reused 11 exact UA strings across ~1,000 sessions, none of which ever engaged).

## Two things that are NEVER treated as bot evidence
- Bouncing. A visitor from a Google listing who opens one page, touches nothing and leaves is a REAL view and counts everywhere. View count does not equal engagement.
- Foreign geography. Foreign interest is real interest; nothing filters on country.
Engagement (an identity, an add-to-cart, or a tap plus measured dwell) always proves a human; its absence proves nothing by itself.

## Bot defense, three layers
- Ingest: /api/track, /api/search-log and /api/explore-log all reject requests matching the bot user-agent list or known crawler IP ranges (src/lib/bots.ts, ~60 patterns plus Googlebot/Bingbot IP prefixes).
- Classifier + rollup (migrations 0124/0128): classify_bot_sessions writes verdicts into the bot_sessions table on objective evidence only: bot UA, crawler IP, a frozen browser version no auto-updating human still runs (thresholds move forward yearly), the fleet-UA signature (8+ sessions sharing one exact UA, zero engaged), the fleet-IP signature (one IP minting 6+ device tokens with zero taps, carts or sign-ins across all of them: quiet viewing alone never flags anyone, and one tap anywhere clears the whole IP, so office networks never trip it), or heavy crawling (10+ pageviews, zero interaction). rollup_product_metrics excludes those sids, so product_metrics_daily and therefore EMS stay clean. The nightly cron classifies, then rolls; the daily-traffic tab also classifies the current day on load.
- Display: the same evidence rules classify sessions in the analytics UI; an engaged session is never flagged. The Searches tab drops rows from bot sessions too, including historic pre-gate rows. "Include likely bots" in the filter shows them on demand.

Verified Aug 2026: the evidence rules caught 94% of the wave while keeping every current-browser bounce, Indian or foreign. The few percent that are indistinguishable from real bounces stay counted, by design: when we cannot prove machine, we count the view.`,
  },
];

export function getWikiArticle(slug: string): WikiArticle | undefined {
  return WIKI.find((a) => a.slug === slug);
}
