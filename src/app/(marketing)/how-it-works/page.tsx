import { TryDemoButton } from "@/components/marketing/TryDemoButton";

export const metadata = { title: "How it works — Elume" };

const STEPS = [
  {
    n: "01",
    title: "Plan",
    body: "Create a project and build a Bill of Materials — manually, by uploading a BOQ, or with the AI Smart BOM. Compatibility checks (wire ↔ MCB rating) run before you order.",
  },
  {
    n: "02",
    title: "Source & Price",
    body: "See live, transparent pricing for every line item across Havells, Polycab, Crompton, Legrand, Schneider, ABB and more. Choose by brand, budget, or lead time.",
  },
  {
    n: "03",
    title: "Order & Finance",
    body: "Convert the BOM into a phased schedule tied to construction stages. Auto-generated POs release on schedule, with 30–60 day NBFC credit inside the order flow.",
  },
  {
    n: "04",
    title: "Receive & Manage",
    body: "Track deliveries and GRNs, manage invoices, and roll everything up across 5–10 concurrent sites in one portfolio dashboard.",
  },
];

export default function HowItWorksPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <div className="text-sm font-semibold uppercase tracking-wide text-primary">How it works</div>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">
        From plan to delivery, in one connected workflow
      </h1>
      <p className="mt-3 text-muted-foreground">
        Elume replaces the spreadsheets, WhatsApp groups, and parallel distributor relationships
        that procurement teams maintain today.
      </p>

      <div className="mt-10 space-y-6">
        {STEPS.map((s) => (
          <div key={s.n} className="flex gap-5 rounded-2xl border bg-card p-6">
            <div className="text-2xl font-extrabold text-primary/30">{s.n}</div>
            <div>
              <h2 className="text-lg font-bold">{s.title}</h2>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-10 text-center">
        <TryDemoButton>See it in action</TryDemoButton>
      </div>
    </main>
  );
}
