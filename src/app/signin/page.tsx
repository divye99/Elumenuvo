"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Mark, Wordmark } from "@/components/Brand";
import { createClient } from "@/lib/supabase/client";

export default function SignIn() {
  const router = useRouter();
  const [tab, setTab] = useState<"email" | "phone">("email");
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "err" | "ok"; text: string } | null>(null);
  const [showResend, setShowResend] = useState(false);

  // Apply ?mode=signup&email=… after mount (reading window during render would
  // desync the server-rendered HTML from the client). Drives the "Create
  // account" button and the post-order signup nudge.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get("mode") === "signup") setMode("up");
    const e = q.get("email");
    if (e) setEmail(e);
    // Landing here from the confirmation email: verification already
    // happened at Supabase before the redirect, so just say so.
    if (q.get("confirmed") === "1") {
      setMode("in");
      setMsg({ kind: "ok", text: "Email confirmed. Sign in below to get started." });
    }
  }, []);

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
    let navigating = false; // stay busy through the redirect on success
    const supabase = createClient();
    try {
      if (mode === "in") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          if (/not confirmed/i.test(error.message)) {
            setShowResend(true);
            setMsg({ kind: "err", text: "Your email isn't confirmed yet — tap the link in the email we sent you, then sign in. No email? Resend it below." });
            setBusy(false);
            return;
          }
          throw error;
        }
        // Keep the button in its busy state through the redirect: the /app
        // render takes a moment, and a re-enabled button reads as "broken".
        setMsg({ kind: "ok", text: "Signed in. Opening your workspace…" });
        navigating = true;
        router.push(dest()); router.refresh();
        return;
      } else {
        const first = firstName.trim(), last = lastName.trim();
        if (!first || !last) { setMsg({ kind: "err", text: "Please enter your first and last name." }); setBusy(false); return; }
        const { data, error } = await supabase.auth.signUp({
          email, password,
          options: {
            data: { phone, first_name: first, last_name: last, full_name: `${first} ${last}` },
            // Confirmation links must land back on OUR sign-in page, not the
            // Supabase/Vercel default (also set Site URL in Supabase Auth).
            emailRedirectTo: `${window.location.origin}/signin?confirmed=1`,
          },
        });
        if (error) {
          if (/already registered|already exists/i.test(error.message)) {
            setMode("in");
            setMsg({ kind: "err", text: "You already have an account with this email — sign in below. Forgot the password? Use a different email or contact info@elumenuvo.com." });
            setBusy(false);
            return;
          }
          throw error;
        }
        if (data.session) {
          // Profile row is auto-created by a trigger; fill in what we collected.
          await supabase.from("profiles").update({
            first_name: first, last_name: last, full_name: `${first} ${last}`,
            ...(phone ? { phone: e164(phone) } : {}),
          }).eq("id", data.user!.id);
          navigating = true;
          router.push("/onboarding"); router.refresh();
        } else {
          // Schedule the 35-minute "still unconfirmed" nudge (fire-and-forget).
          if (data.user?.id) {
            fetch("/api/auth/confirm-reminder", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ userId: data.user.id, email }),
            }).catch(() => {});
          }
          setMsg({ kind: "ok", text: "Account created — check your email to confirm, then sign in." });
          setMode("in");
        }
      }
    } catch (err) {
      setMsg({ kind: "err", text: err instanceof Error ? err.message : "Something went wrong." });
    } finally { if (!navigating) setBusy(false); }
  }

  async function resendConfirmation() {
    setBusy(true); setMsg(null);
    try {
      const { error } = await createClient().auth.resend({
        type: "signup", email,
        options: { emailRedirectTo: `${window.location.origin}/signin?confirmed=1` },
      });
      if (error) throw error;
      setShowResend(false);
      setMsg({ kind: "ok", text: `Confirmation email re-sent to ${email}. Tap the link inside, then sign in.` });
    } catch (err) {
      setMsg({ kind: "err", text: err instanceof Error ? err.message : "Couldn't resend right now — try again in a minute." });
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
    let navigating = false;
    try {
      const { error } = await createClient().auth.verifyOtp({ phone: e164(phone), token: otp, type: "sms" });
      if (error) throw error;
      setMsg({ kind: "ok", text: "Signed in. Opening your workspace…" });
      navigating = true;
      router.push(dest()); router.refresh();
    } catch (err) {
      setMsg({ kind: "err", text: err instanceof Error ? err.message : "Incorrect or expired code." });
    } finally { if (!navigating) setBusy(false); }
  }

  const field = "w-full rounded-lg border border-[#E0E4ED] px-3 py-2.5 text-sm outline-none focus:border-[#4E5BDC]";
  const tabBtn = (on: boolean): React.CSSProperties => ({ flex: 1, padding: "9px", fontSize: 13, fontWeight: 600, borderRadius: 9, cursor: "pointer", border: "none", background: on ? "#161D2B" : "#F3F5F9", color: on ? "#fff" : "#56627A" });

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F7F8FB", fontFamily: "var(--hanken)" }}>
      <div style={{ width: 380, background: "#fff", border: "1px solid #E8EBF1", borderRadius: 16, padding: 30 }}>
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 20 }}>
          <Mark height={26} /><Wordmark height={15} />
        </Link>

        {/* Phone OTP needs an SMS provider in Supabase; until that's configured
            the tab is a dead end (watched a real buyer bounce off it), so it's
            hidden behind NEXT_PUBLIC_PHONE_AUTH=1. */}
        {process.env.NEXT_PUBLIC_PHONE_AUTH === "1" && (
          <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
            <button onClick={() => { setTab("email"); setMsg(null); }} style={tabBtn(tab === "email")}>Email</button>
            <button onClick={() => { setTab("phone"); setMsg(null); setOtpSent(false); }} style={tabBtn(tab === "phone")}>Phone</button>
          </div>
        )}

        {tab === "email" ? (
          <>
            <h1 style={{ fontSize: 19, fontWeight: 700, margin: "0 0 4px" }}>{mode === "in" ? "Sign in" : "Create your account"}</h1>
            <p style={{ fontSize: 12.5, color: "#8A93A6", margin: "0 0 16px" }}>Buy electrical goods with GST invoicing, orders & more.</p>
            <form onSubmit={emailSubmit} className="space-y-3">
              {mode === "up" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <input className={field} placeholder="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} required autoComplete="given-name" />
                  <input className={field} placeholder="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} required autoComplete="family-name" />
                </div>
              )}
              <input className={field} type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
              {mode === "up" && <input className={field} type="tel" placeholder="Phone number" value={phone} onChange={(e) => setPhone(e.target.value)} required autoComplete="tel" />}
              <input className={field} type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} autoComplete={mode === "in" ? "current-password" : "new-password"} />
              {msg && <p style={{ fontSize: 12.5, color: msg.kind === "err" ? "#E0612A" : "#137a4b" }}>{msg.text}</p>}
              {showResend && (
                <button type="button" disabled={busy} onClick={resendConfirmation} style={{ width: "100%", background: "#fff", color: "#4E5BDC", fontWeight: 700, fontSize: 13, border: "1.5px solid #4E5BDC", padding: 10, borderRadius: 10, cursor: "pointer" }}>
                  Resend confirmation email
                </button>
              )}
              <button disabled={busy} style={btn(busy)}>{busy ? (mode === "in" ? "Signing you in…" : "Creating your account…") : mode === "in" ? "Sign in" : "Create account"}</button>
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
