-- ═══════════════════════════════════════════════════════════════
-- 0050 · Move Norisys fan REGULATORS from Fans to Modular
--
-- The old BestOfElectricals import filed 18 Norisys fan regulators (modular
-- switch-plate devices: "Cube C5910.02 120W 2M Bar Knob Grey Fan Regulator",
-- TG9 step-type regulators) under Fans because "Fan" appears in the name.
-- They surfaced when the home Fans shelf started showing Norisys as a fan
-- brand. Every other brand's regulators live in Modular, where these belong.
--
-- Predicate-based and idempotent; a full-category sweep confirmed no other
-- non-fan products sit in Fans (the remaining terse names, "Hill Briz 1200mm
-- Fan" etc., are real ceiling fans and are untouched).
-- ═══════════════════════════════════════════════════════════════

update public.products
set category = 'Modular'
where category = 'Fans'
  and brand = 'Norisys'
  and name ~* 'regulator|ragulator';

-- Sanity: should return 0 rows
select id, name from public.products
where category = 'Fans' and name ~* 'regulator|ragulator';
