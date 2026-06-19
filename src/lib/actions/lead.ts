"use server";

import { captureLead } from "@/lib/services/leadCapture";
import { leadSchema, type LeadInput } from "@/lib/validation/lead";
import { resolveCurrentOrg } from "@/lib/auth/session";

export type LeadResult =
  | { ok: true }
  | { ok: false; error: string };

/** Server action used by the marketing contact form + in-app "save workspace". */
export async function submitLead(input: LeadInput): Promise<LeadResult> {
  const parsed = leadSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  try {
    // If submitted from inside a trial, attach the sandbox org for follow-up.
    let sandboxOrgId = parsed.data.sandboxOrgId;
    if (!sandboxOrgId) {
      const org = await resolveCurrentOrg();
      if (org?.isSandbox) sandboxOrgId = org.id;
    }
    await captureLead({ ...parsed.data, sandboxOrgId });
    return { ok: true };
  } catch {
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}
