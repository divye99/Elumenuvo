/**
 * Lead capture — marketing contact + "save my workspace" trial conversion.
 * Validated with zod; the single place leads are written.
 */
import { db } from "@/lib/db";
import { leads } from "@/lib/db/schema";
import { leadSchema, type LeadInput } from "@/lib/validation/lead";

export async function captureLead(input: LeadInput) {
  const data = leadSchema.parse(input);
  const [row] = await db
    .insert(leads)
    .values({
      name: data.name,
      email: data.email,
      company: data.company || null,
      phone: data.phone || null,
      message: data.message || null,
      source: data.source || "contact",
      sandboxOrgId: data.sandboxOrgId,
    })
    .returning({ id: leads.id });
  // TODO(Phase 5): notify founders by email (Resend) on new lead.
  return row;
}
