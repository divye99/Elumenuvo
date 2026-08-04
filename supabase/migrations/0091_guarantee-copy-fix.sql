-- 0091: repair the guarantee wording left by 0090.
--
-- 0090 replaced the trailing footnote "*product needs to be registered on
-- havells.com" with "registration with the manufacturer is required", but the
-- original "*" was doing the work of a separator. The result reads as one
-- run-on clause:
--
--   "(2 + 1*) Years registration with the manufacturer is required"
--
-- The domain removal was correct; only the punctuation needs restoring. Scoped
-- to the exact string 0090 produced, so re-running is a no-op.

update public.products
set tech_specs = jsonb_set(
      tech_specs,
      '{specs,Guarantee}',
      to_jsonb(replace(
        tech_specs->'specs'->>'Guarantee',
        'Years registration with the manufacturer is required',
        'Years · *registration with the manufacturer required'
      ))
    )
where tech_specs->'specs' ? 'Guarantee'
  and tech_specs->'specs'->>'Guarantee' like '%Years registration with the manufacturer is required%';
