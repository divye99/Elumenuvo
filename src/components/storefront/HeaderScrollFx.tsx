"use client";

import { useEffect, useRef } from "react";
import { useScrollDown } from "@/lib/useScrollDown";

/** Mobile header collapse: while scrolling down, adds `hdr-scrolled` to the
 *  enclosing <header> so CSS leaves only the search row pinned. Scrolling up
 *  restores the full header. Desktop is unaffected (rules live in a media query). */
export default function HeaderScrollFx() {
  const anchor = useRef<HTMLSpanElement>(null);
  const down = useScrollDown(120);
  useEffect(() => {
    anchor.current?.closest("header")?.classList.toggle("hdr-scrolled", down);
  }, [down]);
  return <span ref={anchor} hidden />;
}
