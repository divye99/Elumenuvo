-- ═══════════════════════════════════════════════════════════════
-- 0025 · Partner leads
--   One table for both public lead forms:
--     · "seller"          — Sell on Elume brand-onboarding requests
--     · "product-request" — "Can't find what you need?" product requests
--   Anon insert-only (like waitlist); reads go through the service role.
-- ═══════════════════════════════════════════════════════════════

create table if not exists public.partner_leads (
  id         uuid primary key default gen_random_uuid(),
  kind       text not null check (kind in ('seller', 'product-request')),
  name       text,
  email      text not null check (position('@' in email) > 1),
  phone      text,
  company    text,
  message    text check (char_length(message) <= 4000),
  details    jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists partner_leads_kind_idx on public.partner_leads (kind, created_at desc);

alter table public.partner_leads enable row level security;
drop policy if exists "public submit partner lead" on public.partner_leads;
create policy "public submit partner lead" on public.partner_leads
  for insert to anon, authenticated with check (true);
