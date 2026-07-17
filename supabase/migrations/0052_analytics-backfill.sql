-- ═══════════════════════════════════════════════════════════════
-- 0052 · Analytics backfill: everyone who ACTED before tracking existed
--
-- True pre-launch visit history (pageviews, clicks) was never recorded and
-- cannot be recovered; nothing here is synthesized. What IS real: orders,
-- payment attempts, waitlist joins, partner leads and business signups, each
-- with a genuine timestamp and identity. This seeds those as journey anchors
-- in site_events so the Analytics page shows every known person and what
-- they did, when.
--
-- Each person gets a synthetic device key 'legacy-<hash(email)>', so the
-- same email's actions across sources merge into ONE visitor. Rows use
-- type 'legacy' (one per action, label describes it) plus one 'identify'
-- per person so the visitor list shows their name. Idempotent.
-- ═══════════════════════════════════════════════════════════════

-- ── One identify per known email (earliest occurrence wins) ──
with people as (
  select lower(email) as email, max(name) as name, min(created_at) as first_at
  from (
    select email, name, created_at from public.orders where email is not null
    union all
    select email, name, created_at from public.waitlist where email is not null
    union all
    select email, name, created_at from public.partner_leads where email is not null
  ) x
  where email <> ''
  group by lower(email)
)
insert into public.site_events (sid, type, email, name, created_at)
select 'legacy-' || substr(md5(p.email), 1, 10), 'identify', p.email, p.name, p.first_at
from people p
where not exists (
  select 1 from public.site_events se
  where se.sid = 'legacy-' || substr(md5(p.email), 1, 10) and se.type = 'identify'
);

-- ── Orders (paid, awaiting, abandoned: each was a real action) ──
insert into public.site_events (sid, type, detail, email, name, created_at)
select 'legacy-' || substr(md5(lower(o.email)), 1, 10), 'legacy',
       jsonb_build_object('label', 'Order ' || o.id || ' · ₹' || coalesce(o.total, 0)::text || ' · ' || coalesce(o.status, 'placed')),
       o.email, o.name, o.created_at
from public.orders o
where o.email is not null and o.id <> 'ELM-TEST-0001'
  and not exists (
    select 1 from public.site_events se
    where se.type = 'legacy' and se.detail->>'label' like 'Order ' || o.id || ' ·%'
  );

-- ── Credit waitlist ──
insert into public.site_events (sid, type, detail, email, name, created_at)
select 'legacy-' || substr(md5(lower(w.email)), 1, 10), 'legacy',
       jsonb_build_object('label', 'Joined the NBFC credit waitlist' || case when w.company is not null then ' · ' || w.company else '' end),
       w.email, w.name, w.created_at
from public.waitlist w
where w.email is not null
  and not exists (
    select 1 from public.site_events se
    where se.sid = 'legacy-' || substr(md5(lower(w.email)), 1, 10)
      and se.type = 'legacy' and se.detail->>'label' like 'Joined the NBFC%'
      and se.created_at = w.created_at
  );

-- ── Partner leads (sellers + product requests) ──
insert into public.site_events (sid, type, detail, email, name, created_at)
select 'legacy-' || substr(md5(lower(l.email)), 1, 10), 'legacy',
       jsonb_build_object('label', case when l.kind = 'seller' then 'Applied to sell on Elume' else 'Requested a product' end
                                   || case when l.company is not null then ' · ' || l.company else '' end),
       l.email, l.name, l.created_at
from public.partner_leads l
where l.email is not null
  and not exists (
    select 1 from public.site_events se
    where se.sid = 'legacy-' || substr(md5(lower(l.email)), 1, 10)
      and se.type = 'legacy' and se.created_at = l.created_at
  );

-- ── Business accounts (email lives on the auth user) ──
insert into public.site_events (sid, type, detail, email, name, created_at)
select 'legacy-' || substr(md5(lower(u.email)), 1, 10), 'legacy',
       jsonb_build_object('label', 'Opened a business account' || case when p.company is not null then ' · ' || p.company else '' end
                                   || case when p.gstin is not null then ' · GSTIN ' || p.gstin else '' end),
       u.email, p.full_name, coalesce(p.updated_at, now())
from public.profiles p
join auth.users u on u.id = p.id
where p.account_type = 'business' and u.email is not null
  and not exists (
    select 1 from public.site_events se
    where se.sid = 'legacy-' || substr(md5(lower(u.email)), 1, 10)
      and se.type = 'legacy' and se.detail->>'label' like 'Opened a business account%'
  );

-- Sanity: how many people and actions were seeded
select count(distinct sid) as people, count(*) filter (where type = 'legacy') as actions
from public.site_events where sid like 'legacy-%';
