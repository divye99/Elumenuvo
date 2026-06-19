"use client";

import { useState, useTransition } from "react";
import { RotateCcw, Bookmark, FlaskConical, X, Loader2 } from "lucide-react";
import { resetSandbox } from "@/lib/actions/sandbox";
import { LeadForm } from "@/components/marketing/LeadForm";

export function SandboxBanner({
  orgId,
  expiresAt,
}: {
  orgId: string;
  expiresAt: string | null;
}) {
  const [resetting, startReset] = useTransition();
  const [showSave, setShowSave] = useState(false);

  const expiryLabel = expiresAt
    ? `expires ${new Date(expiresAt).toLocaleString("en-IN", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })}`
    : "temporary workspace";

  return (
    <div className="border-b bg-primary/5">
      <div className="flex flex-wrap items-center justify-between gap-2 px-6 py-2">
        <div className="flex items-center gap-2 text-sm">
          <FlaskConical className="h-4 w-4 text-primary" />
          <span className="font-medium">You&apos;re exploring a live demo workspace.</span>
          <span className="text-muted-foreground">Edits are saved here · {expiryLabel}.</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowSave((s) => !s)}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
          >
            <Bookmark className="h-3.5 w-3.5" /> Save my workspace
          </button>
          <button
            onClick={() => startReset(() => resetSandbox())}
            disabled={resetting}
            className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-60"
          >
            {resetting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RotateCcw className="h-3.5 w-3.5" />
            )}
            Reset
          </button>
        </div>
      </div>

      {showSave && (
        <div className="border-t bg-card px-6 py-4">
          <div className="mb-3 flex items-start justify-between">
            <div>
              <div className="text-sm font-semibold">Save your workspace &amp; get full access</div>
              <div className="text-xs text-muted-foreground">
                Leave your details and we&apos;ll set up your real Elume account.
              </div>
            </div>
            <button onClick={() => setShowSave(false)} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
          <LeadForm
            source="save_workspace"
            sandboxOrgId={orgId}
            cta="Save my workspace"
            onSuccess={() => setShowSave(false)}
          />
        </div>
      )}
    </div>
  );
}
