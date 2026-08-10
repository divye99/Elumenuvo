-- 0109: partner_leads gains kind 'boq_feedback' - the in-app Smart BOM
-- rating (1-5 stars + comment) posted after a customer pushes their BOQ to
-- the cart. Shows in the admin Requests tab beside boq_unmatched demand.
alter table public.partner_leads drop constraint if exists partner_leads_kind_check;
alter table public.partner_leads
  add constraint partner_leads_kind_check
  check (kind in ('seller', 'product-request', 'boq_unmatched', 'boq_feedback'));
