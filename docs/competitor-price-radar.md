# Competitor price radar (Vashi)

Monthly price intelligence against **vashiisl.com**. It fetches the live price of
each product you've mapped, and suggests setting your Elume price to **₹1 under**
theirs — you approve each change. Nothing is ever auto-applied.

## How it works

1. **Map** each Elume product to one Vashi product (admin → **Price radar** →
   *Map to Vashi*). The picker searches Vashi's live catalogue; pick the match and
   set a **unit factor** — Vashi prices wire **per metre**, so a 90 m coil uses
   **×90** (pieces/packs usually ×1). Stored in `competitor_map`.
2. **Sync** — monthly (GitHub Action) or on demand (*Sync now*). It refetches each
   mapped code's price, computes `comparable = vashi_price × factor` and
   `suggested = round(comparable) − 1`, and writes `competitor_prices`.
3. **Review** — the radar shows every product where your price differs from the
   ₹1-under target. **Accept** sets the Elume price; **Dismiss** hides it until
   Vashi's price changes again.

## One-time setup

1. **Run the SQL:** `supabase/competitor-pricing.sql` (creates `competitor_map`,
   `competitor_prices`, `competitor_sync_log`).
2. **GitHub Action secrets** (repo → Settings → Secrets and variables → Actions):
   - `SUPABASE_URL` — your project URL (`https://…supabase.co`)
   - `SUPABASE_SERVICE_ROLE_KEY` — the service-role key (server-only; **never**
     the anon key)
   The workflow `.github/workflows/competitor-price-sync.yml` runs on the **1st of
   each month** and can also be triggered by hand from the **Actions** tab
   (*Run workflow*).
3. **Vercel:** `SUPABASE_SERVICE_ROLE_KEY` must already be set (it gates all admin
   writes) for *Sync now* / Accept to work in the dashboard.

## Manual run (local)

```bash
node --env-file=.env.local scripts/competitor-sync.mjs
```

## Notes

- The unit factor is the whole game — a wrong factor makes the comparison
  meaningless. Set it once per product; the monthly job reuses it.
- A prior Accept/Dismiss is remembered while Vashi's price is unchanged; when
  their price moves, the row becomes a fresh suggestion.
- Data source: Vashi's public SAP Commerce OCC API
  (`prodapi.vashiisl.com/occ/v2/visl`). Read-only, once a month, politely paced.
