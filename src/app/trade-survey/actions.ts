"use server";

import { createClient } from "@/lib/supabase/server";

/** Store one trade-survey response. Inserts under the anon RLS policy - the
 *  same pattern as partner leads; reads stay admin-only. */
export async function submitTradeSurvey(input: {
  company: string; phone: string; buys: string; channel: string; priority: string; missing: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const company = input.company.trim().slice(0, 160);
  const phone = input.phone.replace(/\D/g, "").slice(0, 15);
  if (company.length < 2) return { ok: false, error: "Please enter your company name." };
  if (phone.length < 10) return { ok: false, error: "Please enter a valid 10-digit phone number." };
  try {
    const db = await createClient();
    const { error } = await db.from("trade_survey").insert({
      company,
      phone: `+91${phone.slice(-10)}`,
      buys: input.buys.slice(0, 200) || null,
      channel: input.channel.slice(0, 200) || null,
      priority: input.priority.slice(0, 200) || null,
      missing: input.missing.trim().slice(0, 4000) || null,
    });
    if (error) return { ok: false, error: "Could not save just now. Please try again." };
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not save just now. Please try again." };
  }
}
