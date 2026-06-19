import { LeadForm } from "@/components/marketing/LeadForm";
import { Mail, MapPin } from "lucide-react";

export const metadata = { title: "Contact — Elume" };

export default function ContactPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <div className="text-sm font-semibold uppercase tracking-wide text-primary">Contact</div>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">Talk to us</h1>
      <p className="mt-3 text-muted-foreground">
        Tell us about your projects and procurement volumes — we&apos;ll show you exactly how Elume
        can help and get you set up.
      </p>

      <div className="mt-8 rounded-2xl border bg-card p-6">
        <LeadForm source="contact" cta="Send message" />
      </div>

      <div className="mt-8 flex flex-wrap gap-6 text-sm text-muted-foreground">
        <span className="flex items-center gap-2">
          <MapPin className="h-4 w-4" /> Noida, Uttar Pradesh, India
        </span>
        <span className="flex items-center gap-2">
          <Mail className="h-4 w-4" /> Elume Nuvotech Private Limited
        </span>
      </div>
    </main>
  );
}
