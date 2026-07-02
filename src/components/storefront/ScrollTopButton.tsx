"use client";

import { useEffect, useState } from "react";

/** Floating bottom-right "back to top" button — appears after scrolling a
 *  couple of screens, smooth-scrolls home. */
export default function ScrollTopButton() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 480);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="Back to top"
      style={{
        position: "fixed",
        right: 22,
        bottom: 22,
        zIndex: 60,
        width: 46,
        height: 46,
        borderRadius: "50%",
        border: "1px solid rgba(255,255,255,0.25)",
        background: "rgba(25,32,46,0.88)",
        backdropFilter: "blur(10px)",
        color: "#fff",
        fontSize: 17,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "0 10px 28px rgba(20,24,45,.28)",
        transition: "opacity .25s, transform .25s",
        opacity: show ? 1 : 0,
        transform: show ? "translateY(0)" : "translateY(14px)",
        pointerEvents: show ? "auto" : "none",
      }}
    >
      ↑
    </button>
  );
}
