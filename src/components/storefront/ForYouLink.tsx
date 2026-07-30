"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

/**
 * "For you" link - shown ONLY to signed-in customers. The storefront chrome
 * is cached identically for everyone (so the catalogue stays crawlable), so
 * who is signed in resolves here after hydration, exactly like AccountButton.
 * One shared fetch feeds every instance on the page (navbar + drawer).
 */
let sessionCheck: Promise<boolean> | null = null;
function isSignedIn(): Promise<boolean> {
  if (!sessionCheck) {
    sessionCheck = fetch("/api/me/account")
      .then((r) => r.json())
      .then((d) => !!d?.user)
      .catch(() => false);
  }
  return sessionCheck;
}

export default function ForYouLink({ variant, onNavigate }: { variant: "nav" | "drawer"; onNavigate?: () => void }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    let live = true;
    isSignedIn().then((v) => { if (live) setShow(v); });
    return () => { live = false; };
  }, []);
  if (!show) return null;

  if (variant === "nav") {
    return (
      <Link href="/for-you" className="hdr-navlink" style={{ fontSize: 14, fontWeight: 600, color: "#4E5BDC" }}>
        For you
      </Link>
    );
  }
  return (
    <Link href="/for-you" onClick={onNavigate} className="drw-link">
      <span className="ico">✨</span> For you · your personal picks
    </Link>
  );
}
