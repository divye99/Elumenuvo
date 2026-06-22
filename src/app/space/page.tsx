import { ArrowRight, Search, ListChecks, Truck } from "lucide-react";
import Nav from "@/components/space/Nav";
import Footer from "@/components/space/Footer";
import WaitlistForm from "@/components/space/WaitlistForm";

const cards = [
  {
    icon: Search,
    title: "Source it",
    body: "We find the right parts, materials, and equipment, including hard-to-get and low-volume items, so you're not chasing fragmented suppliers or unworkable minimum orders.",
  },
  {
    icon: ListChecks,
    title: "Manage it",
    body: "We handle your vendors end to end, quotes, negotiations, purchase orders, and follow-ups, and keep lead times on track so nothing stalls your build.",
  },
  {
    icon: Truck,
    title: "Move it",
    body: "We manage imports, customs, and logistics, clearing the paperwork and friction of cross-border procurement so your hardware arrives ready to use.",
  },
];

export default function Home() {
  return (
    <>
      <Nav />
      <main id="main">
        {/* Hero */}
        <section className="relative overflow-hidden bg-navy-deep text-white">
          <div className="grid-texture absolute inset-0" aria-hidden="true" />
          <div
            className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/60 to-transparent"
            aria-hidden="true"
          />
          <div className="relative mx-auto max-w-6xl px-6 pt-20 pb-14 sm:pt-32 sm:pb-32">
            <div className="max-w-3xl">
              <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-white/70 sm:mb-8">
                <span
                  className="h-1.5 w-1.5 rounded-full bg-accent"
                  aria-hidden="true"
                />
                Procurement for India&apos;s space-tech
              </p>
              <h1 className="text-[2rem] font-extrabold leading-[1.1] tracking-tight sm:text-5xl sm:leading-[1.05] lg:text-6xl">
                Space Procurement, so your team can build.
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/70 sm:mt-6 sm:text-xl">
                Elumenuvo is a procurement partner built for India&apos;s space
                companies. We source what you need, manage your vendors, and
                handle imports and customs, so your engineers stay on the
                hardware, not the purchase orders.
              </p>
              <div className="mt-7 sm:mt-10">
                <a
                  href="#waitlist"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-7 py-4 text-lg font-semibold text-white shadow-lg shadow-accent/30 transition-colors hover:bg-accent-hover focus-ring sm:w-auto sm:text-base"
                >
                  Join the waitlist
                  <ArrowRight className="h-5 w-5 sm:h-4 sm:w-4" />
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* Problem */}
        <section className="bg-white">
          <div className="mx-auto max-w-4xl px-6 py-14 sm:py-28">
            <h2 className="text-2xl font-bold leading-tight tracking-tight text-navy sm:text-4xl">
              Building in space is hard enough. Sourcing for it shouldn&apos;t
              be.
            </h2>
            <p className="mt-4 text-base leading-relaxed text-slate-600 sm:mt-6 sm:text-lg">
              Fragmented suppliers, long lead times, import and customs
              friction, and minimum orders that don&apos;t fit small builds,
              right now that work lands on the people who should be designing
              rockets and satellites.
            </p>
          </div>
        </section>

        {/* What we do */}
        <section className="border-y border-slate-200 bg-slate-50">
          <div className="mx-auto max-w-6xl px-6 py-14 sm:py-28">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold uppercase tracking-wider text-accent">
                What we do
              </p>
              <h2 className="mt-3 text-2xl font-bold tracking-tight text-navy sm:text-4xl">
                One partner across the whole procurement path.
              </h2>
            </div>
            <div className="mt-8 grid gap-5 sm:mt-12 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
              {cards.map(({ icon: Icon, title, body }) => (
                <article
                  key={title}
                  className="group relative rounded-2xl bg-white p-6 ring-1 ring-slate-200 transition-all hover:shadow-lg hover:shadow-slate-200/60 hover:ring-accent/40 sm:p-7"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-navy text-white">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-5 text-xl font-semibold text-navy">
                    {title}
                  </h3>
                  <p className="mt-3 leading-relaxed text-slate-600">{body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Waitlist */}
        <section id="waitlist" className="bg-navy-deep text-white">
          <div className="mx-auto max-w-2xl px-6 py-14 sm:py-28">
            <div className="text-center">
              <h2 className="text-2xl font-bold tracking-tight sm:text-4xl">
                Tell us what you need most.
              </h2>
            </div>
            <WaitlistForm />
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
