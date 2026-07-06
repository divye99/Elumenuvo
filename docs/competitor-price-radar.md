# Competitor price radar (multi-source)

Tracks competitor prices and suggests setting your Elume price **₹1 under** — you
approve each change. Built to add more sites (Amazon, Moglix…) with just an
adapter. **Vashi** is live today.

## Key facts about Vashi pricing

- Vashi's **real net price is public** — no login. The API returns it when the
  `X-Custom-Pincode` header is sent (the adapter does this automatically):
  `value` = net price **incl GST** (e.g. ₹43.78), `mrp` = list price (₹92.75).
- Our Elume prices are GST-inclusive too, so `value` is directly comparable.
- Vashi prices wire **per metre**, so a 90 m coil uses a **unit factor of 90**
  (`comparable = net price × unit_factor`).
- The net price is quoted for a pincode — default `400001` (Mumbai); override
  with the `VASHI_PINCODE` env/secret.

## How it works

1. **Map** each product to one competitor item (per source) — admin → **Price
   radar** → *Map to …*. The picker searches the site live; set the unit factor.
2. **Sync** — monthly (GitHub Action) or *Sync now*. Refetches each mapped item's
   price (net when logged in, else list), computes `comparable` and
   `suggested = round(comparable) − 1`, upserts the snapshot, and appends a
   **history** row.
3. **Review** — the radar shows every product where your price differs from the
   ₹1-under target. **Accept** sets the Elume price; **Dismiss** hides it until the
   competitor price changes.
4. **Chart** — every product page shows a *Price vs competitors* chart built from
   the captured history (public read).

## One-time setup

1. **Run the SQL** (in order):
   - `supabase/competitor-pricing-v2.sql` — tables (map, prices, history, sources,
     log). Replaces the old competitor-pricing.sql.
   - `supabase/competitor-map-seed.sql` — 15 auto-generated Vashi mappings (wire
     products; review/fix the rest in the admin).
2. **GitHub Action secrets** (repo → Settings → Secrets → Actions):
   - `SUPABASE_URL` — `https://<project>.supabase.co` (no path/slash)
   - `SUPABASE_SERVICE_ROLE_KEY` — the service-role key
   - `VASHI_PINCODE` — *(optional)* pincode net prices are quoted for (default 400001).
   The workflow runs on the **1st of each month** and can be run by hand from the
   **Actions** tab.
3. **Vercel:** the same `SUPABASE_SERVICE_ROLE_KEY` gates admin writes; optionally add `VASHI_PINCODE` there too.

## Adding another source (Amazon, Moglix…)

1. Write an adapter in `src/lib/competitors/<source>.ts` implementing
   `CompetitorAdapter` (search + fetchByCode, and login if it gates prices).
2. Register it in `src/lib/competitors/index.ts`.
3. Enable its row in `competitor_sources` (`update … set enabled = true`).
The admin, sync, suggestions and chart are all source-agnostic — no other changes.

## Manual runs (local)

```bash
node --env-file=.env.local scripts/competitor-sync.mjs     # sync prices
node scripts/auto-map-vashi.mjs                            # regenerate mappings
```
