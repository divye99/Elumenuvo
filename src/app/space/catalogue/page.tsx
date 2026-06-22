import type { Metadata } from "next";
import Image from "next/image";
import {
  Box,
  Cpu,
  BatteryCharging,
  RadioTower,
  Flame,
  Cable,
  Radar,
  SatelliteDish,
  Thermometer,
  ImageIcon,
  type LucideIcon,
} from "lucide-react";
import Nav from "@/components/space/Nav";
import Footer from "@/components/space/Footer";
import { CATALOGUE, INDIA_FRICTION } from "@/lib/space/catalogue";

export const metadata: Metadata = {
  title: "What we source",
  description:
    "The components, materials, and equipment Elumenuvo sources for India's space companies — across structures, avionics, power, RF, propulsion, connectors, sensors, ground segment, and thermal.",
};

const ICONS: Record<string, LucideIcon> = {
  Box,
  Cpu,
  BatteryCharging,
  RadioTower,
  Flame,
  Cable,
  Radar,
  SatelliteDish,
  Thermometer,
};

export default function CataloguePage() {
  return (
    <>
      <Nav />
      <main className="bg-white">
        {/* Hero */}
        <section className="relative overflow-hidden bg-navy-deep text-white">
          <div className="grid-texture absolute inset-0" aria-hidden="true" />
          <div className="relative mx-auto max-w-6xl px-6 py-14 sm:py-20">
            <p className="text-sm font-semibold uppercase tracking-wider text-accent">
              What we source
            </p>
            <h1 className="mt-3 text-3xl font-bold leading-tight tracking-tight sm:text-5xl">
              A catalogue built for space programs.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/70 sm:text-lg">
              From flight-grade materials to propulsion valves to ground-support
              equipment — one partner across every category your build depends
              on. We source it, manage the vendors, and handle imports and
              customs.
            </p>
          </div>
        </section>

        {/* India friction band */}
        <section className="border-b border-slate-200 bg-slate-50">
          <div className="mx-auto max-w-6xl px-6 py-12 sm:py-16">
            <h2 className="text-xl font-bold tracking-tight text-navy sm:text-2xl">
              Why sourcing for space is hard in India.
            </h2>
            <div className="mt-8 grid gap-6 sm:grid-cols-3">
              {INDIA_FRICTION.map((f) => (
                <div
                  key={f.label}
                  className="rounded-2xl bg-white p-6 ring-1 ring-slate-200"
                >
                  <p className="text-3xl font-extrabold tracking-tight text-accent">
                    {f.stat}
                  </p>
                  <p className="mt-1 font-semibold text-navy">{f.label}</p>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">
                    {f.detail}
                  </p>
                </div>
              ))}
            </div>
            <p className="mt-6 max-w-3xl text-sm text-slate-500">
              Elumenuvo exists to absorb this friction — so a small team can
              procure like a large one.
            </p>
          </div>
        </section>

        {/* Catalogue categories */}
        <section className="mx-auto max-w-6xl px-6 py-14 sm:py-20">
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {CATALOGUE.map((cat) => {
              const Icon = ICONS[cat.icon] ?? Box;
              return (
                <article
                  key={cat.slug}
                  className="group flex flex-col overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200 transition-all hover:shadow-lg hover:shadow-slate-200/60 hover:ring-accent/40"
                >
                  {/* Image slot — swap in supplier/own photography (see SOURCING.md) */}
                  <div className="relative aspect-[16/10] w-full overflow-hidden bg-slate-100">
                    {cat.image ? (
                      <Image
                        src={cat.image}
                        alt={cat.imageAlt}
                        fill
                        className="object-cover"
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      />
                    ) : (
                      <div className="flex h-full flex-col items-center justify-center gap-2 border-b border-dashed border-slate-300 bg-slate-50 text-slate-400">
                        <ImageIcon className="h-6 w-6" />
                        <span className="px-4 text-center text-xs">
                          {cat.imageAlt}
                        </span>
                      </div>
                    )}
                    {cat.importHeavy && (
                      <span className="absolute left-3 top-3 rounded-full bg-navy/90 px-2.5 py-1 text-[11px] font-medium text-white">
                        Often import-dependent
                      </span>
                    )}
                  </div>

                  <div className="flex flex-1 flex-col p-6">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-navy text-white">
                        <Icon className="h-5 w-5" />
                      </div>
                      <h3 className="text-lg font-semibold text-navy">
                        {cat.title}
                      </h3>
                    </div>

                    <p className="mt-3 text-sm leading-relaxed text-slate-600">
                      {cat.blurb}
                    </p>

                    <ul className="mt-4 flex flex-wrap gap-2">
                      {cat.subtypes.map((s) => (
                        <li
                          key={s}
                          className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700"
                        >
                          {s}
                        </li>
                      ))}
                    </ul>

                    <div className="mt-auto pt-5">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                        Representative suppliers
                      </p>
                      <p className="mt-1 text-sm text-slate-600">
                        {cat.suppliers.join(" · ")}
                      </p>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          <p className="mt-8 max-w-3xl text-xs leading-relaxed text-slate-400">
            Suppliers listed are representative of each category and are not
            endorsements or exclusive relationships. Need something not listed?
            We source to spec.
          </p>
        </section>

        {/* CTA */}
        <section className="bg-navy-deep text-white">
          <div className="mx-auto max-w-3xl px-6 py-14 text-center sm:py-20">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Tell us what you need to source.
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-white/70">
              Join the waitlist and tell us what&apos;s slowing your build down
              most. We&apos;re launching in August 2026.
            </p>
            <a
              href="/space#waitlist"
              className="mt-7 inline-flex items-center justify-center rounded-xl bg-accent px-7 py-4 text-base font-semibold text-white shadow-lg shadow-accent/30 transition-colors hover:bg-accent-hover focus-ring"
            >
              Join the waitlist
            </a>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
