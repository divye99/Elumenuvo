import {
  Boxes,
  LineChart,
  CreditCard,
  FileSpreadsheet,
  Layers,
  ShieldCheck,
} from "lucide-react";
import { TryDemoButton } from "@/components/marketing/TryDemoButton";
import { SavingsCalculator } from "@/components/marketing/SavingsCalculator";
import { SupplyChainAnimation } from "@/components/marketing/SupplyChainAnimation";
import { LiveCataloguePreview } from "@/components/marketing/LiveCataloguePreview";

export const dynamic = "force-dynamic";

const BRANDS = ["Havells", "Polycab", "Finolex", "Crompton", "Legrand", "Schneider", "ABB", "Anchor", "Syska"];

const PILLARS = [
  {
    icon: Boxes,
    title: "Procure Smarter",
    body: "One multi-brand catalogue with transparent, side-by-side pricing and an AI Smart BOM that catches compatibility issues before you order.",
  },
  {
    icon: CreditCard,
    title: "Finance Better",
    body: "30–60 day credit from NBFC partners inside the order flow — no balance-sheet risk, underwritten on your real procurement data.",
  },
  {
    icon: LineChart,
    title: "Operate Efficiently",
    body: "A single dashboard across all your sites: committed spend, deliveries, credit utilisation, and budget variance per project.",
  },
];

const FEATURES = [
  { icon: Layers, label: "Multi-brand catalogue across 9+ FMEG brands" },
  { icon: ShieldCheck, label: "Transparent pricing with volume tiers" },
  { icon: FileSpreadsheet, label: "Smart BOM — upload a BOQ, get it priced" },
  { icon: CreditCard, label: "NBFC-partnered credit, inside the order" },
];

