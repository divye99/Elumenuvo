-- ═══════════════════════════════════════════════════════════════
-- 0047 · Search query log (stage 1 of query-driven suggestions)
--
-- Records what customers actually search for, so the suggest API can later
-- serve REAL popular queries (ranked by frequency and click-through) instead
-- of phrases synthesized from the catalogue. Also doubles as catalogue
-- intelligence: zero-result queries are demand we do not carry or name wrong.
--
-- What gets logged (fire-and-forget, never blocks the shopper):
--   source 'search'  : a settled catalogue search (?q=), with its result count
--   source 'suggest' : a suggestion chosen in the header dropdown, with what
--                      was typed and what was picked (term or product)
--
-- Privacy: no user id, no IP, no personal data. session_id is a random
-- client-generated token used only to de-duplicate bursts.
--
-- RLS is enabled with NO policies: only the service role (the API route)
-- can write or read. The anon key cannot spam or scrape the log.
-- ═══════════════════════════════════════════════════════════════

create table if not exists public.search_queries (
  id           bigint generated always as identity primary key,
  query        text not null,                 -- as typed (trimmed, max 120 chars, enforced in the API)
  normalized   text not null,                 -- lowercased, whitespace-collapsed: the aggregation key
  source       text not null check (source in ('search', 'suggest')),
  results      int,                           -- result count for 'search'; null for 'suggest'
  picked       text,                          -- 'suggest': the chosen term, or product:<id>
  category     text,                          -- category filter in effect, if any
  session_id   text,
  created_at   timestamptz not null default now()
);

create index if not exists search_queries_norm_idx    on public.search_queries (normalized, created_at desc);
create index if not exists search_queries_created_idx on public.search_queries (created_at desc);

alter table public.search_queries enable row level security;

comment on table public.search_queries is
  'Customer search log. Feeds popular-query suggestions (stage 2) and the zero-result demand report. Service-role access only.';
