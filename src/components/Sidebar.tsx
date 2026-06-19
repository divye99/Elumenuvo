"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Boxes, FolderKanban, Zap } from "lucide-react";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/projects", label: "Projects & BOM", icon: FolderKanban },
  { href: "/catalogue", label: "Catalogue", icon: Boxes },
];

export function Sidebar({ orgName }: { orgName: string }) {
  const pathname = usePathname();
  return (
    <aside className="flex w-60 flex-col border-r bg-card">
      <div className="flex items-center gap-2 border-b px-5 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Zap className="h-5 w-5" />
        </div>
        <div>
          <div className="text-base font-bold leading-none tracking-tight">ELUME</div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
            FMEG Procurement
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {nav.map((item) => {
          const active = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t p-4">
        <div className="text-xs text-muted-foreground">Signed in as</div>
        <div className="truncate text-sm font-semibold">{orgName}</div>
        <div className="mt-1 text-[11px] text-muted-foreground">Procurement Manager</div>
      </div>
    </aside>
  );
}
