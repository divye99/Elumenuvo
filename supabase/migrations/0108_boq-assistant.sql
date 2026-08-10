-- 0108: Smart BOM / BOQ assistant (v1, business accounts only).
--
-- The moat feature (owner, Aug 2026): paste or upload a BOQ, the homegrown
-- matcher maps every line to the catalogue with confidence + alternates, the
-- user reviews and pushes confirmed lines to the cart. Every correction is
-- training signal: it lands in product_aliases and improves the next match
-- (and the storefront search via the same signals).
--
-- Three tables:
--   boq_uploads     - one row per pasted/uploaded BOQ (owner-scoped)
--   boq_lines       - parsed lines with match state + feedback trail
--   product_aliases - learned "this phrasing means this product" mappings,
--                     written by the feedback route, read by the matcher
-- Unmatched-and-confirmed lines additionally become partner_leads rows
-- (kind 'boq_unmatched') so demand shows up in the admin Requests tab;
-- that table needs its kind check widened below.

create table if not exists public.boq_uploads (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  name        text,
  source      text not null default 'paste' check (source in ('paste', 'csv', 'xlsx')),
  line_count  int  not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists boq_uploads_user_idx on public.boq_uploads (user_id, created_at desc);

create table if not exists public.boq_lines (
  id                uuid primary key default gen_random_uuid(),
  upload_id         uuid not null references public.boq_uploads (id) on delete cascade,
  user_id           uuid not null references auth.users (id) on delete cascade,
  position          int  not null,
  raw_line          text not null,
  qty               numeric,
  qty_unit          text,               -- as written: nos / m / coil / set ...
  matched_product_id text,              -- matcher's top pick (products.id)
  confidence        numeric,            -- 0..1
  match_method      text,               -- code | alias | fingerprint | tokens
  alternates        jsonb not null default '[]'::jsonb, -- [{id, score}]
  status            text not null default 'proposed'
                    check (status in ('proposed', 'confirmed', 'swapped', 'rejected', 'unmatched')),
  final_product_id  text,               -- what the user actually accepted
  final_qty         numeric,            -- in the product's sell unit (coils/pc)
  created_at        timestamptz not null default now()
);
create index if not exists boq_lines_upload_idx on public.boq_lines (upload_id, position);
create index if not exists boq_lines_user_idx on public.boq_lines (user_id, created_at desc);

-- The learning table: normalized BOQ phrasing -> product, with hit counts.
-- The matcher checks it FIRST after exact codes; the feedback route upserts
-- on every confirm/swap. hits ranks competing aliases for the same phrase.
create table if not exists public.product_aliases (
  id          uuid primary key default gen_random_uuid(),
  alias_norm  text not null,            -- normalizeSearchText output
  product_id  text not null,
  hits        int  not null default 1,
  source      text not null default 'boq' check (source in ('boq', 'search', 'manual')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (alias_norm, product_id)
);
create index if not exists product_aliases_norm_idx on public.product_aliases (alias_norm);

-- RLS: BOQ data is owner-only; aliases are readable by any signed-in user
-- (they contain no personal data, only phrase->product mappings) and written
-- through the service role in the feedback route.
alter table public.boq_uploads enable row level security;
drop policy if exists "own boq uploads" on public.boq_uploads;
create policy "own boq uploads" on public.boq_uploads
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.boq_lines enable row level security;
drop policy if exists "own boq lines" on public.boq_lines;
create policy "own boq lines" on public.boq_lines
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter table public.product_aliases enable row level security;
drop policy if exists "read aliases" on public.product_aliases;
create policy "read aliases" on public.product_aliases
  for select to anon, authenticated using (true);

-- Widen partner_leads.kind so unmatched BOQ lines can land in the admin
-- Requests tab as demand data ("what to import next").
alter table public.partner_leads drop constraint if exists partner_leads_kind_check;
alter table public.partner_leads
  add constraint partner_leads_kind_check
  check (kind in ('seller', 'product-request', 'boq_unmatched'));
