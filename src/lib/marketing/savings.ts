/**
 * Savings model — the single source of truth for both the savings calculator and
 * the supply-chain animation, so the two never disagree.
 *
 * Grounded in the deck: a 4-5 layer distribution chain stacks 25-35% cumulative
 * cost; buying through Elume saves ~15-25% vs the traditional chain.
 */

export const SAVINGS_LOW = 0.15;
export const SAVINGS_HIGH = 0.25;
export const SAVINGS_MID = 0.2;

// Margin added at each layer of the traditional chain (midpoints from the deck).
export const SUPPLY_CHAIN: { label: string; margin: number; note: string }[] = [
  { label: "Manufacturer", margin: 0, note: "Base price" },
  { label: "National Stockist", margin: 0.065, note: "+5–8%" },
  { label: "Regional Distributor", margin: 0.06, note: "+5–7%" },
  { label: "Sub-Distributor / Retailer", margin: 0.1, note: "+8–12%" },
];

/** Cumulative markup of the traditional chain (e.g. 0.24 = +24% over base). */
export function traditionalMarkup(): number {
  return SUPPLY_CHAIN.reduce((acc, l) => acc * (1 + l.margin), 1) - 1;
}

export type Savings = {
  monthlySpend: number;
  annualSpend: number;
  monthlyMid: number;
  annualMid: number;
  annualLow: number;
  annualHigh: number;
  savingsRateMid: number;
};

export function computeSavings(monthlySpend: number): Savings {
  const spend = Math.max(0, monthlySpend || 0);
  const annualSpend = spend * 12;
  return {
    monthlySpend: spend,
    annualSpend,
    monthlyMid: spend * SAVINGS_MID,
    annualMid: annualSpend * SAVINGS_MID,
    annualLow: annualSpend * SAVINGS_LOW,
    annualHigh: annualSpend * SAVINGS_HIGH,
    savingsRateMid: SAVINGS_MID,
  };
}
