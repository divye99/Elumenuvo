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
import extBoards from "@/content/blog/top-10-extension-boards-spike-guards-india.json";
import sixteenAmp from "@/content/blog/6a-vs-16a-switches-sockets-guide.json";
import plateSizes from "@/content/blog/modular-plate-sizes-guide.json";
import waterHeaters from "@/content/blog/water-heater-geyser-buying-guide-india.json";
import contactors from "@/content/blog/what-is-a-contactor-guide.json";
import earthing from "@/content/blog/earthing-guide-india.json";
import stabilizerInverter from "@/content/blog/stabilizer-vs-inverter-guide.json";
import surgeProtection from "@/content/blog/surge-protection-guide-india.json";
import wireColours from "@/content/blog/wire-colour-code-india.json";
import cuVsAl from "@/content/blog/copper-vs-aluminium-wire-guide.json";
import mcbTripping from "@/content/blog/mcb-keeps-tripping-guide.json";
import rccbSensitivity from "@/content/blog/rccb-30ma-vs-100ma-guide.json";
import fanSize from "@/content/blog/ceiling-fan-size-guide.json";
import exhaustSize from "@/content/blog/exhaust-fan-size-guide.json";
import norisysSeries from "@/content/blog/norisys-cube-vs-tg9-guide.json";
import finishLookbook from "@/content/blog/designer-switch-finishes-lookbook.json";
import lumens from "@/content/blog/lumens-not-watts-led-brightness-guide.json";
import wireBrands from "@/content/blog/havells-vs-polycab-vs-kei-wires.json";
import wiringCost from "@/content/blog/house-wiring-cost-2bhk-3bhk.json";
import dbWays from "@/content/blog/distribution-board-ways-guide.json";
import geyserSize from "@/content/blog/geyser-size-guide.json";
import instantVsStorage from "@/content/blog/instant-vs-storage-geyser.json";
import acSizing from "@/content/blog/ac-mcb-wire-size-guide.json";
import flickering from "@/content/blog/lights-flickering-causes-guide.json";
import twoWay from "@/content/blog/two-way-switch-guide.json";
import pumpSize from "@/content/blog/water-pump-size-guide.json";
import ipRatings from "@/content/blog/ip-ratings-outdoor-lighting-guide.json";
import switchgearBrands from "@/content/blog/havells-vs-abb-vs-lauritz-knudsen-switchgear.json";
import billSavings from "@/content/blog/reduce-electricity-bill-guide.json";
import pointHeights from "@/content/blog/switch-board-height-guide.json";

export type BlogPost = {
  slug: string;
  title: string;
  description: string;
  category: string;
  date: string;
  author: string;
  readMins: number;
  intro: string[];
  /** Quick-answer bullets shown in a TL;DR box above the intro (also a
   *  featured-snippet target). Optional - older guides may not have one. */
  tldr?: string[];
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
  "Extension Boards": "Extension Boards",
};

const ALL = [wires, switchgear, modular, dbs, fans, lighting, bldcFans, battens, panels, mcbRccb, exhaust, floodLights, pumps, bulbs, wireSize, wireGrades, mcbRating, bldcSavings, coilLength, checklist, protection, colourTemp, extBoards, sixteenAmp, plateSizes, waterHeaters, contactors, earthing, stabilizerInverter, surgeProtection, wireColours, cuVsAl, mcbTripping, rccbSensitivity, fanSize, exhaustSize, lumens, wireBrands, norisysSeries, finishLookbook, wiringCost, dbWays, geyserSize, instantVsStorage, acSizing, flickering, twoWay, pumpSize, ipRatings, switchgearBrands, billSavings, pointHeights] as unknown as BlogPost[];

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

/** Editorial ranks scoped per CATALOGUE category. The category's own
 *  "top-10-..." guide is authoritative; other posts in that category only
 *  fill products the top-10 guide didn't rank. This is what keeps a
 *  Top-rated rail from showing five different #1s pulled from five
 *  unrelated guides. */
export function getCategoryRanks(): Record<string, Record<string, number>> {
  const out: Record<string, Record<string, number>> = {};
  const posts = [...ALL].sort((a, b) => {
    const ta = a.slug.startsWith("top-10-") ? 0 : 1;
    const tb = b.slug.startsWith("top-10-") ? 0 : 1;
    return ta - tb;
  });
  for (const post of posts) {
    const cat = CATEGORY_TO_CATALOGUE[post.category];
    if (!cat) continue;
    const bucket = (out[cat] ??= {});
    for (const it of post.items) {
      if (it.productId && bucket[it.productId] == null) bucket[it.productId] = it.rank;
    }
  }
  return out;
}

export function getEditorialPicks(): Record<string, EditorialPick> {
  const picks: Record<string, EditorialPick> = {};
  for (const post of ALL) {
    for (const it of post.items) {
      if (it.productId) picks[it.productId] = { bestFor: it.bestFor, rank: it.rank, slug: post.slug, postTitle: post.title };
    }
  }
  return picks;
}
