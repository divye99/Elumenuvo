-- 0086: trade outreach survey + TRADE5 reward code.
-- The survey page (/trade-survey) collects how builders/contractors/architects
-- buy today and what we should build for them; company + phone are the only
-- identity fields (per outreach decision, no credit-terms question).

create table if not exists public.trade_survey (
  id         uuid primary key default gen_random_uuid(),
  company    text not null check (char_length(company) between 2 and 160),
  phone      text not null check (char_length(phone) between 8 and 20),
  buys       text,            -- what they buy most often
  channel    text,            -- how they buy today
  priority   text,            -- what matters most in a supplier
  missing    text check (char_length(missing) <= 4000), -- free text
  created_at timestamptz not null default now()
);
create index if not exists trade_survey_created_idx on public.trade_survey (created_at desc);

alter table public.trade_survey enable row level security;
drop policy if exists "public submit trade survey" on public.trade_survey;
create policy "public submit trade survey" on public.trade_survey
  for insert to anon, authenticated with check (true);
-- no select policy: reads are admin-only via the service role.

-- Survey reward: 5% off the first order, shown on completion.
insert into public.discount_codes (code, percent, expires_at, max_uses)
values ('TRADE5', 5, '2026-11-30T23:59:59+05:30', 500)
on conflict (code) do nothing;
