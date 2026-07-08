/**
 * Repricing rules — turn tracked competitor prices into a recommended Elume
 * price, with guardrails that stop nonsense (e.g. pricing above MRP because a
 * mismatched competitor SKU is far pricier). Pure + shared by the admin radar.
 */

export type RepricingRule = {
  scope: string; // 'global' or a category name
  basis: "market_avg" | "cheapest"; // what to price against
  delta: number; // amount to go under the basis
  delta_type: "rupees" | "percent";
  max_change_pct: number; // block a recommendation that moves our price more than this
  never_above_mrp: boolean; // block recommendations above MRP
  enabled: boolean;
};

export const DEFAULT_RULE: RepricingRule = {
  scope: "global",
  basis: "cheapest", // Amazon-style: find the lowest across all mapped sellers and undercut it
  delta: 1,
  delta_type: "rupees",
  max_change_pct: 40,
  never_above_mrp: true,
  enabled: true,
};

/** Category rule if present and enabled, else the global rule, else default. */
export function resolveRule(category: string, rules: RepricingRule[]): RepricingRule {
  const byScope = new Map(rules.map((r) => [r.scope, r]));
  return byScope.get(category) ?? byScope.get("global") ?? DEFAULT_RULE;
}

export type Recommendation = {
  basisPrice: number; // market avg or cheapest, comparable to our unit
  target: number; // recommended Elume price
  changePct: number; // |target − our| / our
  blocked: string | null; // guardrail reason, or null
  rule: RepricingRule;
};

/**
 * Compute a recommended price from the comparable competitor prices for one
 * product. `comparables` are already unit-normalised (competitor price × factor).
 */
export function recommend(
  input: { ourPrice: number; mrp: number; category: string; comparables: number[] },
  rules: RepricingRule[]
): Recommendation | null {
  const comps = input.comparables.filter((v) => Number.isFinite(v) && v > 0);
  if (comps.length === 0) return null;
  const rule = resolveRule(input.category, rules);
  if (!rule.enabled) return null;

  const basisPrice =
    rule.basis === "cheapest" ? Math.min(...comps) : comps.reduce((a, b) => a + b, 0) / comps.length;

  const raw = rule.delta_type === "percent" ? basisPrice * (1 - rule.delta / 100) : basisPrice - rule.delta;
  const target = Math.max(1, Math.round(raw));
  const changePct = input.ourPrice > 0 ? Math.abs(target - input.ourPrice) / input.ourPrice * 100 : 0;

  let blocked: string | null = null;
  if (rule.never_above_mrp && input.mrp > 0 && target > input.mrp) blocked = "above MRP";
  else if (changePct > rule.max_change_pct) blocked = `${Math.round(changePct)}% swing`;

  return { basisPrice: Math.round(basisPrice * 100) / 100, target, changePct, blocked, rule };
}