export default function LandingPage() {
  return (
    <main>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-primary/5 via-background to-background" />
        <div className="mx-auto max-w-6xl px-6 pb-16 pt-20 text-center">
          <div className="mx-auto mb-5 inline-flex items-center gap-2 rounded-full border bg-card px-3.5 py-1.5 text-xs font-medium text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-success" />
            India&apos;s first dedicated B2B FMEG procurement platform
          </div>
          <h1 className="mx-auto max-w-3xl text-balance text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
            India&apos;s procurement backbone for{" "}
            <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              electrical goods
            </span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-balance text-lg text-muted-foreground">
            Wires, switchgear, lighting and fans from every major brand — one platform,
            transparent pricing, embedded credit, and project-level tools. Cut out the 4–5 layer
            distribution chain.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <TryDemoButton>Try the live demo</TryDemoButton>
            <span className="text-sm text-muted-foreground">No signup · instant workspace</span>
          </div>

          {/* Trust strip */}
          <div className="mx-auto mt-12 grid max-w-3xl grid-cols-3 gap-6 border-y py-6">
            <Stat value="₹2.66L Cr" label="FMEG + W&C market" />
            <Stat value="~10%" label="annual growth" />
            <Stat value="15–25%" label="savings vs traditional" />
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm font-medium text-muted-foreground">
            {BRANDS.map((b) => (
              <span key={b}>{b}</span>
            ))}
          </div>
        </div>
      </section>

      {/* Problem — supply chain */}
      <section className="mx-auto max-w-6xl px-6 py-16">
        <SectionHeading
          eyebrow="The problem"
          title="Every layer adds a margin"
          subtitle="FMEG moves through a 4–5 tier chain, each adding 5–12%. By the time it reaches the contractor, 25–35% is stacked on top — opaque, relationship-dependent, and impossible to benchmark."
        />
        <div className="mt-10">
          <SupplyChainAnimation />
        </div>
      </section>

      {/* Savings calculator */}
      <section className="border-y bg-muted/30">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-6 py-16 md:grid-cols-2">
          <div>
            <SectionHeading
              align="left"
              eyebrow="See the impact"
              title="Put a number on it"
              subtitle="Mid-size contractors buy ₹10–15L of electrical materials a month across projects. The middle-man layer quietly compounds across the year — here's what it could be worth to you."
            />
            <ul className="mt-6 space-y-3">
              {FEATURES.map((f) => (
                <li key={f.label} className="flex items-center gap-3 text-sm">
                  <f.icon className="h-5 w-5 shrink-0 text-primary" />
                  {f.label}
                </li>
              ))}
            </ul>
          </div>
          <SavingsCalculator />
        </div>
      </section>

      {/* Solution pillars */}
      <section className="mx-auto max-w-6xl px-6 py-16">
        <SectionHeading
          eyebrow="The platform"
          title="Procure smarter, finance better, operate efficiently"
          subtitle="Everything a contractor or developer needs to run electrical procurement — in one connected workflow."
        />
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {PILLARS.map((p) => (
            <div key={p.title} className="rounded-2xl border bg-card p-6">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <p.icon className="h-6 w-6" />
              </div>
              <h3 className="mt-4 text-lg font-bold">{p.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{p.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Live catalogue preview */}
      <section className="border-y bg-muted/30">
        <div className="mx-auto max-w-4xl px-6 py-16">
          <SectionHeading
            eyebrow="Live from the catalogue"
            title="Same spec. Every brand. Side by side."
            subtitle="Real pricing from the platform — the best price flagged on every line."
          />
          <div className="mt-10">
            <LiveCataloguePreview />
          </div>
          <div className="mt-8 text-center">
            <TryDemoButton>Explore the full catalogue</TryDemoButton>
          </div>
        </div>
      </section>

      {/* Founders / credibility */}
      <section className="mx-auto max-w-6xl px-6 py-16">
        <SectionHeading
          eyebrow="Why us"
          title="Marketplace + finance + four decades of FMEG"
          subtitle="Built by founders who pair Amazon marketplace operations and Goldman Sachs financial infrastructure with a 40-year family wires & cables manufacturing business."
        />
        <div className="mx-auto mt-10 grid max-w-3xl gap-6 sm:grid-cols-3">
          <Credential title="Amazon" sub="Marketplace operations & brand" />
          <Credential title="Goldman Sachs" sub="Credit underwriting & risk" />
          <Credential title="40 years" sub="FMEG manufacturing in the family" />
        </div>
      </section>

      {/* Final CTA */}
      <section className="mx-auto max-w-6xl px-6 pb-20">
        <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-primary to-accent px-8 py-14 text-center text-primary-foreground">
          <h2 className="text-balance text-3xl font-extrabold tracking-tight">
            See your own procurement workspace in 10 seconds
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-balance text-primary-foreground/90">
            No signup, no sales call. Click once and you&apos;re inside a fully-loaded demo —
            build a BOM, compare brands, watch the dashboard react.
          </p>
          <div className="mt-7 flex justify-center">
            <TryDemoButton variant="light">Try the live demo</TryDemoButton>
          </div>
        </div>
      </section>
    </main>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="text-2xl font-extrabold tracking-tight">{value}</div>
      <div className="mt-0.5 text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function SectionHeading({
  eyebrow,
  title,
  subtitle,
  align = "center",
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  align?: "center" | "left";
}) {
  return (
    <div className={align === "center" ? "mx-auto max-w-2xl text-center" : "max-w-xl"}>
      <div className="text-sm font-semibold uppercase tracking-wide text-primary">{eyebrow}</div>
      <h2 className="mt-2 text-balance text-3xl font-bold tracking-tight">{title}</h2>
      {subtitle && <p className="mt-3 text-balance text-muted-foreground">{subtitle}</p>}
    </div>
  );
}

function Credential({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="rounded-2xl border bg-card p-6 text-center">
      <div className="text-xl font-bold tracking-tight">{title}</div>
      <div className="mt-1 text-sm text-muted-foreground">{sub}</div>
    </div>
  );
}
