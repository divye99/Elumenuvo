-- ═══════════════════════════════════════════════════════════════
-- 0040 · Coil length is part of a wire's identity
--
-- A 90 m coil and a 180 m coil of the same wire are DIFFERENT SKUs at roughly
-- 2x the price. Three things were treating them as interchangeable:
--
--   1. Two CMI length variants (45 m, 180 m) were cloned from the 90 m parent
--      without updating their data: attrs.Length said "90 m", the spec said
--      "90 m coil", and elume_price was a straight copy of the 90 m price.
--      The 180 m coil was therefore ON SALE AT THE 90 m PRICE (twice the
--      copper for the same money), and the pricing engine compared it against
--      90 m competitor listings.
--
--   2. Competitor mappings were made without ever comparing coil length, so a
--      90 m product could map to a 180 m listing and inherit ~2x the price as
--      if it were like-for-like.
--
--   3. competitor_map.unit_factor for Vashi (which quotes wire per METRE) was
--      hardcoded to 90, so a 180 m coil was priced as half a coil.
--
-- The matcher (scripts/auto-map-brands.mjs) now rejects a length conflict
-- outright and derives the per-metre factor from the product's real coil
-- length. This migration repairs the data already in the database.
-- ═══════════════════════════════════════════════════════════════

-- ── 1. Repair the CMI length variants ──────────────────────────
-- Prices are set strictly proportional to the 90 m parent (₹3,499 / 90 m coil),
-- which is how copper actually costs: 45 m = ₹1,750, 180 m = ₹6,998. MRP was
-- already correct on both rows, so it is left alone.
update public.products
set attrs        = jsonb_set(coalesce(attrs, '{}'::jsonb), '{Length}', '"45 m"'),
    spec         = replace(spec, '90 m coil', '45 m coil'),
    elume_price  = 1750
where id = 'cmi-gs-15-red-45m';

update public.products
set attrs        = jsonb_set(coalesce(attrs, '{}'::jsonb), '{Length}', '"180 m"'),
    spec         = replace(spec, '90 m coil', '180 m coil'),
    elume_price  = 6998
where id = 'cmi-gs-15-red-180m';

-- ── 2. Drop competitor mappings that cross a coil-length boundary ──
-- competitor_map.note holds the competitor listing name for auto-mapped rows
-- ("auto: Polycab 2.5 sqmm 180 m FR House Wire (s14)"), so a length stated on
-- the listing can be compared with ours. A listing that states NO length is
-- left alone: per-metre sellers never state one, and unit_factor handles them.
-- A view keeps the length arithmetic in ONE place, so the two deletes below
-- (prices first, then the mapping) can never drift apart. Dropped at the end.
create or replace view public._wire_len_mismatch as
select m.product_id,
       m.source,
       nullif(regexp_replace(coalesce(p.attrs->>'Length', ''), '[^0-9].*$', ''), '')::int as our_m,
       ((regexp_match(lower(coalesce(m.note, '')),
          '\y([0-9]{2,4})\s*(?:m|mtr|mtrs|meter|meters|metre|metres)\y'))[1])::int         as listing_m
from public.competitor_map m
join public.products p on p.id = m.product_id
where p.category = 'Wires & Cables';

delete from public.competitor_prices cp
using public._wire_len_mismatch x
where cp.product_id = x.product_id and cp.source = x.source
  and x.our_m is not null and x.listing_m is not null and x.our_m <> x.listing_m;

delete from public.competitor_map m
using public._wire_len_mismatch x
where m.product_id = x.product_id and m.source = x.source
  and x.our_m is not null and x.listing_m is not null and x.our_m <> x.listing_m;

drop view public._wire_len_mismatch;

-- ── 2b. Havells wires: the mapping must BE the brand SKU ───────
-- havells.com sells our ranges (Life Line Plus S3 HRFR, Life Guard FR-LSH,
-- Life Shield HFFR) as 90 m coils, and a SEPARATE "Lifeline FR" range that is
-- 180 m only, at roughly 2x the price (e.g. WHFFDNRL12X57-C, ₹8,472 for the
-- 2.5 sq mm). Every Havells SKU we hold was verified to resolve to a 90 m coil
-- on their site, so on the brand's OWN store the correct mapping is always the
-- product's own brand SKU. Anything else is a wrong coil or a wrong range.
--
-- These are downgraded to 'pending', not deleted: pending mappings are excluded
-- from every pricing decision and surface in the admin approval queue, so a
-- wrong coil can never set our price, and a human decides rather than a regex.
-- (Rows the note-based rule above already removed are gone; this catches the
-- manual/older mappings whose note never recorded the listing name.)
update public.competitor_map m
set approval = 'pending',
    note     = coalesce(m.note || ' · ', '') || 'flagged 0040: code does not match brand SKU (possible wrong coil length)',
    updated_at = now()
from public.products p
where m.product_id = p.id
  and m.source = 'havells'
  and p.category = 'Wires & Cables'
  and p.brand_sku is not null
  and upper(m.competitor_code) <> upper(p.brand_sku)
  and m.approval <> 'pending';

-- ── 3. Vashi's per-metre factor = our actual coil length ────────
-- Vashi quotes wire per metre. The factor must be the coil length, not a
-- hardcoded 90, or a 180 m coil is compared against half a coil's worth of wire.
update public.competitor_map m
set unit_factor = nullif(regexp_replace(p.attrs->>'Length', '[^0-9].*$', ''), '')::numeric,
    updated_at  = now()
from public.products p
where m.product_id = p.id
  and m.source = 'vashi'
  and p.category = 'Wires & Cables'
  and p.attrs->>'Length' ~ '^[0-9]+'
  and m.unit_factor is distinct from nullif(regexp_replace(p.attrs->>'Length', '[^0-9].*$', ''), '')::numeric;

-- Any price snapshot computed with the old factor is now stale: force a resync
-- rather than leave a wrong comparable price on screen.
delete from public.competitor_prices cp
using public.products p
where cp.product_id = p.id and cp.source = 'vashi' and p.category = 'Wires & Cables'
  and coalesce(cp.unit_factor, 1) is distinct from nullif(regexp_replace(p.attrs->>'Length', '[^0-9].*$', ''), '')::numeric;
