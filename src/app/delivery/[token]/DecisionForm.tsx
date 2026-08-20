"use client";

import { useState, useTransition } from "react";

/** The three-way delivery decision. Kept dumb on purpose: one radio group,
 *  the address box appears only for the corrected-address path, one submit. */
export default function DecisionForm({ decide, decided, choice }: {
  decide: (fd: FormData) => Promise<{ ok: boolean; error?: string }>;
  decided: boolean;
  choice: string | null;
}) {
  const [sel, setSel] = useState<string>("redeliver");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();

  if (decided || done) {
    const LABEL: Record<string, string> = {
      redeliver: "redeliver to the same address",
      redeliver_new_address: "redeliver to your corrected address",
      cancel_order: "cancel the order",
    };
    return (
      <div style={{ background: "#E6F5EE", border: "1px solid #BFE6D2", borderRadius: 14, padding: "18px 20px" }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: "#137a4b", marginBottom: 6 }}>Thank you - decision recorded ✓</div>
        <p style={{ fontSize: 13.5, color: "#2A5C43", margin: 0, lineHeight: 1.6 }}>
          We will {LABEL[choice ?? sel] ?? "proceed as you chose"} and keep you posted on email.
          Changed your mind? WhatsApp or email info@elumenuvo.com and we will adjust it.
        </p>
      </div>
    );
  }

  const OPTIONS: [string, string, string][] = [
    ["redeliver", "Redeliver to the same address", "The courier will attempt delivery again at the address above."],
    ["redeliver_new_address", "Redeliver to a corrected address", "Give us the right address and we will book the parcel to it."],
    ["cancel_order", "Cancel this order", "We will contact you about the refund right away."],
  ];

  return (
    <form
      action={(fd) => start(async () => {
        setError(null);
        const res = await decide(fd);
        if (res.ok) setDone(true);
        else setError(res.error ?? "Something went wrong - please WhatsApp us.");
      })}
      style={{ display: "grid", gap: 10 }}
    >
      {OPTIONS.map(([value, title, sub]) => (
        <label key={value} style={{ display: "flex", gap: 12, alignItems: "flex-start", background: "#fff", border: `2px solid ${sel === value ? "#4E5BDC" : "#E8EBF1"}`, borderRadius: 14, padding: "14px 16px", cursor: "pointer" }}>
          <input type="radio" name="choice" value={value} checked={sel === value} onChange={() => setSel(value)} style={{ marginTop: 3 }} />
          <span>
            <span style={{ display: "block", fontSize: 14.5, fontWeight: 700 }}>{title}</span>
            <span style={{ display: "block", fontSize: 12.5, color: "#8A93A6", marginTop: 2 }}>{sub}</span>
          </span>
        </label>
      ))}
      {sel === "redeliver_new_address" && (
        <textarea
          name="new_address"
          placeholder={"Full corrected address with landmark and PIN code\ne.g. Ruhi Enterprises, Shop 4, Main Market Road, Near SBI ATM, Hapur, UP 245101"}
          style={{ width: "100%", minHeight: 96, fontSize: 13.5, border: "1px solid #E8EBF1", borderRadius: 12, padding: 12, resize: "vertical", lineHeight: 1.6 }}
        />
      )}
      <input name="note" placeholder="Anything the courier should know? (optional)" style={{ fontSize: 13.5, border: "1px solid #E8EBF1", borderRadius: 12, padding: "11px 12px" }} />
      {error && <div style={{ fontSize: 13, color: "#C0392B", fontWeight: 600 }}>{error}</div>}
      <button
        type="submit"
        disabled={pending}
        style={{ background: pending ? "#C9CFDD" : "#4E5BDC", color: "#fff", fontSize: 14.5, fontWeight: 700, padding: "13px 22px", borderRadius: 12, border: "none", cursor: pending ? "wait" : "pointer", justifySelf: "start" }}
      >
        {pending ? "Saving…" : "Confirm my choice"}
      </button>
    </form>
  );
}
