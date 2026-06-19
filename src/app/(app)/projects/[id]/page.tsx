import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, Badge } from "@/components/ui";
import { getCurrentOrgId } from "@/lib/auth/session";
import { getProject, getProjectBom, type BomLine } from "@/lib/queries/projects";
import { formatINR, formatINRCompact } from "@/lib/utils";
import { ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";

const phaseLabel: Record<string, string> = {
  rough_in: "Rough-in — conduits & wiring",
  panel: "Panel — switchgear & DBs",
  finishing: "Finishing — fans & luminaires",
};
const phaseOrder = ["rough_in", "panel", "finishing"];

export default async function ProjectDetailPage({ params }: { params: { id: string } }) {
  const orgId = await getCurrentOrgId();
  const project = await getProject(orgId, params.id);
  if (!project) notFound();

  const { bom, lines, total } = await getProjectBom(orgId, params.id);

  // Group BOM lines by construction phase (the docs' phased schedule).
  const byPhase = new Map<string, BomLine[]>();
  for (const l of lines) {
    const key = l.phase ?? "unphased";
    if (!byPhase.has(key)) byPhase.set(key, []);
    byPhase.get(key)!.push(l);
  }
  const phases = phaseOrder.filter((p) => byPhase.has(p));

  return (
    <>
      <PageHeader
        title={project.name}
        subtitle={`${project.location ?? ""} · ${project.scope ?? ""}`}
        action={
          <Link
            href="/projects"
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> All projects
          </Link>
        }
      />

      <div className="space-y-6 p-8">
        {/* Summary strip */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Summary label="Status" value={project.status} />
          <Summary label="Budget" value={formatINRCompact(Number(project.budgetAmount ?? 0))} />
          <Summary label="BOM Value" value={formatINRCompact(total)} />
          <Summary
            label="Budget Used"
            value={
              project.budgetAmount
                ? `${((total / Number(project.budgetAmount)) * 100).toFixed(0)}%`
                : "—"
            }
          />
        </div>

        {/* BOM by phase */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Bill of Materials
            </h2>
            {bom && (
              <Badge variant={bom.status === "finalised" ? "success" : "primary"}>
                {bom.status} · {bom.source.replace("_", " ")}
              </Badge>
            )}
          </div>

          {!bom || lines.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                No BOM lines yet for this project.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-5">
              {phases.map((phase) => {
                const items = byPhase.get(phase)!;
                const phaseTotal = items.reduce((s, l) => s + l.lineTotal, 0);
                return (
                  <Card key={phase}>
                    <div className="flex items-center justify-between border-b px-5 py-3">
                      <span className="text-sm font-semibold">{phaseLabel[phase] ?? phase}</span>
                      <span className="text-sm font-semibold tabular-nums">
                        {formatINR(phaseTotal)}
                      </span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                            <th className="px-5 py-2 font-medium">Item</th>
                            <th className="px-5 py-2 font-medium">Brand</th>
                            <th className="px-5 py-2 text-right font-medium">Qty</th>
                            <th className="px-5 py-2 text-right font-medium">Unit Price</th>
                            <th className="px-5 py-2 text-right font-medium">Line Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {items.map((l) => (
                            <tr key={l.id} className="border-b last:border-0">
                              <td className="px-5 py-2.5">{l.description}</td>
                              <td className="px-5 py-2.5">
                                {l.selectedBrand ? (
                                  <Badge variant="accent">{l.selectedBrand}</Badge>
                                ) : (
                                  <span className="text-muted-foreground">Not selected</span>
                                )}
                              </td>
                              <td className="px-5 py-2.5 text-right tabular-nums">
                                {l.quantity} {l.unit}
                              </td>
                              <td className="px-5 py-2.5 text-right tabular-nums">
                                {formatINR(l.unitPrice)}
                              </td>
                              <td className="px-5 py-2.5 text-right font-medium tabular-nums">
                                {formatINR(l.lineTotal)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Card>
                );
              })}

              <div className="flex justify-end">
                <div className="rounded-lg border bg-card px-6 py-3 text-right">
                  <div className="text-xs text-muted-foreground">Total BOM value</div>
                  <div className="text-xl font-bold tabular-nums">{formatINR(total)}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-bold capitalize tabular-nums">{value}</div>
    </div>
  );
}
