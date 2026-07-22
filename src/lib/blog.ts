import wires from "@/content/blog/top-10-house-wires-cables-india.json";
import switchgear from "@/content/blog/top-10-mcbs-switchgear-india.json";
import modular from "@/content/blog/top-10-modular-switches-sockets-india.json";
import dbs from "@/content/blog/top-10-distribution-boards-india.json";
import fans from "@/content/blog/top-10-ceiling-fans-india.json";
import lighting from "@/content/blog/top-10-led-lights-india.json";
import bldcFans from "@/content/blog/top-10-bldc-ceiling-fans-india.json";
import battens from "@/content/blog/top-10-led-battens-tubelights-india.json";
import panels from "@/content/blog/top-10-led-panel-lights-india.json";
import mcbRccb from "@/content/blog/top-10-mcbs-rccbs-india.json";
import exhaust from "@/content/blog/top-10-exhaust-fans-india.json";
import floodLights from "@/content/blog/top-10-outdoor-flood-lights-india.json";
import pumps from "@/content/blog/top-10-water-pumps-india.json";
import bulbs from "@/content/blog/top-10-led-bulbs-india.json";
import wireSize from "@/content/blog/which-wire-size-guide-india.json";
import wireGrades from "@/content/blog/fr-frls-hrfr-hffr-wire-guide.json";
import mcbRating from "@/content/blog/which-mcb-rating-guide-india.json";
import bldcSavings from "@/content/blog/bldc-vs-normal-fan-savings.json";
import coilLength from "@/content/blog/wire-coil-length-guide-2bhk-3bhk.json";
import checklist from "@/content/blog/electrical-material-checklist-2bhk-3bhk.json";
import protection from "@/content/blog/mcb-vs-rccb-vs-rcbo-guide.json";
import colourTemp from "@/content/blog/led-colour-temperature-guide.json";

export type BlogPost = {
  slug: string;
  title: string;
  description: string;
  category: string;
  date: string;
  author: string;
  readMins: number;
  intro: string[];
  items: { rank: number; name: string; brand: string; body: string; bestFor: string; productId?: string | null }[];
  buyingTips: string[];
  faq: { q: string; a: string }[];
};

// Map a blog category to its catalogue filter (for cross-linking).
export const CATEGORY_TO_CATALOGUE: Record<string, string> = {
  "Wires & Cables": "Wires & Cables",
  Switchgear: "Switchgear",
  Modular: "Modular",
  "DB & Panels": "DB & Panels",
  Fans: "Fans",
  Lighting: "Lighting",
  Pumps: "Pumps",
};

const ALL = [wires, switchgear, modular, dbs, fans, lighting, bldcFans, battens, panels, mcbRccb, exhaust, floodLights, pumps, bulbs, wireSize, wireGrades, mcbRating, bldcSavings, coilLength, checklist, protection, colourTemp] as unknown as BlogPost[];

export function getAllPosts(): BlogPost[] {
  return [...ALL].sort((a, b) => (a.date < b.date ? 1 : -1));
}

export function getPost(slug: string): BlogPost | null {
  return ALL.find((p) => p.slug === slug) ?? null;
}

export function getSlugs(): string[] {
  return ALL.map((p) => p.slug);
}

/** One product's editorial verdict from the top-10 guides. */
export type EditorialPick = { bestFor: string; rank: number; slug: string; postTitle: string };

/** productId -> verdict, built from every ranked item mapped to a real SKU.
 *  Server-side only (keeps the post JSONs out of client bundles); pages pass
 *  the slim result down as props. */
export function getEditorialPicks(): Record<string, EditorialPick> {
  const picks: Record<string, EditorialPick> = {};
  for (const post of ALL) {
    for (const it of post.items) {
      if (it.productId) picks[it.productId] = { bestFor: it.bestFor, rank: it.rank, slug: post.slug, postTitle: post.title };
    }
  }
  return picks;
}
