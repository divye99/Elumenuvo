"use client";

import { useState } from "react";
import { Mail, Check } from "lucide-react";
import { createClient } from "@/lib/space/supabase/client";

export default function SignIn() {
  const [status, setStatus] = useState<"idle" | "loading" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = e.currentTarget;
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    const email = String(new FormData(form).get("email")).trim();

    setStatus("loading");
    try {
      const supabase = createClient();
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/space/auth/callback?next=/space/portal`,
        },
      });
      if (otpError) throw otpError;
      setStatus("sent");
    } catch (err) {
      console.error("Magic-link request failed:", err);
      setStatus("idle");
      setError(
        "Couldn't send the link — please try again, or email info@elumenuvo.com.",
      );
    }
  }

  if (status === "sent") {
    return (
      <div className="rounded-2xl border border-accent/30 bg-accent/10 px-6 py-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-accent/20">
          <Check className="h-6 w-6 text-accent" />
        </div>
        <p className="text-lg font-semibold text-white">Check your email</p>
        <p className="mt-2 text-sm text-white/60">
          We sent you a secure sign-in link. It expires shortly — open it on
          this device.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
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
      <button
        type="submit"
        disabled={status === "loading"}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-6 py-3.5 text-base font-semibold text-white transition-colors hover:bg-accent-hover focus-ring disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Mail className="h-4 w-4" />
        {status === "loading" ? "Sending…" : "Email me a sign-in link"}
      </button>
      {error && (
        <p role="alert" className="text-center text-sm text-red-300">
          {error}
        </p>
      )}
      <p className="text-center text-xs text-white/40">
        No password needed. We&apos;ll email you a secure link.
      </p>
    </form>
  );
}
