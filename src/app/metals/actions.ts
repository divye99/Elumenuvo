"use server";

import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";
import { sendMetalsEnquiryAlert } from "@/lib/email";
import { ENQUIRY_METALS } from "@/lib/metals";

// Same 15-character GSTIN shape the business signup enforces - the GSTIN is
// the genuine-buyer filter, so it is required here (unlike other lead forms).
const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Store one metals enquiry (business format). Inserts under the anon RLS
 *  policy - the trade-survey pattern; reads stay admin-only. */
export async function submitMetalEnquiry(input: {
  company: string;
  gstin: string;
  name: string;
  email: string;
  phone: string;
  metal: string;
  message: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  // Strip control characters up front - company/metal end up in an email
  // SUBJECT line, where a smuggled CR/LF would be a header injection.
  const clean = (s: string) => s.replace(/[\u0000-\u001F\u007F]+/g, " ").trim();
  const company = clean(input.company).slice(0, 160);
  const gstin = clean(input.gstin).toUpperCase();
  const name = clean(input.name).slice(0, 120);
  const email = clean(input.email).slice(0, 200);
  const phone = input.phone.replace(/\D/g, "").slice(0, 15);
  const metal = clean(input.metal);
  const message = input.message.replace(/[\u0000-\u0009\u000B-\u001F\u007F]+/g, " ").trim().slice(0, 4000);

  if (company.length < 2) return { ok: false, error: "Please enter your company name." };
  if (!GSTIN_RE.test(gstin)) return { ok: false, error: "Please enter a valid 15-character GSTIN." };
  if (name.length < 2) return { ok: false, error: "Please enter your name." };
  if (!EMAIL_RE.test(email)) return { ok: false, error: "Please enter a valid email address." };
  if (phone.length < 10) return { ok: false, error: "Please enter a valid 10-digit phone number." };
  if (!ENQUIRY_METALS.includes(metal)) return { ok: false, error: "Please pick the metal you're enquiring about." };
  if (message.length < 10) return { ok: false, error: "Please describe your requirement in a little more detail." };

  const row = { company, gstin, name, email, phone: `+91${phone.slice(-10)}`, metal, message };
  try {
    const db = await createClient();
    const { error } = await db.from("metal_enquiries").insert(row);
    if (error) return { ok: false, error: "Could not save just now. Please try again." };
    // Ping info@ so a GSTIN-verified lead never sits unseen; never blocks the
    // submit (send() is graceful and catches everything internally). The form
    // is public + unauthenticated, so cap the email trigger: during a burst
    // (>5 enquiries in 10 min - scripted abuse, real buyers never cluster
    // like that) rows keep landing in the table but the mails stop, so the
    // inbox can't be flooded through us. The count needs the SERVICE-ROLE
    // client (the table has no anon select policy - anon would always see 0
    // and never throttle); if that's unavailable the alert still goes out.
    let recent: number | null = null;
    const svc = adminClient();
    if (svc) {
      try {
        const { count, error: cErr } = await svc
          .from("metal_enquiries")
          .select("id", { count: "exact", head: true })
          .gte("created_at", new Date(Date.now() - 10 * 60_000).toISOString());
        recent = cErr ? null : count;
      } catch { recent = null; }
    }
    if (recent == null || recent <= 5) await sendMetalsEnquiryAlert(row);
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not save just now. Please try again." };
  }
}
