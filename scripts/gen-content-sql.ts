// Emits Supabase SQL for the `content` table (landing teasers + dashboard sample
// data) from lib/data.ts. Run: npx tsx scripts/gen-content-sql.ts > supabase/migrations/0006_content.sql
import * as D from "../src/lib/data";

const CONTENT: Record<string, unknown> = {
  homeCatalogue: D.HOME_CATALOGUE,
  homeChart: D.HOMECHART,
  homeCats: D.HOME_CATS,
  heroCats: D.HERO_CATS,
  featureTags: D.FEATURE_TAGS,
  homeBrands: D.HOME_BRANDS,
  steps: D.STEPS,
  miniRows: D.MINI_ROWS,
  categories: D.CATS,
  autoPo: D.AUTOPO,
  projects: D.PROJECTS,
  stages: D.STAGES,
  bomRows: D.BOM_ROWS,
  parsedRows: D.PARSED_ROWS,
  trackSteps: D.TRACK_STEPS,
};

const esc = (s: string) => s.replace(/'/g, "''");

const header = `-- ───────────────────────────────────────────────────────────────
-- Elume site content (landing teasers + dashboard sample data) → Supabase
-- Paste into Supabase → SQL Editor → Run. Idempotent (re-runnable).
-- Each row is an editable JSON blob; the app merges these over code defaults.
-- ───────────────────────────────────────────────────────────────

create table if not exists public.content (
  key        text primary key,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.content enable row level security;
drop policy if exists "public read content" on public.content;
create policy "public read content" on public.content
  for select to anon, authenticated using (true);

insert into public.content (key, data) values`;

const rows = Object.entries(CONTENT)
  .map(([k, v]) => `  ('${k}', '${esc(JSON.stringify(v))}'::jsonb)`)
  .join(",\n");

const footer = `
on conflict (key) do update set data = excluded.data, updated_at = now();
`;

process.stdout.write(`${header}\n${rows}${footer}`);
