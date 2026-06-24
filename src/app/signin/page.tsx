"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Mark, Wordmark } from "@/components/Brand";
import { createClient } from "@/lib/supabase/client";

export default function SignIn() {
  const router = useRouter();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "err" | "ok"; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const supabase = createClient();
    try {
      if (mode === "in") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push("/app");
        router.refresh();
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        if (data.session) {
          router.push("/app");
          router.refresh();
        } else {
          setMsg({ kind: "ok", text: "Account created — check your email to confirm, then sign in." });
          setMode("in");
        }
      }
    } catch (err) {
      setMsg({ kind: "err", text: err instanceof Error ? err.message : "Something went wrong." });
    } finally {
      setBusy(false);
    }
  }

  const field = "w-full rounded-lg border border-[#E0E4ED] px-3 py-2.5 text-sm outline-none focus:border-[#4E5BDC]";

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#F7F8FB", fontFamily: "var(--hanken)" }}>
      <div style={{ width: 380, background: "#fff", border: "1px solid #E8EBF1", borderRadius: 16, padding: 30 }}>
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 22 }}>
          <Mark height={26} />
          <Wordmark height={15} />
        </Link>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 4px" }}>
          {mode === "in" ? "Sign in to your dashboard" : "Create your account"}
        </h1>
        <p style={{ fontSize: 13, color: "#8A93A6", margin: "0 0 18px" }}>
          The Elume buyer dashboard — portfolio, BOM, orders & credit.
        </p>

        <form onSubmit={submit} className="space-y-3">
          <input className={field} type="email" placeholder="Work email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          <input className={field} type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} autoComplete={mode === "in" ? "current-password" : "new-password"} />
          {msg && (
            <p style={{ fontSize: 12.5, color: msg.kind === "err" ? "#E0612A" : "#137a4b" }}>{msg.text}</p>
          )}
          <button disabled={busy} style={{ width: "100%", background: "#4E5BDC", color: "#fff", fontWeight: 600, fontSize: 14, border: "none", padding: 11, borderRadius: 10, cursor: "pointer", opacity: busy ? 0.7 : 1 }}>
            {busy ? "…" : mode === "in" ? "Sign in" : "Create account"}
          </button>
        </form>

        <div style={{ marginTop: 16, fontSize: 13, color: "#56627A", textAlign: "center" }}>
          {mode === "in" ? (
            <>New here? <button onClick={() => { setMode("up"); setMsg(null); }} style={{ color: "#4E5BDC", fontWeight: 600, background: "none", border: "none", cursor: "pointer" }}>Create an account</button></>
          ) : (
            <>Have an account? <button onClick={() => { setMode("in"); setMsg(null); }} style={{ color: "#4E5BDC", fontWeight: 600, background: "none", border: "none", cursor: "pointer" }}>Sign in</button></>
          )}
        </div>
      </div>
    </div>
  );
}
