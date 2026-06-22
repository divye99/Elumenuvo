"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { createClient } from "@/lib/space/supabase/client";

export default function WaitlistForm() {
  const [status, setStatus] = useState<"idle" | "loading" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = e.currentTarget;
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const data = new FormData(form);
    const payload = {
      email: String(data.get("email")).trim(),
      company: String(data.get("company")).trim(),
      need: String(data.get("need") || "").trim() || null,
    };

    setStatus("loading");
    try {
      const supabase = createClient();
      const { error: insertError } = await supabase
        .from("waitlist")
        .insert(payload);

      // 23505 = unique_violation → already signed up, treat as success.
      if (insertError && insertError.code !== "23505") {
        throw insertError;
      }
      setStatus("done");
    } catch (err) {
      console.error("Waitlist submit failed:", err);
      setStatus("idle");
      setError(
        "Something went wrong — please try again, or email info@elumenuvo.com.",
      );
    }
  }

  if (status === "done") {
    return (
      <div
        role="status"
        aria-live="polite"
        className="mt-8 rounded-xl border border-accent/30 bg-accent/10 px-6 py-8 text-center sm:mt-10"
      >
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-accent/20">
          <Check className="h-6 w-6 text-accent" />
        </div>
        <p className="text-lg font-semibold text-white">
          You&apos;re on the list — we&apos;ll be in touch.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="mt-8 space-y-5 sm:mt-10 sm:space-y-6"
    >
      <div>
        <label
          htmlFor="email"
          className="mb-2 block text-sm font-medium text-white/80"
        >
          Work email
        </label>
        <input
          type="email"
          id="email"
          name="email"
          required
          autoComplete="email"
          placeholder="you@company.com"
          className="w-full rounded-lg border border-white/15 bg-white/5 px-4 py-3 text-white placeholder-white/40 transition-colors focus:border-accent focus-ring"
        />
      </div>

      <div>
        <label
          htmlFor="company"
          className="mb-2 block text-sm font-medium text-white/80"
        >
          Company name
        </label>
        <input
          type="text"
          id="company"
          name="company"
          required
          autoComplete="organization"
          placeholder="Your company"
          className="w-full rounded-lg border border-white/15 bg-white/5 px-4 py-3 text-white placeholder-white/40 transition-colors focus:border-accent focus-ring"
        />
      </div>

      <div>
        <label
          htmlFor="need"
          className="mb-2 block text-sm font-medium text-white/80"
        >
          What do you most need help procuring right now?
        </label>
        <textarea
          id="need"
          name="need"
          rows={4}
          placeholder="Tell us a bit about what you're sourcing…"
          className="w-full resize-y rounded-lg border border-white/15 bg-white/5 px-4 py-3 text-white placeholder-white/40 transition-colors focus:border-accent focus-ring"
        />
      </div>

      <button
        type="submit"
        disabled={status === "loading"}
        className="inline-flex w-full items-center justify-center rounded-xl bg-accent px-6 py-4 text-lg font-semibold text-white shadow-lg shadow-accent/30 transition-colors hover:bg-accent-hover focus-ring disabled:cursor-not-allowed disabled:opacity-60 sm:text-base"
      >
        {status === "loading" ? "Joining…" : "Join the waitlist"}
      </button>

      {error && (
        <p role="alert" className="text-center text-sm leading-relaxed text-red-300">
          {error}
        </p>
      )}

      <p className="text-center text-sm leading-relaxed text-white/50">
        Takes a minute. We&apos;re launching Elumenuvo in August 2026, and you
        can opt out anytime.
      </p>
    </form>
  );
}
