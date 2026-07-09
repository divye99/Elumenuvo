"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export type AccountUser = {
  name: string | null;
  email: string;
  business: boolean;
  company: string | null;
};

/** Initials for the avatar — company for business accounts, else the person. */
function initials(u: AccountUser): string {
  const src = (u.business && u.company) || u.name || u.email;
  const words = src.replace(/@.*/, "").split(/[\s._-]+/).filter(Boolean);
  return ((words[0]?.[0] ?? "") + (words[1]?.[0] ?? "")).toUpperCase() || "E";
}

/**
 * Header account button. Signed out: avatar + “Sign in” with a welcome dropdown
 * (sign in / create account). Signed in: animated gradient-ring avatar (person
 * initials, or company initials for business accounts) — click opens the
 * dashboard, hover shows the account menu.
 */
export default function AccountButton({ user }: { user: AccountUser | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Close on outside click (touch devices where hover doesn't apply).
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (open && wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const enter = () => { if (closeTimer.current) clearTimeout(closeTimer.current); setOpen(true); };
  const leave = () => { closeTimer.current = setTimeout(() => setOpen(false), 180); };

  const firstName = user ? ((user.business && user.company) || user.name || user.email).split(/[\s@]/)[0] : null;

  return (
    <div ref={wrap} onMouseEnter={enter} onMouseLeave={leave} style={{ position: "relative", flexShrink: 0 }}>
      {user ? (
        // Signed in — click goes straight to the dashboard.
        <button
          onClick={() => router.push("/app")}
          aria-label="Open your dashboard"
          style={{ display: "flex", alignItems: "center", gap: 9, background: "#161D2B", border: "none", borderRadius: 24, padding: "5px 14px 5px 5px", cursor: "pointer" }}
        >
          <Avatar text={initials(user)} business={user.business} size={30} />
          <span style={{ fontSize: 13.5, fontWeight: 600, color: "#fff", maxWidth: 110, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{firstName}</span>
        </button>
      ) : (
        // Signed out — click opens the welcome dropdown.
        <button
          onClick={() => setOpen(!open)}
          aria-label="Sign in"
          style={{ display: "flex", alignItems: "center", gap: 9, background: "#4E5BDC", border: "none", borderRadius: 24, padding: "5px 16px 5px 5px", cursor: "pointer" }}
        >
          <Avatar text="👤" business={false} size={30} glyph />
          <span style={{ fontSize: 13.5, fontWeight: 600, color: "#fff" }}>Sign in</span>
        </button>
      )}

      {open && (
        <div
          style={{
            position: "absolute", right: 0, top: "calc(100% + 10px)", width: 264, zIndex: 60,
            background: "#fff", border: "1px solid #E8EBF1", borderRadius: 16,
            boxShadow: "0 18px 44px rgba(20,24,45,.16)", overflow: "hidden",
            animation: "elumeDropIn .16s ease",
          }}
        >
          {/* caret */}
          <div style={{ position: "absolute", top: -5, right: 26, width: 10, height: 10, background: "#fff", borderLeft: "1px solid #E8EBF1", borderTop: "1px solid #E8EBF1", transform: "rotate(45deg)" }} />

          {user ? (
            <>
              <div style={{ display: "flex", gap: 11, alignItems: "center", padding: "15px 16px", background: "#F7F8FB", borderBottom: "1px solid #EEF0F4" }}>
                <Avatar text={initials(user)} business={user.business} size={38} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: "#19202E", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {(user.business && user.company) || user.name || user.email.split("@")[0]}
                  </div>
                  <div style={{ fontSize: 11.5, color: "#8A93A6", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.email}</div>
                  <span style={{ display: "inline-block", marginTop: 3, fontSize: 9.5, fontWeight: 700, letterSpacing: "0.4px", textTransform: "uppercase", color: user.business ? "#1F7D50" : "#4E5BDC", background: user.business ? "#E6F5EE" : "#EEF0FE", padding: "2px 8px", borderRadius: 8 }}>
                    {user.business ? "Business" : "Individual"}
                  </span>
                </div>
              </div>
              <div style={{ padding: 10 }}>
                <Link href="/app" style={{ display: "block", textAlign: "center", background: "#4E5BDC", color: "#fff", fontWeight: 700, fontSize: 13.5, padding: "10px 12px", borderRadius: 10 }}>
                  Open dashboard →
                </Link>
                <MenuLink href="/orders" label="My orders" icon="📦" />
                <MenuLink href="/track" label="Track an order" icon="🚚" />
                {user.business && <MenuLink href="/app" label="Bulk & GST pricing" icon="🧾" />}
                <form action="/auth/signout" method="post" style={{ borderTop: "1px solid #F0F2F6", marginTop: 8, paddingTop: 8 }}>
                  <button type="submit" style={{ width: "100%", textAlign: "left", background: "none", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#C0392B", padding: "8px 10px", borderRadius: 8 }}>
                    Sign out
                  </button>
                </form>
              </div>
            </>
          ) : (
            <>
              <div style={{ padding: "16px 16px 12px", background: "linear-gradient(135deg, #EEF0FE, #F7F8FB)", borderBottom: "1px solid #EEF0F4" }}>
                <div style={{ fontSize: 14.5, fontWeight: 700, color: "#19202E" }}>Welcome to Elume</div>
                <div style={{ fontSize: 12, color: "#56627A", marginTop: 2 }}>Orders, GST invoices, wholesale rates & your business workspace.</div>
              </div>
              <div style={{ padding: 12 }}>
                <Link href="/signin" style={{ display: "block", textAlign: "center", background: "#4E5BDC", color: "#fff", fontWeight: 700, fontSize: 13.5, padding: "10px 12px", borderRadius: 10 }}>
                  Sign in
                </Link>
                <Link href="/signin" style={{ display: "block", textAlign: "center", background: "#fff", color: "#4E5BDC", fontWeight: 700, fontSize: 13.5, padding: "9px 12px", borderRadius: 10, border: "1.5px solid #D9DDFB", marginTop: 8 }}>
                  Create account
                </Link>
                <div style={{ borderTop: "1px solid #F0F2F6", marginTop: 10, paddingTop: 4 }}>
                  <MenuLink href="/track" label="Track an order" icon="🚚" />
                  <MenuLink href="/business" label="Elume for business" icon="🏢" />
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/** Avatar with a slow-rotating conic-gradient ring (the “animated” bit). */
function Avatar({ text, business, size, glyph }: { text: string; business: boolean; size: number; glyph?: boolean }) {
  const ring = business
    ? "conic-gradient(#1F9D63, #7CE3B1, #1F9D63, #0E6B41, #1F9D63)"
    : "conic-gradient(#4E5BDC, #9DB0FF, #E0612A, #4E5BDC)";
  return (
    <span style={{ position: "relative", width: size, height: size, flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", borderRadius: "50%" }}>
      {/* rotating ring */}
      <span aria-hidden style={{ position: "absolute", inset: 0, borderRadius: "50%", background: ring, animation: "elumeRing 3.5s linear infinite" }} />
      {/* face */}
      <span style={{ position: "relative", width: size - 5, height: size - 5, borderRadius: "50%", background: business ? "#0E3B26" : "#232B6E", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: glyph ? size * 0.5 : size * 0.38, fontWeight: 800, letterSpacing: "0.5px" }}>
        {text}
      </span>
    </span>
  );
}

function MenuLink({ href, label, icon }: { href: string; label: string; icon: string }) {
  return (
    <Link href={href} style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 13, fontWeight: 600, color: "#3A4358", padding: "9px 10px", borderRadius: 8, marginTop: 2 }}>
      <span style={{ fontSize: 14 }}>{icon}</span> {label}
    </Link>
  );
}
