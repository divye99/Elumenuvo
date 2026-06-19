import { Sidebar } from "@/components/Sidebar";
import { SandboxBanner } from "@/components/SandboxBanner";
import { getCurrentOrg } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const org = await getCurrentOrg();
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar orgName={org.name} />
      <div className="flex flex-1 flex-col overflow-hidden">
        {org.isSandbox && (
          <SandboxBanner
            orgId={org.id}
            expiresAt={org.expiresAt ? org.expiresAt.toISOString() : null}
          />
        )}
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
