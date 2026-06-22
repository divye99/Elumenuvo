import type { Metadata } from "next";
import { Mail } from "lucide-react";
import Nav from "@/components/space/Nav";
import Footer from "@/components/space/Footer";

export const metadata: Metadata = {
  title: "About",
  description:
    "Elumenuvo is a procurement partner for India's space companies. Get in touch.",
};

export default function AboutPage() {
  return (
    <>
      <Nav />
      <main className="bg-white">
        <section className="bg-navy-deep text-white">
          <div className="mx-auto max-w-4xl px-6 py-14 sm:py-20">
            <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">
              Procurement, handled, so your team can build.
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-white/70 sm:text-lg">
              Elumenuvo is a procurement partner built for India&apos;s space
              companies. We take the sourcing, vendor management, and
              import/customs work off your engineers&apos; plates so they can
              stay on the hardware.
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-4xl px-6 py-16">
          <div className="grid gap-10 sm:grid-cols-2">
            <div>
              <h2 className="text-xl font-semibold text-navy">Why we exist</h2>
              <p className="mt-3 leading-relaxed text-slate-600">
                India&apos;s space sector is moving fast, but the supply chain
                behind it is fragmented, import-heavy, and unforgiving of small
                builds. Elumenuvo exists to absorb that friction — so a small
                team can procure like a large one.
              </p>
            </div>
            <div>
              <h2 className="text-xl font-semibold text-navy">Get in touch</h2>
              <p className="mt-3 leading-relaxed text-slate-600">
                We&apos;re launching in August 2026 and working with early
                partners now.
              </p>
              <a
                href="mailto:info@elumenuvo.com"
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-hover focus-ring"
              >
                <Mail className="h-4 w-4" />
                info@elumenuvo.com
              </a>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
