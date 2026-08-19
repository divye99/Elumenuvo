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
- Fuzzy correction: a token that matches nothing tries edit-distance up to 2 against the catalogue vocabulary. Results banner says "Including close spellings" when this fires.

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
    summary: "The fair Layer-2 ranking: Demand 50, Quality 30, Value 20, plus the Brand Promoter term.",
    tags: ["ranking", "merit"],
    body: `EMS (src/lib/merit.ts) decides tie-breaks in featured ordering. It replaced raw lifetime glance views, which compounded early exposure: whoever got seen first kept winning. EMS is rate-based and smoothed, so a 3-day-old Rajdhani SKU competes with a 2-year-old Havells SKU on equal terms.

## Pillars
- Demand, 60%: view velocity per day live, search pick rate, cart rate, and 30-day buy rate. Buy rate carries the LEAST demand weight today and automatically becomes the HEAVIEST once total paid GMV crosses the 10 crore milestone. The flip needs no deploy; the panel shows which mode is live.
- Quality, 30%: smoothed review stars only. Dispatch and stock reliability are deliberately excluded: those are our operations, not the brand's merit.
- Value, 10%: savings depth vs MRP plus a bonus for beating the tracked market price.
- Brand Promoter: a small additive for brands we formally promote (we are Rajdhani's Brand Promoter). Smallest term by design.

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
At most ONE slot in positions 3 to 12 (position picked deterministically from the query, so reloads do not shuffle) can go to a brand not already in the head, but only if that product scores at least 92% of the top relevance score, is in stock and has a photo. If no product qualifies, there is no slot. Brands we are Brand Promoter of get a WEIGHTED preference, not a claim: when both a promoter and a non-promoter product qualify, the promoter wins the slot 70% of the time (configurable in /admin/merit); other brands keep real access to it.

## Cooldowns
Every exploration impression is logged (explore_log). A product shown 8+ times in 21 days with zero search picks enters cooldown and stops being explored. Cooldowns are ALWAYS temporary: either an admin timestamp or the 21-day evidence window expiring. Admins can set or clear cooldowns in /admin/merit.`,
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
    body: `The Smart BOM assistant (business accounts only, beta) parses a pasted or uploaded bill of quantities, matches each line to catalogue products, and builds a reviewable cart.

## How matching works
- Line parsing extracts quantity, unit, size, brand hints and free text.
- Matching uses the same lexicon as search, then scores candidates on spec fit.
- Unmatched or low-confidence lines go to a review list; the buyer confirms or swaps before anything enters the cart.
- Confirmed matches are remembered (boq learning tables), so the same customer's next BOQ auto-matches better.

Fully homegrown: no external AI calls. Leads from unmatched lines land in the admin Leads console under boq_unmatched.`,
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

## Geocoding
Pincode to zone mapping is offline (no per-request API): a bundled pincode dataset resolves zone and serviceability instantly at checkout.`,
  },
  {
    slug: "seo-engine",
    title: "SEO: how we earn search traffic",
    summary: "Structured data, the blog programme, price-list pages, IndexNow.",
    tags: ["growth"],
    body: `- Structured data: WebSite + Organization JSON-LD sitewide, Product JSON-LD on PDPs (price, availability, ratings), FAQ schema on policy pages. This is what gets our name and prices shown in result snippets.
- Blog: 50 buyer-question guides written for queries electricians and buyers actually type. Guides interlink and link into category and price-list pages.
- Price-list pages: 41 brand/category price-list pages generated from OUR live prices (never scraped tables), refreshed with the catalogue.
- IndexNow: every publish pings search engines the same day; weekly full re-ping.
- Directory presence: Google Business (Hapur, Noida), IndiaMART, TradeIndia, Justdial, ExportersIndia, Sulekha.

KAM note: rankings compound slowly; the honest answer to "why are we not #1" is domain age and backlinks, both of which these programmes grow.`,
  },
  {
    slug: "analytics-bots",
    title: "Analytics: tracking and bot filtering",
    summary: "What we track, and the three layers that keep bots out of every number.",
    tags: ["analytics"],
    body: `## Pipeline
The /api/track beacon logs page views, product glances, PDP section funnels and cart events into events tables, rolled up nightly into product_metrics_daily (per product per day: glance views, unique viewers, cart adds, units, orders, revenue). That rollup feeds admin analytics AND the merit engine.

## Know the enemy
The hard case is not Googlebot (it announces itself). It is the residential-proxy crawl wave seen in Aug 2026: 74% of a week's sessions, spoofed desktop user agents, IPs scattered across Baghdad, Lahore, Karachi, Guyancourt. These bots execute JavaScript and even fire the leave-timer, so they produce fake "time on page". What they cannot fake: browser freshness (real browsers auto-update; the wave shipped frozen Chrome 118-121 and Firefox 120-121 from late 2023 while every engaged human ran current builds) and UA diversity (the wave reused 11 exact UA strings across ~1,000 sessions, none of which ever engaged).

## Two things that are NEVER treated as bot evidence
- Bouncing. A visitor from a Google listing who opens one page, touches nothing and leaves is a REAL view and counts everywhere. View count does not equal engagement.
- Foreign geography. Foreign interest is real interest; nothing filters on country.
Engagement (an identity, an add-to-cart, or a tap plus measured dwell) always proves a human; its absence proves nothing by itself.

## Bot defense, three layers
- Ingest: /api/track, /api/search-log and /api/explore-log all reject requests matching the bot user-agent list or known crawler IP ranges (src/lib/bots.ts, ~60 patterns plus Googlebot/Bingbot IP prefixes).
- Classifier + rollup (migration 0124): classify_bot_sessions writes verdicts into the bot_sessions table on objective evidence only: bot UA, crawler IP, a frozen browser version no auto-updating human still runs (thresholds move forward yearly), the fleet signature (8+ sessions sharing one exact UA, zero engaged), or heavy crawling (10+ pageviews, zero interaction). rollup_product_metrics excludes those sids, so product_metrics_daily and therefore EMS stay clean. The nightly cron classifies, then rolls.
- Display: the same evidence rules classify sessions in the analytics UI; an engaged session is never flagged. The Searches tab drops rows from bot sessions too, including historic pre-gate rows. "Include likely bots" in the filter shows them on demand.

Verified Aug 2026: the evidence rules caught 94% of the wave while keeping every current-browser bounce, Indian or foreign. The few percent that are indistinguishable from real bounces stay counted, by design: when we cannot prove machine, we count the view.`,
  },
];

export function getWikiArticle(slug: string): WikiArticle | undefined {
  return WIKI.find((a) => a.slug === slug);
}
