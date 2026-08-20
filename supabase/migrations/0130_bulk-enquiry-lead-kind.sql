-- 0130: allow 'bulk-enquiry' leads - the /bulk-enquiry page's quote-request
-- form (contact person, company, phone, email, requirement). Widens the kind
-- check exactly as 0121 did for metals-data; existing kinds unchanged.
--
-- The form itself works before this runs (the enquiry email is the primary
-- channel and sends regardless); this only enables the lead-table copy.

alter table public.partner_leads drop constraint if exists partner_leads_kind_check;
alter table public.partner_leads
  add constraint partner_leads_kind_check
  check (kind in ('seller', 'product-request', 'boq_unmatched', 'metals-data', 'bulk-enquiry'));
