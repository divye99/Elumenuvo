export const metadata = { title: "About — Elume" };

export default function AboutPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <div className="text-sm font-semibold uppercase tracking-wide text-primary">About</div>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">
        Building India&apos;s procurement backbone for FMEG
      </h1>
      <div className="mt-6 space-y-4 text-muted-foreground">
        <p>
          India&apos;s ₹2.66 lakh crore market for Fast-Moving Electrical Goods and wires &amp;
          cables runs on a multi-tier distribution chain that has barely changed in decades. Each
          intermediary adds a margin; by the time product reaches a contractor or developer,
          25–35% has been stacked on top — opaque and impossible to benchmark.
        </p>
        <p>
          Elume aggregates FMEG procurement into a single platform: a multi-brand catalogue with
          transparent pricing, NBFC-partnered credit inside the order flow, and project-level
          tools that replace spreadsheets and WhatsApp groups.
        </p>
        <p>
          We&apos;re built by founders who pair marketplace operations experience from Amazon and
          financial infrastructure expertise from Goldman Sachs with four decades of hands-on
          exposure to FMEG manufacturing through a family wires &amp; cables business.
        </p>
      </div>

      <div className="mt-10 grid gap-6 sm:grid-cols-2">
        <div className="rounded-2xl border bg-card p-6">
          <div className="text-lg font-bold">Divye Jain</div>
          <div className="text-sm text-primary">Co-Founder &amp; CEO</div>
          <p className="mt-2 text-sm text-muted-foreground">
            King&apos;s College London &amp; LSE. Former Brand Specialist at Amazon. Marketplace
            operations and FMEG domain depth.
          </p>
        </div>
        <div className="rounded-2xl border bg-card p-6">
          <div className="text-lg font-bold">Ansh Jain</div>
          <div className="text-sm text-primary">Co-Founder &amp; COO/CFO</div>
          <p className="mt-2 text-sm text-muted-foreground">
            UC Irvine. Former Derivatives Trader at Goldman Sachs. Credit underwriting,
            risk, and quantitative analysis.
          </p>
        </div>
      </div>
    </main>
  );
}
