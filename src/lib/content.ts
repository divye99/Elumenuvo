/**
 * Site content (landing teasers + dashboard sample data) read from Supabase's
 * `content` table (one JSON blob per key), merged over the static defaults in
 * lib/data.ts. Anything missing in Supabase falls back to the static value, so
 * the site never breaks during/after the migration.
 */
import { createClient } from "@supabase/supabase-js";
import {
  HOME_CATALOGUE,
  HOMECHART,
  HOME_CATS,
  HERO_CATS,
  FEATURE_TAGS,
  HOME_BRANDS,
  STEPS,
  MINI_ROWS,
  CATS,
  AUTOPO,
  PROJECTS,
  STAGES,
  BOM_ROWS,
  PARSED_ROWS,
  TRACK_STEPS,
} from "@/lib/data";

export type SiteContent = {
  homeCatalogue: typeof HOME_CATALOGUE;
  homeChart: typeof HOMECHART;
  homeCats: typeof HOME_CATS;
  heroCats: typeof HERO_CATS;
  featureTags: typeof FEATURE_TAGS;
  homeBrands: typeof HOME_BRANDS;
  steps: typeof STEPS;
  miniRows: typeof MINI_ROWS;
  categories: typeof CATS;
  autoPo: typeof AUTOPO;
  projects: typeof PROJECTS;
  stages: typeof STAGES;
  bomRows: typeof BOM_ROWS;
  parsedRows: typeof PARSED_ROWS;
  trackSteps: typeof TRACK_STEPS;
};

export const STATIC_CONTENT: SiteContent = {
  homeCatalogue: HOME_CATALOGUE,
  homeChart: HOMECHART,
  homeCats: HOME_CATS,
  heroCats: HERO_CATS,
  featureTags: FEATURE_TAGS,
  homeBrands: HOME_BRANDS,
  steps: STEPS,
  miniRows: MINI_ROWS,
  categories: CATS,
  autoPo: AUTOPO,
  projects: PROJECTS,
  stages: STAGES,
  bomRows: BOM_ROWS,
  parsedRows: PARSED_ROWS,
  trackSteps: TRACK_STEPS,
};

function client() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function getSiteContent(): Promise<SiteContent> {
  const c = client();
  if (!c) return STATIC_CONTENT;
  try {
    const { data, error } = await c.from("content").select("key, data");
    if (error || !data || data.length === 0) return STATIC_CONTENT;
    const map = new Map((data as { key: string; data: unknown }[]).map((r) => [r.key, r.data]));
    const merged = { ...STATIC_CONTENT };
    (Object.keys(STATIC_CONTENT) as (keyof SiteContent)[]).forEach((k) => {
      const v = map.get(k);
      if (v != null) (merged as Record<string, unknown>)[k] = v;
    });
    return merged;
  } catch {
    return STATIC_CONTENT;
  }
}
