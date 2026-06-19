"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { leadSchema, type LeadInput } from "@/lib/validation/lead";
import { submitLead } from "@/lib/actions/lead";

export function LeadForm({
  source = "contact",
  sandboxOrgId,
  cta = "Send",
  onSuccess,
}: {
  source?: string;
  sandboxOrgId?: string;
  cta?: string;
  onSuccess?: () => void;
}) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<LeadInput>({
    resolver: zodResolver(leadSchema),
    defaultValues: { source, sandboxOrgId },
  });

  async function onSubmit(values: LeadInput) {
    const res = await submitLead({ ...values, source, sandboxOrgId });
    if (res.ok) {
      toast.success("Thanks! We'll be in touch shortly.");
      reset({ source, sandboxOrgId });
      onSuccess?.();
    } else {
      toast.error(res.error);
    }
  }

  const field =
    "w-full rounded-md border bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring";

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <input className={field} placeholder="Your name" {...register("name")} />
          {errors.name && <p className="mt-1 text-xs text-destructive">{errors.name.message}</p>}
        </div>
        <div>
          <input className={field} placeholder="Work email" {...register("email")} />
          {errors.email && <p className="mt-1 text-xs text-destructive">{errors.email.message}</p>}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <input className={field} placeholder="Company (optional)" {...register("company")} />
        <input className={field} placeholder="Phone (optional)" {...register("phone")} />
      </div>
      <textarea
        className={field}
        rows={3}
        placeholder="Tell us about your procurement needs (optional)"
        {...register("message")}
      />
      <button
        type="submit"
        disabled={isSubmitting}
        className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-70"
      >
        {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
        {cta}
      </button>
    </form>
  );
}
