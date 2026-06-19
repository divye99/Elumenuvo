import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, Badge } from "@/components/ui";
import {
  listComparisonGroups,
  listCategories,
  catalogueStats,
} from "@/lib/queries/catalogue";
import { formatINR, cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

function specSummary(specs: Record<string, unknown>) {
  return Object.entries(specs)
    .slice(0, 4)
    .map(([k, v]) => `${k.replace(/_/g, " ")}: ${v}`)
    .join("  ·  ");
}

export default async function CataloguePage({
  searchParams,
}: {
  searchParams: { cat?: string };
}) {
  const activeCat = searchParams.cat;
  const [groups, categories, stats] = await Promise.all([
    listComparisonGroups(activeCat),
    listCategories(),
    catalogueStats(),
  ]);

  // Top-level categories only for the filter bar.
  const topCats = categories.filter((c) => !c.parentId);

  return (
    <>
      <PageHeader
        title="Multi-Brand Catalogue"
        subtitle={`Transparent pricing across ${stats.brands} brands · ${stats.groups} comparable products · ${stats.products} SKUs. Same spec, every brand, side by side.`}
      />

      <div className="p-8">
        {/* Category filter */}
        <div className="mb-6 flex flex-wrap gap-2">
          <FilterChip label="All categories" href="/catalogue" active={!activeCat} />
          {topCats.map((c) => (
            <FilterChip
              key={c.id}
              label={c.name}
              href={`/catalogue?cat=${c.slug}`}
              active={activeCat === c.slug}
            />
          ))}
        </div>

        {/* Comparison groups */}
        <div className="space-y-5">
          {groups.map((g) => {
            const cheapest = Math.min(...g.options.map((o) => o.basePrice));
            return (
              <Card key={g.comparisonGroup}>
                <CardContent className="pt-5">
                  <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h3 className="font-semibold">{g.label}</h3>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {g.categoryName} · sold per {g.unit} · {specSummary(g.specs)}
                      </p>
                    </div>
                    <Badge variant="primary">{g.options.length} brands</Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                    {g.options.map((o) => {
                      const isCheapest = o.basePrice === cheapest;
                      const savePct =
                        o.mrp && o.mrp > 0
                          ? Math.round(((o.mrp - o.basePrice) / o.mrp) * 100)
                          : 0;
                      return (
                        <div
                          key={o.productId}
                          className={cn(
                            "relative rounded-lg border p-3",
                            isCheapest ? "border-accent bg-accent/5" : "bg-card"
                          )}
                        >
                          {isCheapest && (
                            <span className="absolute -top-2 left-2 rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold text-accent-foreground">
                              Best price
                            </span>
                          )}
                          <div className="text-sm font-semibold">{o.brand}</div>
                          <div className="mt-1 text-lg font-bold tabular-nums">
                            {formatINR(o.basePrice)}
                          </div>
                          {o.mrp && (
                            <div className="text-xs text-muted-foreground">
                              <span className="line-through">{formatINR(o.mrp)}</span>{" "}
                              {savePct > 0 && (
                                <span className="font-medium text-success">−{savePct}%</span>
                              )}
                            </div>
                          )}
                          <div className="mt-1 text-[11px] text-muted-foreground">
                            Lead {o.leadTimeDays}d · {o.skuCode}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </>
  );
}

function FilterChip({
  label,
  href,
  active,
}: {
  label: string;
  href: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "bg-card text-muted-foreground hover:bg-muted"
      )}
    >
      {label}
    </Link>
  );
}
