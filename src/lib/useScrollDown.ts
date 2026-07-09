"use client";

import { useEffect, useState } from "react";

/** True while the user is scrolling DOWN past `threshold`; false as soon as
 *  they scroll up. Drives the mobile header collapse + sticky buy bar. */
export function useScrollDown(threshold = 90): boolean {
  const [down, setDown] = useState(false);
  useEffect(() => {
    let last = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      if (Math.abs(y - last) < 6) return; // ignore jitter
      setDown(y > last && y > threshold);
      last = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold]);
  return down;
}
