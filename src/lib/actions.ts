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

  if (!author) return { ok: false, message: "Please add your name." };
  if (!(rating >= 1 && rating <= 5)) return { ok: false, message: "Please pick a star rating." };
  if (!body) return { ok: false, message: "Please write a few words about the product." };

  const c = client();
  if (!c) return { ok: false, message: "Reviews aren't available right now." };
  const { error } = await c.from("reviews").insert({
    product_id: productId,
    author_name: author.slice(0, 80),
    rating,
    title: title ? title.slice(0, 120) : null,
    body: body.slice(0, 4000),
  });
  if (error) return { ok: false, message: "Couldn't save your review — please try again." };

  revalidatePath(`/catalogue/${productId}`);
  revalidatePath("/catalogue");
  return { ok: true, message: "Thanks — your review is live." };
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
