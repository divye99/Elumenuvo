import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, Badge, Progress } from "@/components/ui";
import { getCurrentOrgId } from "@/lib/auth/session";
import { getPortfolioSummary, getProjectRollups } from "@/lib/queries/dashboard";
import { formatINRCompact, formatINR } from "@/lib/utils";
import { Building2, Truck, CreditCard, Wallet } from "lucide-react";
import { SpendByProjectChart } from "@/components/charts/SpendByProjectChart";

export const dynamic = "force-dynamic";

const stageLabel: Record<string, string> = {
  rough_in: "Rough-in",
  panel: "Panel",
  finishing: "Finishing",
};
const statusVariant: Record<string, "success" | "primary" | "warning" | "default"> = {
  active: "success",
  planning: "primary",
  on_hold: "warning",
  completed: "default",
};

function Stat({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-start gap-4 pt-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <div className="text-sm text-muted-foreground">{label}</div>
          <div className="text-2xl font-bold tracking-tight">{value}</div>
          {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
        </div>
      </CardContent>
    </Card>
  );
}

export default async function DashboardPage() {
  const orgId = await getCurrentOrgId();
  const [summary, rollups] = await Promise.all([
    getPortfolioSummary(orgId),
    getProjectRollups(orgId),
  ]);

  const creditPct =
    summary.creditLimit > 0 ? (summary.creditUtilised / summary.creditLimit) * 100 : 0;

  return (
    <>
      <PageHeader
        title="Portfolio Dashboard"
        subtitle="Procurement across all active sites — committed spend, deliveries, and credit at a glance."
      />

      <div className="space-y-6 p-8">
        {/* KPI row */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            icon={Building2}
            label="Active Projects"
            value={String(summary.activeProjects)}
            hint={`${rollups.length} total sites`}
          />
          <Stat
            icon={Wallet}
            label="Committed Spend"
            value={formatINRCompact(summary.totalCommitted)}
            hint={`of ${formatINRCompact(summary.totalBudget)} budgeted`}
          />
          <Stat
            icon={Truck}
            label="Open Deliveries"
            value={String(summary.openDeliveries)}
            hint="awaiting dispatch / GRN"
          />
          <Stat
            icon={CreditCard}
            label="Credit Utilised"
            value={formatINRCompact(summary.creditUtilised)}
            hint={`of ${formatINRCompact(summary.creditLimit)} limit`}
          />
        </div>

        {/* Credit panel */}
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold">NBFC Credit Line</div>
                <div className="text-xs text-muted-foreground">
                  {summary.nbfcPartner ?? "No partner linked"} · Score{" "}
                  {summary.creditScore ?? "—"}/100
                </div>
              </div>
              <Badge variant={creditPct > 80 ? "warning" : "accent"}>
                {creditPct.toFixed(0)}% utilised
              </Badge>
            </div>
            <Progress value={creditPct} className="mt-3" />
            <div className="mt-2 flex justify-between text-xs text-muted-foreground">
              <span>{formatINR(summary.creditUtilised)} used</span>
              <span>{formatINR(summary.creditLimit - summary.creditUtilised)} available</span>
            </div>
          </CardContent>
        </Card>

        {/* Committed vs budget chart */}
        <Card>
          <CardContent className="pt-5">
            <div className="mb-2 text-sm font-semibold">Committed spend vs budget, by site</div>
            <SpendByProjectChart
              data={rollups.map((r) => ({
                name: r.name,
                committed: r.committed,
                budget: r.budget,
              }))}
            />
          </CardContent>
        </Card>

        {/* Projects table */}
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Sites
          </h2>
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-5 py-3 font-medium">Project</th>
                    <th className="px-5 py-3 font-medium">Stage</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 text-right font-medium">Budget</th>
                    <th className="px-5 py-3 text-right font-medium">Committed</th>
                    <th className="px-5 py-3 font-medium">Budget Used</th>
                    <th className="px-5 py-3 text-right font-medium">Open Del.</th>
                  </tr>
                </thead>
                <tbody>
                  {rollups.map((p) => (
                    <tr key={p.id} className="border-b last:border-0 hover:bg-muted/40">
                      <td className="px-5 py-3">
                        <Link href={`/projects/${p.id}`} className="font-medium hover:text-primary">
                          {p.name}
                        </Link>
                        <div className="text-xs text-muted-foreground">{p.location}</div>
                      </td>
                      <td className="px-5 py-3">{p.stage ? stageLabel[p.stage] : "—"}</td>
                      <td className="px-5 py-3">
                        <Badge variant={statusVariant[p.status] ?? "default"}>{p.status}</Badge>
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums">
                        {formatINRCompact(p.budget)}
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums">
                        {formatINRCompact(p.committed)}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <Progress value={p.variancePct} className="w-20" />
                          <span className="text-xs tabular-nums text-muted-foreground">
                            {p.variancePct.toFixed(0)}%
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums">{p.openDeliveries}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
