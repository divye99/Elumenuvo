const STEPS = ["received", "sourcing", "quoted", "ordered", "shipped"] as const;

const STYLES: Record<string, string> = {
  received: "bg-slate-100 text-slate-700",
  sourcing: "bg-blue-100 text-blue-700",
  quoted: "bg-amber-100 text-amber-700",
  ordered: "bg-indigo-100 text-indigo-700",
  shipped: "bg-emerald-100 text-emerald-700",
};

export function StatusBadge({ status }: { status: string }) {
  const cls = STYLES[status] ?? "bg-slate-100 text-slate-700";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium capitalize ${cls}`}
    >
      {status}
    </span>
  );
}

/** A compact step rail showing where a request is in the pipeline. */
export function StatusRail({ status }: { status: string }) {
  const idx = STEPS.indexOf(status as (typeof STEPS)[number]);
  return (
    <div className="mt-3 flex items-center gap-1.5" aria-hidden="true">
      {STEPS.map((s, i) => (
        <div
          key={s}
          className={`h-1.5 flex-1 rounded-full ${
            i <= idx ? "bg-accent" : "bg-slate-200"
          }`}
          title={s}
        />
      ))}
    </div>
  );
}
