-- ═══════════════════════════════════════════════════════════════
-- 0027 · Mapping approval + match provenance
--
-- The auto-mapper now works in layers: exact brand-SKU matches are trusted
-- (approval='approved'), fuzzy name-matcher hits need a human eye
-- (approval='pending') and surface in the admin with Approve / Reject.
-- `match_method` records HOW each mapping was made, for auditability.
-- (competitor_prices.status is the *suggestion* lifecycle — unrelated.)
-- ═══════════════════════════════════════════════════════════════

alter table public.competitor_map
  add column if not exists approval text not null default 'approved'
    check (approval in ('approved', 'pending'));

alter table public.competitor_map
  add column if not exists match_method text not null default 'manual'
    check (match_method in ('manual', 'brand-sku', 'name'));

create index if not exists competitor_map_approval_idx on public.competitor_map (approval);

comment on column public.competitor_map.approval is
  'approved = trusted for pricing decisions; pending = auto-matched by name, awaiting admin approval.';
comment on column public.competitor_map.match_method is
  'manual (admin picker) | brand-sku (exact MPN match) | name (fuzzy matcher).';
