import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, Badge } from "@/components/ui";
import { getCurrentOrgId } from "@/lib/auth/session";
import { listProjects } from "@/lib/queries/projects";
import { formatINRCompact } from "@/lib/utils";
import { MapPin, ArrowRight } from "lucide-react";

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

export default async function ProjectsPage() {
  const orgId = await getCurrentOrgId();
  const projects = await listProjects(orgId);

  return (
    <>
      <PageHeader
        title="Projects & BOM"
        subtitle="Each project carries its own Bill of Materials, phased procurement, and orders."
      />
      <div className="grid grid-cols-1 gap-4 p-8 md:grid-cols-2 xl:grid-cols-3">
        {projects.map((p) => (
          <Link key={p.id} href={`/projects/${p.id}`}>
            <Card className="h-full transition-shadow hover:shadow-md">
              <CardContent className="pt-5">
                <div className="flex items-start justify-between">
                  <Badge variant={statusVariant[p.status] ?? "default"}>{p.status}</Badge>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </div>
                <h3 className="mt-3 font-semibold leading-tight">{p.name}</h3>
                <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3" /> {p.location}
                </div>
                <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">{p.scope}</p>
                <div className="mt-4 flex items-center justify-between border-t pt-3 text-sm">
                  <span className="text-muted-foreground">
                    Stage: {p.stage ? stageLabel[p.stage] : "—"}
                  </span>
                  <span className="font-semibold tabular-nums">
                    {formatINRCompact(Number(p.budgetAmount ?? 0))}
                  </span>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </>
  );
}
