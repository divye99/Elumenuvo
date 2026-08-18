-- 0121: allow 'metals-data' partner leads - the Metals (beta) page's
-- "always-on data access" interest form. Widens the kind check exactly as
-- 0108 did for boq_unmatched; existing kinds unchanged.

alter table public.partner_leads drop constraint if exists partner_leads_kind_check;
alter table public.partner_leads
  add constraint partner_leads_kind_check
  check (kind in ('seller', 'product-request', 'boq_unmatched', 'metals-data'));
