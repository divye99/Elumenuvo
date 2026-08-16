-- 0116: ELIN - the Elume Identification Number (our ASIN).
--
-- Every product gets a permanent 10-character code, held in products.elin,
-- alongside brand_sku (the manufacturer's code). Two namespaces:
--   General:     'E' + 9 chars from the alphabet 234679CDFGHJKMPR
--                (no 0/O, 1/I/L, U - phone- and print-proof; the missing L/U
--                 also guarantees no clash with the ELUME namespace)
--   Elume brand: 'ELUME' + 5-digit sequence, ELUME00001 upward, in catalogue
--                order. Future Elume products take max(number)+1.
--
-- General ELINs derive deterministically from md5(id) - the same derivation
-- lives in scripts/lib/elin.mjs, so import generators (0114+, run AFTER this
-- migration) mint identical codes to what a backfill would. Existing product
-- ids/URLs are untouched: /catalogue/<ELIN> resolves via 301 in the app.
--
-- RUN THIS BEFORE 0114 (L&K) and 0115 (Rajdhani): those inserts write the
-- elin column, which this migration creates.

alter table public.products add column if not exists elin text;

-- Elume house brand: human-readable sequence in catalogue order.
with e as (
  select id, row_number() over (order by sort_order, id) as rn
  from public.products
  where brand = 'Elume' and elin is null
)
update public.products p
set elin = 'ELUME' || lpad(e.rn::text, 5, '0')
from e where p.id = e.id;

-- Everyone else: deterministic hash of the existing id.
update public.products
set elin = 'E' || translate(upper(substr(md5(id), 1, 9)),
                            '0123456789ABCDEF', '234679CDFGHJKMPR')
where elin is null;

-- Collision guard (space is 16^9 = 68 billion; a clash is ~impossible, but a
-- unique index must never fail a deploy): any duplicate group keeps its first
-- member and rederives the rest from the next hash segment.
with d as (
  select id, row_number() over (partition by elin order by id) as rn
  from public.products
  where elin like 'E%' and elin not like 'ELUME%'
)
update public.products p
set elin = 'E' || translate(upper(substr(md5(p.id), 10, 9)),
                            '0123456789ABCDEF', '234679CDFGHJKMPR')
from d where p.id = d.id and d.rn > 1;

create unique index if not exists products_elin_key on public.products (elin);
