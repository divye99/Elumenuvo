-- ═══════════════════════════════════════════════════════════════
-- 0051 · First-party visitor analytics (the admin Analytics page)
--
-- Every visit is recorded as a stream of events keyed by `sid`, the same
-- anonymous device token the search log uses, so one visitor's whole journey
-- lines up: pageviews (with time-on-page via the matching `leave` event),
-- clicks, product taps, add-to-carts, and `identify` events that attach a
-- real name/email the moment one is known (checkout, business signup,
-- waitlist). An anonymous history therefore becomes a named history
-- retroactively: same sid, now with an identity event in the stream.
--
-- Location comes from Vercel's edge geo headers; device from the user agent.
-- RLS enabled with NO policies: only the service role writes (the /api/track
-- route) and reads (the admin page + CSV export). The anon key sees nothing.
--
-- Privacy note: disclose this first-party analytics (including IP capture)
-- in the privacy policy.
-- ═══════════════════════════════════════════════════════════════

create table if not exists public.site_events (
  id          bigint generated always as identity primary key,
  sid         text not null,             -- anonymous device token (localStorage)
  type        text not null,             -- pageview | leave | click | product_click | add_to_cart | identify
  path        text,                      -- pathname + query at the time
  detail      jsonb,                     -- type-specific: {label, href, product_id, utm...}
  referrer    text,                      -- document.referrer on landing pageviews
  device      text,                      -- "iPhone · Safari" style summary
  ip          text,
  country     text,
  region      text,
  city        text,
  duration_ms int,                       -- leave events: how long the page was open
  email       text,                      -- identify events
  name        text,                      -- identify events
  created_at  timestamptz not null default now()
);

create index if not exists site_events_sid_idx     on public.site_events (sid, created_at);
create index if not exists site_events_created_idx on public.site_events (created_at desc);
create index if not exists site_events_type_idx    on public.site_events (type);

alter table public.site_events enable row level security;

comment on table public.site_events is
  'First-party visitor event stream (admin Analytics). Service-role access only.';
