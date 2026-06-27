import wires from "@/content/blog/top-10-house-wires-cables-india.json";
import switchgear from "@/content/blog/top-10-mcbs-switchgear-india.json";
import modular from "@/content/blog/top-10-modular-switches-sockets-india.json";
import dbs from "@/content/blog/top-10-distribution-boards-india.json";
import fans from "@/content/blog/top-10-ceiling-fans-india.json";
import lighting from "@/content/blog/top-10-led-lights-india.json";

export type BlogPost = {
  slug: string;
  title: string;
  description: string;
  category: string;
  date: string;
  author: string;
  readMins: number;
  intro: string[];
  items: { rank: number; name: string; brand: string; body: string; bestFor: string }[];
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
};

const ALL = [wires, switchgear, modular, dbs, fans, lighting] as unknown as BlogPost[];

export function getAllPosts(): BlogPost[] {
  return [...ALL].sort((a, b) => (a.date < b.date ? 1 : -1));
}

export function getPost(slug: string): BlogPost | null {
  return ALL.find((p) => p.slug === slug) ?? null;
}

export function getSlugs(): string[] {
  return ALL.map((p) => p.slug);
}
