"use client";

import { useTransition } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { startTrial } from "@/lib/actions/sandbox";
import { cn } from "@/lib/utils";

export function TryDemoButton({
  children = "Try the live demo",
  className,
  variant = "primary",
}: {
  children?: React.ReactNode;
  className?: string;
  variant?: "primary" | "light";
}) {
  const [pending, start] = useTransition();
  return (
    <button
      disabled={pending}
      onClick={() => start(() => startTrial())}
      className={cn(
        "group inline-flex items-center justify-center gap-2 rounded-lg px-6 py-3 text-base font-semibold shadow-sm transition-all disabled:opacity-70",
        variant === "primary"
          ? "bg-primary text-primary-foreground hover:bg-primary/90"
          : "bg-white text-primary hover:bg-white/90",
        className
      )}
    >
      {pending ? (
        <>
          <Loader2 className="h-5 w-5 animate-spin" />
          Setting up your workspace…
        </>
      ) : (
        <>
          {children}
          <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-0.5" />
        </>
      )}
    </button>
  );
}
