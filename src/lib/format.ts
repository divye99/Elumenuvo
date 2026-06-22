// ₹ formatting helpers — ported 1:1 from the prototype so figures match.

export function fmt(n: number): string {
  return "₹" + Math.round(n).toLocaleString("en-IN");
}

// to lakhs
export function fmtL(n: number): string {
  if (n >= 100000) return "₹" + (n / 100000).toFixed(2) + "L";
  return fmt(n);
}

// crore-scale label used by the savings calculator
export function fmtCr(n: number): string {
  if (n >= 1) return n.toFixed(2).replace(/\.00$/, "") + " Cr";
  return (n * 100).toFixed(0) + " L";
}
