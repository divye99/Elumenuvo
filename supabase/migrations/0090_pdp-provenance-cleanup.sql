-- 0090: stop the product page quoting where we sourced its copy.
--
-- The visible "from havells.com" line under About this product / Technical
-- specifications is gone at the display layer, but two things the display fix
-- cannot reach still leak onto the page:
--
--   (a) 5 fan SKUs whose GUARANTEE VALUE ends "...needs to be registered on
--       havells.com". That is inside a spec value, so it renders in the specs
--       table. The fact is true and useful; only the domain has to go.
--   (b) 66 products whose "description" is raw scraped CSS beginning
--       "#html-body". That was never readable copy. Nulling the key makes
--       AboutBlock fall back cleanly, because it computes hasAny from
--       description OR key_features OR features.
--
-- Deliberately NOT touched: tech_specs->>'source' itself. 467 rows carry a
-- legitimate catalogue citation there, it is useful internally, and it is no
-- longer rendered to customers. Blanket-deleting the key would throw away
-- provenance we may need to re-verify a spec.

-- (a) Keep the guarantee, drop the domain.
update public.products
set tech_specs = jsonb_set(
      tech_specs,
      '{specs,Guarantee}',
      to_jsonb(regexp_replace(
        tech_specs->'specs'->>'Guarantee',
        '\*?product needs to be registered on havells\.com',
        'registration with the manufacturer is required',
        'gi'
      ))
    )
where tech_specs->'specs' ? 'Guarantee'
  and tech_specs->'specs'->>'Guarantee' ilike '%havells.com%';

-- (b) A description that is a stylesheet is not a description.
update public.products
set tech_specs = tech_specs - 'description'
where tech_specs->>'description' like '#html-body%';
