"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/space/supabase/client";

export default function NewRequestForm({
  defaultCompany,
}: {
  defaultCompany?: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
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
      item: String(data.get("item")).trim(),
      quantity: String(data.get("quantity") || "").trim() || null,
      target_date: String(data.get("target_date") || "") || null,
      notes: String(data.get("notes") || "").trim() || null,
      company: String(data.get("company") || "").trim() || null,
    };

    setLoading(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");

      const { error: insertError } = await supabase
        .from("procurement_requests")
        .insert({ ...payload, user_id: user.id });
      if (insertError) throw insertError;

      form.reset();
      setOpen(false);
      router.refresh();
    } catch (err) {
      console.error("Request submit failed:", err);
      setError("Couldn't submit — please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-hover focus-ring"
      >
        <Plus className="h-4 w-4" />
        New procurement request
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="rounded-2xl bg-white p-6 ring-1 ring-slate-200"
    >
      <h3 className="text-lg font-semibold text-navy">New procurement request</h3>
      <div className="mt-4 space-y-4">
        <div>
          <label htmlFor="item" className="mb-1.5 block text-sm font-medium text-slate-700">
            What do you need? <span className="text-red-500">*</span>
          </label>
          <input
            id="item"
            name="item"
            required
            placeholder="e.g. Nano-D connectors, 7075 plate, S-band transceiver"
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-navy placeholder-slate-400 focus:border-accent focus-ring"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="quantity" className="mb-1.5 block text-sm font-medium text-slate-700">
              Quantity
            </label>
            <input
              id="quantity"
              name="quantity"
              placeholder="e.g. 20 units"
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-navy placeholder-slate-400 focus:border-accent focus-ring"
            />
          </div>
          <div>
            <label htmlFor="target_date" className="mb-1.5 block text-sm font-medium text-slate-700">
              Needed by
            </label>
            <input
              type="date"
              id="target_date"
              name="target_date"
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-navy focus:border-accent focus-ring"
            />
          </div>
        </div>
        <div>
          <label htmlFor="company" className="mb-1.5 block text-sm font-medium text-slate-700">
            Company
          </label>
          <input
            id="company"
            name="company"
            defaultValue={defaultCompany ?? ""}
            placeholder="Your company"
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-navy placeholder-slate-400 focus:border-accent focus-ring"
          />
        </div>
        <div>
          <label htmlFor="notes" className="mb-1.5 block text-sm font-medium text-slate-700">
            Notes / specs
          </label>
          <textarea
            id="notes"
            name="notes"
            rows={3}
            placeholder="Specs, part numbers, tolerances, anything that helps us source it."
            className="w-full resize-y rounded-lg border border-slate-300 px-3 py-2.5 text-navy placeholder-slate-400 focus:border-accent focus-ring"
          />
        </div>
      </div>

      {error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}

      <div className="mt-5 flex gap-3">
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-hover focus-ring disabled:opacity-60"
        >
          {loading ? "Submitting…" : "Submit request"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-xl px-5 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 focus-ring"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
