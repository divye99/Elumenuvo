-- ═══════════════════════════════════════════════════════════════
-- 0094: Review photos + moderation + delivered-review reminders.
-- Idempotent: safe to re-run.
--
-- 1. photos: customers can attach up to 4 photos of the product/delivery.
--    Files land in the public `review-photos` storage bucket, uploaded
--    server-side (service role) after purchase verification; the column
--    stores public URLs.
-- 2. Moderation: new reviews now default to is_approved = false and appear
--    on the site only after approval in /admin/reviews. The public read
--    policy already filters on is_approved, so nothing else changes.
-- 3. review_reminder_sent_at on orders: the daily review-reminders cron
--    stamps it so the "you were delivered yesterday - leave a review"
--    email is sent at most once per order.
-- ═══════════════════════════════════════════════════════════════

-- ── 1. Photos ──
alter table public.reviews add column if not exists photos text[] not null default '{}';

-- Re-issue the column-restricted grant to include photos (0008 revoked
-- table-wide select; emails/order ids stay unreadable).
grant select (id, product_id, author_name, rating, title, body, is_verified, created_at, photos)
  on public.reviews to anon, authenticated;

-- Public bucket for review photos. Uploads happen ONLY via the service role
-- (no anon storage policies), reads are public URLs.
insert into storage.buckets (id, name, public)
  values ('review-photos', 'review-photos', true)
  on conflict (id) do nothing;

-- ── 2. Moderation ──
alter table public.reviews alter column is_approved set default false;

-- ── 3. Reminder bookkeeping ──
alter table public.orders add column if not exists review_reminder_sent_at timestamptz;
comment on column public.orders.review_reminder_sent_at is
  'Set by /api/cron/review-reminders after the one-time next-day review nudge email.';
