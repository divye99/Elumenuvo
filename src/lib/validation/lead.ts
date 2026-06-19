/** Pure zod schema for leads — safe to import on the client (no server deps). */
import { z } from "zod";

export const leadSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  email: z.string().trim().email("Enter a valid email"),
  company: z.string().trim().max(160).optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  message: z.string().trim().max(2000).optional().or(z.literal("")),
  // No .default() here — a zod default makes the input/output types diverge,
  // which breaks the react-hook-form resolver typing. Default is applied in the
  // service instead.
  source: z.string().optional(),
  sandboxOrgId: z.string().uuid().optional(),
});

export type LeadInput = z.infer<typeof leadSchema>;
