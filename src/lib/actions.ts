"use server";

/** Public write actions — review submission + credit-waitlist signup.
 *  Both insert via the anon key under explicit insert-only RLS policies. */
import { revalidatePath } from "next/cache";
import { createClient } from "@supabase/supabase-js";

function client() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

export type FormState = { ok: boolean; message: string } | null;

export async function submitReview(productId: string, _prev: FormState, form: FormData): Promise<FormState> {
  const author = String(form.get("author") ?? "").trim();
  const rating = Number(form.get("rating") ?? 0);
  const title = String(form.get("title") ?? "").trim();
  const body = String(form.get("body") ?? "").trim();
  const orderId = String(form.get("order_id") ?? "").trim().toUpperCase();
  const email = String(form.get("email") ?? "").trim();

  if (!orderId) return { ok: false, message: "Please enter your Elume order ID." };
  if (!/^\S+@\S+\.\S+$/.test(email)) return { ok: false, message: "Please enter the email used on your order." };
  if (!author) return { ok: false, message: "Please add your name." };
  if (!(rating >= 1 && rating <= 5)) return { ok: false, message: "Please tap a bolt rating." };
  if (!body) return { ok: false, message: "Please write a few words about the product." };

  const c = client();
  if (!c) return { ok: false, message: "Reviews aren't available right now." };
  // Purchase verification happens IN the database: the RLS insert policy
  // checks order id + email + this product against the orders ledger.
  const { error } = await c.from("reviews").insert({
    product_id: productId,
    author_name: author.slice(0, 80),
    rating,
    title: title ? title.slice(0, 120) : null,
    body: body.slice(0, 4000),
    order_id: orderId.slice(0, 40),
    reviewer_email: email.slice(0, 200),
  });
  if (error) {
    if (error.code === "42501")
      return { ok: false, message: "We couldn't verify a purchase of this product against that order ID and email." };
    return { ok: false, message: "Couldn't save your review — please try again." };
  }

  revalidatePath(`/catalogue/${productId}`);
  revalidatePath("/catalogue");
  return { ok: true, message: "Thanks — your verified review is live." };
}

export async function joinWaitlist(_prev: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get("email") ?? "").trim();
  const name = String(form.get("name") ?? "").trim();
  const company = String(form.get("company") ?? "").trim();

  if (!/^\S+@\S+\.\S+$/.test(email)) return { ok: false, message: "Please enter a valid email." };

  const c = client();
  if (!c) return { ok: false, message: "The waitlist isn't available right now." };
  const { error } = await c.from("waitlist").insert({
    email: email.slice(0, 200),
    name: name ? name.slice(0, 120) : null,
    company: company ? company.slice(0, 160) : null,
    feature: "nbfc-credit",
  });
  if (error) return { ok: false, message: "Couldn't join the waitlist — please try again." };
  return { ok: true, message: "You're on the list — we'll email you when credit goes live." };
}

/** Shared insert for the public lead forms (Sell on Elume / product requests).
 *  Core fields go to columns; everything else lands in `details` jsonb. */
export async function submitPartnerLead(kind: "seller" | "product-request", _prev: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get("email") ?? "").trim();
  const name = String(form.get("name") ?? "").trim();
  const phone = String(form.get("phone") ?? "").trim();
  const company = String(form.get("company") ?? "").trim();
  const message = String(form.get("message") ?? "").trim();

  if (!/^\S+@\S+\.\S+$/.test(email)) return { ok: false, message: "Please enter a valid email address." };
  if (!name) return { ok: false, message: "Please add your name." };

  const details: Record<string, string> = {};
  for (const [k, v] of form.entries()) {
    if (["email", "name", "phone", "company", "message"].includes(k) || k.startsWith("$")) continue;
    const val = String(v).trim();
    if (val) details[k] = val.slice(0, 500);
  }

  const c = client();
  if (!c) return { ok: false, message: "This form isn't available right now — email us at info@elumenuvo.com." };
  const { error } = await c.from("partner_leads").insert({
    kind,
    name: name.slice(0, 120),
    email: email.slice(0, 200),
    phone: phone ? phone.slice(0, 30) : null,
    company: company ? company.slice(0, 160) : null,
    message: message ? message.slice(0, 4000) : null,
    details,
  });
  if (error) return { ok: false, message: "Couldn't submit right now — please try again, or email info@elumenuvo.com." };
  return kind === "seller"
    ? { ok: true, message: "Thanks — our partnerships team will reach out within 2 working days." }
    : { ok: true, message: "Got it — we'll try to source this product and email you a price." };
}
