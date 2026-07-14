"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Mark, Wordmark } from "@/components/Brand";
import { createClient } from "@/lib/supabase/client";

/** Read a query param on first render (client-only; safe during SSR). */
function param(key: string): string {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get(key) ?? "";
}

export default function SignIn() {
  const router = useRouter();
  const [tab, setTab] = useState<"email" | "phone">("email");
  // ?mode=signup (e.g. the post-order "create an account" nudge) opens on the
  // create-account tab with the buyer's email already filled in.
  const [mode, setMode] = useState<"in" | "up">(() => (param("mode") === "signup" ? "up" : "in"));
  const [email, setEmail] = useState(() => param("email"));
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "err" | "ok"; text: string } | null>(null);

  // Where to go after a successful sign-in (honours ?next=, defaults to /app).
  const dest = () => (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("next")) || "/app";

  // Normalise an Indian mobile to E.164.
  const e164 = (p: string) => {
    const d = p.replace(/\D/g, "");
    return d.startsWith("91") && d.length === 12 ? `+${d}` : d.length === 10 ? `+91${d}` : `+${d}`;
  };

  async function emailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    const supabase = createClient();
    try {
      if (mode === "in") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push(dest()); router.refresh();
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { phone } } });
        if (error) throw error;
        if (data.session) {
          // Save phone to the profile right away (profile row auto-created by trigger).
          if (phone) await supabase.from("profiles").update({ phone: e164(phone) }).eq("id", data.user!.id);
          router.push("/onboarding"); router.refresh();
        } else {
          setMsg({ kind: "ok", text: "Account created — check your email to confirm, then sign in." });
          setMode("in");
        }
      }
    } catch (err) {
      setMsg({ kind: "err", text: err instanceof Error ? err.message : "Something went wrong." });
    } finally { setBusy(false); }
  }

  async function sendOtp(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    try {
      const { error } = await createClient().auth.signInWithOtp({ phone: e164(phone) });
      if (error) throw error;
      setOtpSent(true);
      setMsg({ kind: "ok", text: `Code sent to ${e164(phone)}.` });
    } catch (err) {
      setMsg({ kind: "err", text: err instanceof Error ? err.message : "Couldn't send the code. Phone login may not be enabled yet." });
    } finally { setBusy(false); }
  }

  async function verifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    try {
      const { error } = await createClient().auth.verifyOtp({ phone: e164(phone), token: otp, type: "sms" });
      if (error) throw error;
      router.push(dest()); router.refresh();
    } catch (err) {
      setMsg({ kind: "err", text: err instanceof Error ? err.message : "Incorrect or expired code." });
    } finally { setBusy(false); }
  }

  const field = "w-full rounded-lg border border-[#E0E4ED] px-3 py-2.5 text-sm outline-none focus:border-[#4E5BDC]";
  const tabBtn = (on: boolean): React.CSSProperties => ({ flex: 1, padding: "9px", fontSize: 13, fontWeight: 600, borderRadius: 9, cursor: "pointer", border: "none", background: on ? "#161D2B" : "#F3F5F9", color: on ? "#fff" : "#56627A" });

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F7F8FB", fontFamily: "var(--hanken)" }}>
      <div style={{ width: 380, background: "#fff", border: "1px solid #E8EBF1", borderRadius: 16, padding: 30 }}>
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 20 }}>
          <Mark height={26} /><Wordmark height={15} />
        </Link>

        <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
          <button onClick={() => { setTab("email"); setMsg(null); }} style={tabBtn(tab === "email")}>Email</button>
          <button onClick={() => { setTab("phone"); setMsg(null); setOtpSent(false); }} style={tabBtn(tab === "phone")}>Phone</button>
        </div>

        {tab === "email" ? (
          <>
            <h1 style={{ fontSize: 19, fontWeight: 700, margin: "0 0 4px" }}>{mode === "in" ? "Sign in" : "Create your account"}</h1>
            <p style={{ fontSize: 12.5, color: "#8A93A6", margin: "0 0 16px" }}>Buy electrical goods with GST invoicing, orders & more.</p>
            <form onSubmit={emailSubmit} className="space-y-3">
              <input className={field} type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
              {mode === "up" && <input className={field} type="tel" placeholder="Phone number" value={phone} onChange={(e) => setPhone(e.target.value)} required autoComplete="tel" />}
              <input className={field} type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} autoComplete={mode === "in" ? "current-password" : "new-password"} />
              {msg && <p style={{ fontSize: 12.5, color: msg.kind === "err" ? "#E0612A" : "#137a4b" }}>{msg.text}</p>}
              <button disabled={busy} style={btn(busy)}>{busy ? "…" : mode === "in" ? "Sign in" : "Create account"}</button>
            </form>
            <div style={{ marginTop: 14, fontSize: 13, color: "#56627A", textAlign: "center" }}>
              {mode === "in"
                ? <>New here? <button onClick={() => { setMode("up"); setMsg(null); }} style={linkBtn}>Create an account</button></>
                : <>Have an account? <button onClick={() => { setMode("in"); setMsg(null); }} style={linkBtn}>Sign in</button></>}
            </div>
          </>
        ) : (
          <>
            <h1 style={{ fontSize: 19, fontWeight: 700, margin: "0 0 4px" }}>Sign in with phone</h1>
            <p style={{ fontSize: 12.5, color: "#8A93A6", margin: "0 0 16px" }}>We&apos;ll text you a one-time code.</p>
            {!otpSent ? (
              <form onSubmit={sendOtp} className="space-y-3">
                <input className={field} type="tel" placeholder="Phone number" value={phone} onChange={(e) => setPhone(e.target.value)} required autoComplete="tel" />
                {msg && <p style={{ fontSize: 12.5, color: msg.kind === "err" ? "#E0612A" : "#137a4b" }}>{msg.text}</p>}
                <button disabled={busy} style={btn(busy)}>{busy ? "…" : "Send code"}</button>
              </form>
            ) : (
              <form onSubmit={verifyOtp} className="space-y-3">
                <input className={field} inputMode="numeric" placeholder="6-digit code" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))} required />
                {msg && <p style={{ fontSize: 12.5, color: msg.kind === "err" ? "#E0612A" : "#137a4b" }}>{msg.text}</p>}
                <button disabled={busy} style={btn(busy)}>{busy ? "…" : "Verify & sign in"}</button>
                <button type="button" onClick={() => { setOtpSent(false); setOtp(""); setMsg(null); }} style={{ ...linkBtn, display: "block", margin: "6px auto 0" }}>Use a different number</button>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}

const btn = (busy: boolean): React.CSSProperties => ({ width: "100%", background: "#4E5BDC", color: "#fff", fontWeight: 600, fontSize: 14, border: "none", padding: 11, borderRadius: 10, cursor: busy ? "default" : "pointer", opacity: busy ? 0.7 : 1 });
const linkBtn: React.CSSProperties = { color: "#4E5BDC", fontWeight: 600, background: "none", border: "none", cursor: "pointer" };
