-- ═══════════════════════════════════════════════════════════════
-- 0058 · Atomic discount consumption
-- Two orders paying at nearly the same moment could both honour a one-time
-- code (read-then-write race). This function increments used_count in one
-- statement, capped at max_uses, and reports whether it actually consumed.
-- ═══════════════════════════════════════════════════════════════

create or replace function public.consume_discount_code(p_code text)
returns boolean
language sql
security definer
set search_path = public
as $$
  update public.discount_codes
     set used_count = used_count + 1
   where code = p_code
     and used_count < max_uses
  returning true;
$$;

revoke all on function public.consume_discount_code(text) from public, anon, authenticated;
