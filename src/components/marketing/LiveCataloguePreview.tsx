import { listComparisonGroups } from "@/lib/queries/catalogue";
import { formatINR } from "@/lib/utils";

/**
 * Public teaser pulling REAL catalogue data — a small multi-brand price
 * comparison rendered on the landing. Degrades gracefully if the DB isn't
 * connected yet (so the rest of the landing always renders).
 */
export async function LiveCataloguePreview() {
  let groups: Awaited<ReturnType<typeof listComparisonGroups>> = [];
  try {
    groups = (await listComparisonGroups()).filter((g) => g.options.length >= 3).slice(0, 3);
  } catch {
    return null; // DB not connected — hide the section rather than crash.
  }
  if (!groups.length) return null;

  return (
    <div className="space-y-4">
      {groups.map((g) => {
        const cheapest = Math.min(...g.options.map((o) => o.basePrice));
        return (
          <div key={g.comparisonGroup} className="rounded-xl border bg-card p-4">
            <div className="mb-3 text-sm font-semibold">{g.label}</div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {g.options.slice(0, 4).map((o) => {
                const best = o.basePrice === cheapest;
                return (
                  <div
                    key={o.productId}
                    className={`rounded-lg border p-2.5 text-center ${
                      best ? "border-accent bg-accent/5" : ""
                    }`}
                  >
                    <div className="text-xs font-medium text-muted-foreground">{o.brand}</div>
                    <div className="text-sm font-bold tabular-nums">{formatINR(o.basePrice)}</div>
                    {best && (
                      <div className="text-[10px] font-semibold text-accent">Best price</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
