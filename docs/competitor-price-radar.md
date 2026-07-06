# Competitor price radar (multi-source)

Tracks competitor prices and suggests setting your Elume price **₹1 under** — you
approve each change. Built to add more sites (Amazon, Moglix…) with just an
adapter. **Vashi** is live today.

## Key facts about Vashi pricing

- Vashi's **public API only exposes the list/MRP price** (e.g. ₹92.75).
- The **real B2B selling price** (e.g. ₹43.78) is shown only to a **logged-in
  account**. The sync logs in with your Vashi credentials (if configured) to read
  it; otherwise it falls back to the list price and flags "list price only".
- Vashi prices wire **per metre**, so a 90 m coil uses a **unit factor of 90**
  (`comparable = competitor price × unit_factor`).

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
   - `VASHI_USERNAME` + `VASHI_PASSWORD` — *(optional)* your Vashi B2B login;
     unlocks the real net price. Without them, list price is used.
   The workflow runs on the **1st of each month** and can be run by hand from the
   **Actions** tab.
3. **Vercel:** the same `SUPABASE_SERVICE_ROLE_KEY` gates admin writes; add
   `VASHI_USERNAME` / `VASHI_PASSWORD` there too if you want *Sync now* to fetch
   net prices from the dashboard.

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
