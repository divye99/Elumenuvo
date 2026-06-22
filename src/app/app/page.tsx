import { Suspense } from "react";
import AppShell from "@/components/app/AppShell";

// The buyer app (portfolio, catalogue, product, project, Smart BOM, cart, tracking).
// Ported from the prototype; AppShell reads ?screen= so it needs a Suspense boundary.
export default function Page() {
  return (
    <Suspense fallback={null}>
      <AppShell />
    </Suspense>
  );
}
