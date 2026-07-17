"use client";

import { useActionState } from "react";
import { joinWaitlist, type FormState } from "@/lib/actions";
import { identify } from "@/lib/analytics";

/** NBFC-credit waitlist signup form (client island for /credit). */
export default function WaitlistForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(async (prev, fd) => {
    const res = await joinWaitlist(prev, fd);
    if (res?.ok) identify(String(fd.get("email") || ""), String(fd.get("name") || ""));
    return res;
  }, null);

  if (state?.ok) {
    return (
      <div style={{ background: "#E6F5EE", border: "1px solid #BEE7D2", borderRadius: 14, padding: "22px 24px", textAlign: "center" }}>
        <div style={{ fontSize: 22, marginBottom: 6 }}>🎉</div>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#166A44" }}>{state.message}</div>
      </div>
    );
  }

  return (
    <form action={action} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <input name="name" placeholder="Your name" style={inp} />
      <input name="company" placeholder="Company / firm (optional)" style={inp} />
      <input name="email" type="email" required placeholder="Work email" style={inp} />
      <button
        type="submit"
        disabled={pending}
        style={{ background: "#4E5BDC", color: "#fff", fontSize: 14.5, fontWeight: 700, border: "none", borderRadius: 11, padding: "13px 22px", cursor: pending ? "wait" : "pointer", opacity: pending ? 0.7 : 1 }}
      >
        {pending ? "Joining…" : "Join the credit waitlist"}
      </button>
      {state && !state.ok && (
        <span style={{ fontSize: 13, fontWeight: 600, color: "#D14343" }}>{state.message}</span>
      )}
      <span style={{ fontSize: 11.5, color: "#8A93A6" }}>
        We&apos;ll only email you about the credit launch. No spam.
      </span>
    </form>
  );
}

const inp: React.CSSProperties = {
  border: "1px solid #E0E4ED",
  borderRadius: 11,
  padding: "12px 14px",
  fontSize: 14,
  color: "#19202E",
  outline: "none",
  background: "#FBFCFE",
};
