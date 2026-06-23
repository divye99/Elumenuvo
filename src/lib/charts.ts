// SVG price-history chart engine — ported 1:1 from the prototype.
import { fmt } from "./format";
import { type HomeChartSeries, type Product } from "./data";

export type ChartModel = {
  brand?: string;
  name?: string;
  unit?: string;
  vbW?: number;
  vbH?: number;
  elumePath: string;
  marketPath: string;
  bandPath: string;
  endX: string;
  endYe: string;
  endYm: string;
  gridLines: { y: string }[];
  cur: string;
  mkt: string;
  save: string;
  avg: string;
  low: string;
};

export function homeElumeSeries(p: HomeChartSeries): number[] {
  return p.market.map((m, i) => m * (1 - (p.s0 + ((p.s1 - p.s0) * i) / 11)));
}

// Landing pricing engine — fixed 580×230 viewBox.
export function buildHomeChart(series: Record<string, HomeChartSeries>, id: string): ChartModel {
  const p = series[id] ?? Object.values(series)[0];
  const market = p.market;
  const elume = homeElumeSeries(p);
  const all = market.concat(elume);
  let min = Math.min.apply(null, all),
    max = Math.max.apply(null, all);
  const pad = (max - min) * 0.22 || 1;
  min -= pad;
  max += pad;
  const W = 580,
    H = 230,
    L = 8,
    R = 12,
    T = 16,
    B = 24;
  const xF = (i: number) => L + (i * (W - L - R)) / 11;
  const yF = (v: number) => T + (1 - (v - min) / (max - min)) * (H - T - B);
  const line = (arr: number[]) =>
    arr.map((v, i) => (i ? "L" : "M") + xF(i).toFixed(1) + " " + yF(v).toFixed(1)).join(" ");
  let band = "M" + xF(0).toFixed(1) + " " + yF(elume[0]).toFixed(1);
  for (let i = 1; i < 12; i++) band += " L" + xF(i).toFixed(1) + " " + yF(elume[i]).toFixed(1);
  band += " L" + xF(11).toFixed(1) + " " + yF(market[11]).toFixed(1);
  for (let i = 10; i >= 0; i--) band += " L" + xF(i).toFixed(1) + " " + yF(market[i]).toFixed(1);
  band += " Z";
  const cur = elume[11],
    mkt = market[11];
  return {
    brand: p.brand,
    name: p.name,
    unit: p.unit,
    elumePath: line(elume),
    marketPath: line(market),
    bandPath: band,
    endX: xF(11).toFixed(1),
    endYe: yF(elume[11]).toFixed(1),
    endYm: yF(market[11]).toFixed(1),
    gridLines: [0.25, 0.5, 0.75].map((f) => ({ y: (T + f * (H - T - B)).toFixed(1) })),
    cur: fmt(cur),
    mkt: fmt(mkt),
    save: Math.round((1 - cur / mkt) * 100) + "%",
    avg: fmt(elume.reduce((a, b) => a + b, 0) / 12),
    low: fmt(Math.min.apply(null, elume)),
  };
}

// Deterministic FNV hash + mulberry32 PRNG — drives the per-product chart.
function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function rng(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// App product detail — deterministic per SKU, 860×240 viewBox.
export function buildProductChart(p: Product): ChartModel {
  const r = rng(hash(p.id));
  const drift = (r() - 0.5) * 0.14;
  let mults: number[] = [];
  for (let i = 0; i < 12; i++) {
    const trend = 1 + drift * (i / 11 - 0.5);
    const noise = (r() - 0.5) * 0.05;
    mults.push(trend * (1 + noise));
  }
  const last = mults[11];
  mults = mults.map((m) => m / last);
  const market = mults.map((m) => p.market * m);
  const ratio = p.price / p.market;
  const elume = market.map((m, i) => m * (1 - (1 - ratio) * (0.55 + (0.45 * i) / 11)));
  elume[11] = p.price;
  market[11] = p.market;
  const all = market.concat(elume);
  let min = Math.min.apply(null, all),
    max = Math.max.apply(null, all);
  const pad = (max - min) * 0.22 || 1;
  min -= pad;
  max += pad;
  const W = 860,
    H = 240,
    L = 10,
    R = 14,
    T = 16,
    B = 24;
  const xF = (i: number) => L + (i * (W - L - R)) / 11;
  const yF = (v: number) => T + (1 - (v - min) / (max - min)) * (H - T - B);
  const line = (arr: number[]) =>
    arr.map((v, i) => (i ? "L" : "M") + xF(i).toFixed(1) + " " + yF(v).toFixed(1)).join(" ");
  let band = "M" + xF(0).toFixed(1) + " " + yF(elume[0]).toFixed(1);
  for (let i = 1; i < 12; i++) band += " L" + xF(i).toFixed(1) + " " + yF(elume[i]).toFixed(1);
  band += " L" + xF(11).toFixed(1) + " " + yF(market[11]).toFixed(1);
  for (let i = 10; i >= 0; i--) band += " L" + xF(i).toFixed(1) + " " + yF(market[i]).toFixed(1);
  band += " Z";
  return {
    vbW: W,
    vbH: H,
    elumePath: line(elume),
    marketPath: line(market),
    bandPath: band,
    endX: xF(11).toFixed(1),
    endYe: yF(elume[11]).toFixed(1),
    endYm: yF(market[11]).toFixed(1),
    gridLines: [0.25, 0.5, 0.75].map((f) => ({ y: (T + f * (H - T - B)).toFixed(1) })),
    cur: fmt(p.price),
    mkt: fmt(p.market),
    save: Math.round((1 - ratio) * 100) + "%",
    avg: fmt(elume.reduce((a, b) => a + b, 0) / 12),
    low: fmt(Math.min.apply(null, elume)),
  };
}
