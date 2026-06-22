"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/space/supabase/client";

export default function QuoteForm({ requestId }: { requestId: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const data = new FormData(e.currentTarget);
    const payload = {
      request_id: requestId,
      price: String(data.get("price") || "").trim() || null,
      lead_time: String(data.get("lead_time") || "").trim() || null,
      notes: String(data.get("notes") || "").trim() || null,
    };

    setLoading(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");

      const { error: insertError } = await supabase
        .from("quotes")
        .insert({ ...payload, supplier_id: user.id });
      if (insertError) throw insertError;

      setOpen(false);
      router.refresh();
    } catch (err) {
      console.error("Quote submit failed:", err);
      setError("Couldn't submit quote — please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-3 rounded-lg border border-accent/40 px-3 py-1.5 text-sm font-medium text-accent transition-colors hover:bg-accent/5 focus-ring"
      >
        Submit a quote
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-3 rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <input
          name="price"
          placeholder="Price (e.g. ₹45,000)"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-navy placeholder-slate-400 focus:border-accent focus-ring"
        />
        <input
          name="lead_time"
          placeholder="Lead time (e.g. 8 weeks)"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-navy placeholder-slate-400 focus:border-accent focus-ring"
        />
      </div>
      <textarea
        name="notes"
        rows={2}
        placeholder="Notes (MOQ, terms, substitutions…)"
        className="mt-3 w-full resize-y rounded-lg border border-slate-300 px-3 py-2 text-sm text-navy placeholder-slate-400 focus:border-accent focus-ring"
      />
      {error && <p role="alert" className="mt-2 text-sm text-red-600">{error}</p>}
      <div className="mt-3 flex gap-2">
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover focus-ring disabled:opacity-60"
        >
          {loading ? "Sending…" : "Send quote"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 focus-ring"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
