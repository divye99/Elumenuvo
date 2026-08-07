import { requireAdmin } from "@/lib/admin/auth";
import { listCompareGroups } from "@/lib/admin/compare-actions";
import CompareConsole from "@/app/admin/compare/CompareConsole";

export const dynamic = "force-dynamic";

/** Admin → Compare: the like-to-like mapping console. */
export default async function AdminCompare() {
  await requireAdmin();
  const { groups, rejected, coverage } = await listCompareGroups();
  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 6px" }}>Compare mappings</h1>
      <p style={{ fontSize: 13.5, color: "#56627A", margin: "0 0 18px", maxWidth: 760 }}>
        Products in a group share every key specification (never colour) and appear in each other&apos;s
        &quot;Compare with other items&quot; table. Groups rebuild automatically every night - new brands map
        in on import. Evicting a product is permanent and survives rebuilds. Rows marked
        &quot;extracted&quot; got their specs from text parsing rather than structured data - worth a
        spot-check, especially in Switchgear and Modular.
      </p>
      <CompareConsole groups={groups} rejected={rejected} coverage={coverage} />
    </div>
  );
}
