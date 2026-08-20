-- 0125: Admin-run Smart BOM uploads.
--
-- The owner runs BOQs on customers' behalf from /admin/boq (fulfilling
-- enquiries). Admin sessions use the cookie gate, not Supabase Auth, so
-- there is no auth.users id to attach: user_id becomes nullable and null
-- means "run by the admin console". RLS is unaffected (both tables are
-- service-role only, no anon policies).

alter table public.boq_uploads alter column user_id drop not null;
alter table public.boq_lines   alter column user_id drop not null;

select 'boq tables accept admin-run uploads' as status;
