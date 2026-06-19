import { Sidebar } from "@/components/Sidebar";
import { getCurrentOrg } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const org = await getCurrentOrg();
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar orgName={org.name} />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
