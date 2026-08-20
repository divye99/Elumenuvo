"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { track } from "@/lib/analytics";

/**
 * Amazon-style product gallery:
 *  - main image + thumbnail strip (thumbnails only when there is more than one photo)
 *  - desktop hover magnifier: a lens on the image drives a zoomed pane alongside
 *  - click/Enter opens a full-screen lightbox on a dimmed backdrop: arrows,
 *    swipe or arrow keys between photos, wheel / double-click / pinch to zoom,
 *    drag or touch-pan when zoomed, Esc to close
 *
 * Accessibility: the trigger is focusable and key-operable, the lightbox is a
 * real dialog (role, aria-modal, focus moved in on open, restored on close,
 * Tab cycles inside), and every control is a real <button>.
 *
 * Every interaction is telemetry for the PDP drop-off analysis:
 *  pdp_image {act: open|thumb|arrow|zoom|hover, idx, pid} - `hover` fires once
 *  per pageview (it would flood otherwise); the rest are real interactions.
 */
export default function ProductGallery({
  images,
  pid,
  alt,
  skuLabel,
  offLabel,
}: {
  images: string[];
  pid: string;
  alt: string;
  skuLabel?: string;
  offLabel?: string;
}) {
  const [idx, setIdx] = useState(0);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const hoverFired = useRef(false);

  // Dead URLs (brand CDN takedowns) silently drop out of the gallery instead
  // of rendering broken-image icons; if every photo dies the component shows
  // a plain white slot and the card/tile treatment stays intact elsewhere.
  const [broken, setBroken] = useState<Set<string>>(new Set());
  const markBroken = (u: string) => setBroken((prev) => (prev.has(u) ? prev : new Set(prev).add(u)));
  const live = images.filter((u) => !broken.has(u));

  const emit = useCallback((act: string, i: number) => {
    track("pdp_image", { detail: { act, idx: i, pid } });
  }, [pid]);

  // ── hover magnifier (desktop, fine pointers only) ──
  const mainRef = useRef<HTMLDivElement>(null);
  const [lens, setLens] = useState<{ x: number; y: number } | null>(null);
  const ZOOM = 2.4;
  const onMove = (e: React.MouseEvent) => {
    if (!window.matchMedia("(pointer: fine)").matches || window.innerWidth < 1000) return;
    const r = mainRef.current?.getBoundingClientRect();
    if (!r) return;
    const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    const y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
    setLens({ x, y });
    if (!hoverFired.current) { hoverFired.current = true; emit("hover", idx); }
  };

  const openBox = () => { setOpen(true); emit("open", idx); };
  const cur = live[Math.min(idx, Math.max(0, live.length - 1))];

  return (
    <div>
      {/* Main image: focusable, Enter/Space opens the viewer */}
      <div
        ref={mainRef}
        onMouseMove={onMove}
        onMouseLeave={() => setLens(null)}
        onClick={openBox}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openBox(); } }}
        role="button"
        tabIndex={0}
        aria-label="Open photo viewer"
        style={{ height: 230, position: "relative", cursor: "zoom-in", background: "#fff" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {cur && <img src={cur} alt={alt} onError={() => markBroken(cur)} style={{ width: "100%", height: "100%", objectFit: "contain", padding: "6%", boxSizing: "border-box" }} />}
        {skuLabel && (
          <span style={{ position: "absolute", left: 14, bottom: 14, zIndex: 2, pointerEvents: "none", fontFamily: "var(--space-mono)", fontSize: 10.5, color: "#6b748c", background: "rgba(255,255,255,0.9)", padding: "4px 8px", borderRadius: 6 }}>{skuLabel}</span>
        )}
        {offLabel && (
          <span style={{ position: "absolute", right: 14, bottom: 14, zIndex: 2, pointerEvents: "none", fontSize: 12, fontWeight: 700, color: "#1F9D63", background: "#fff", padding: "5px 10px", borderRadius: 7 }}>{offLabel}</span>
        )}
        {lens && (
          <div style={{ position: "absolute", pointerEvents: "none", width: 96, height: 96, left: `calc(${lens.x * 100}% - 48px)`, top: `calc(${lens.y * 100}% - 48px)`, border: "1.5px solid #1D2F8A", background: "rgba(78,91,220,0.08)", borderRadius: 8 }} />
        )}
        {live.length > 1 && (
          <span style={{ position: "absolute", right: 12, top: 12, fontSize: 11, fontWeight: 700, color: "#56627A", background: "rgba(255,255,255,0.92)", border: "1px solid #E8EBF1", padding: "3px 9px", borderRadius: 8, pointerEvents: "none" }}>
            {Math.min(idx, live.length - 1) + 1} / {live.length}
          </span>
        )}
      </div>

      {/* Hover magnifier pane: floats over the buy box to the right */}
      {lens && (
        <div
          aria-hidden
          style={{
            position: "absolute", left: "calc(100% + 14px)", top: 0, zIndex: 30,
            width: 440, height: 380, background: "#fff", border: "1px solid #E0E4ED",
            borderRadius: 14, boxShadow: "0 18px 44px rgba(20,24,45,0.18)", overflow: "hidden",
            backgroundImage: `url("${cur}")`, backgroundRepeat: "no-repeat",
            backgroundSize: `${ZOOM * 100}% ${ZOOM * 100}%`,
            backgroundPosition: `${lens.x * 100}% ${lens.y * 100}%`,
            pointerEvents: "none",
          }}
        />
      )}

      {/* Thumbnails */}
      {live.length > 1 && (
        <div style={{ display: "flex", gap: 8, padding: "10px 12px 12px", overflowX: "auto", background: "#fff" }}>
          {live.map((u, i) => (
            <button
              key={u + i}
              type="button"
              aria-label={`Photo ${i + 1} of ${live.length}`}
              aria-current={i === idx}
              onClick={(e) => { e.stopPropagation(); setIdx(i); if (i !== idx) emit("thumb", i); }}
              style={{ width: 54, height: 54, flex: "0 0 auto", padding: 0, borderRadius: 9, cursor: "pointer", background: "#fff", border: i === idx ? "2px solid #1D2F8A" : "1px solid #E0E4ED", overflow: "hidden" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={u} alt="" onError={() => markBroken(u)} style={{ width: "100%", height: "100%", objectFit: "contain", padding: 4, boxSizing: "border-box" }} />
            </button>
          ))}
        </div>
      )}

      {mounted && open && live.length > 0 && createPortal(
        <Lightbox images={live} start={Math.min(idx, live.length - 1)} alt={alt} onClose={() => setOpen(false)} onNav={(i, how) => { setIdx(i); emit(how, i); }} onZoom={(i) => emit("zoom", i)} />,
        document.body
      )}
    </div>
  );
}

/* ── Full-screen viewer ── */
function Lightbox({ images, start, alt, onClose, onNav, onZoom }: {
  images: string[]; start: number; alt: string;
  onClose: () => void; onNav: (i: number, how: "arrow" | "thumb") => void; onZoom: (i: number) => void;
}) {
  const [i, setI] = useState(start);
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragging = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  const pinch = useRef<{ dist: number; scale: number } | null>(null);
  const touchPan = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const gestureWasPinch = useRef(false);
  const zoomEmitted = useRef(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const go = useCallback((next: number, how: "arrow" | "thumb") => {
    const n = (next + images.length) % images.length;
    setI(n); setScale(1); setPan({ x: 0, y: 0 }); zoomEmitted.current = false;
    onNav(n, how);
  }, [images.length, onNav]);

  const applyScale = useCallback((next: number) => {
    setScale(next);
    if (next === 1) setPan({ x: 0, y: 0 });
    else if (!zoomEmitted.current) { zoomEmitted.current = true; onZoom(i); }
  }, [i, onZoom]);

  const toggleZoom = () => applyScale(scale === 1 ? 2.4 : 1);

  // Dialog behaviour: keyboard, focus-in / focus-restore / focus-trap, scroll lock.
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight" && images.length > 1) go(i + 1, "arrow");
      else if (e.key === "ArrowLeft" && images.length > 1) go(i - 1, "arrow");
      else if (e.key === "Tab") {
        // Keep focus cycling inside the dialog.
        const focusables = rootRef.current?.querySelectorAll<HTMLElement>("button, [tabindex]");
        if (!focusables?.length) return;
        const list = [...focusables];
        const at = list.indexOf(document.activeElement as HTMLElement);
        const next = e.shiftKey ? (at <= 0 ? list.length - 1 : at - 1) : (at === list.length - 1 ? 0 : at + 1);
        list[next].focus();
        e.preventDefault();
      }
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
      before?.focus?.();
    };
  }, [i, images.length, go, onClose]);

  const onWheel = (e: React.WheelEvent) => {
    applyScale(Math.min(3.2, Math.max(1, scale - Math.sign(e.deltaY) * 0.4)));
  };

  /* Touch: two fingers pinch-zoom, one finger pans when zoomed and swipes
     between photos when not. A gesture that ever had two fingers never
     counts as a swipe (a lifting pinch finger must not flip the photo). */
  const dist2 = (t: React.TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length >= 2) {
      gestureWasPinch.current = true;
      pinch.current = { dist: dist2(e.touches), scale };
      swipeStart.current = null; touchPan.current = null;
    } else if (scale > 1) {
      touchPan.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, px: pan.x, py: pan.y };
      swipeStart.current = null;
    } else {
      gestureWasPinch.current = false;
      swipeStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length >= 2 && pinch.current) {
      applyScale(Math.min(3.2, Math.max(1, pinch.current.scale * (dist2(e.touches) / pinch.current.dist))));
    } else if (e.touches.length === 1 && touchPan.current) {
      const t = touchPan.current;
      setPan({ x: t.px + (e.touches[0].clientX - t.x), y: t.py + (e.touches[0].clientY - t.y) });
    }
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length < 2) pinch.current = null;
    if (e.touches.length === 0) touchPan.current = null;
    const t = swipeStart.current;
    if (!t || gestureWasPinch.current || scale > 1 || images.length < 2 || e.touches.length > 0) return;
    swipeStart.current = null;
    const dx = e.changedTouches[0].clientX - t.x;
    if (Math.abs(dx) > 48) go(dx < 0 ? i + 1 : i - 1, "arrow");
  };

  const nav = images.length > 1;
  const arrowStyle: React.CSSProperties = {
    position: "absolute", top: "50%", transform: "translateY(-50%)", zIndex: 3,
    width: 46, height: 46, borderRadius: "50%", background: "rgba(255,255,255,0.95)",
    border: "1px solid #E0E4ED", display: "flex", alignItems: "center", justifyContent: "center",
    cursor: "pointer", fontSize: 20, color: "#19202E", userSelect: "none", padding: 0,
  };

  return (
    <div
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-label={`Photos of ${alt}`}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(13,17,27,0.86)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", animation: "elumeOverlay .18s ease" }}
    >
      <button ref={closeRef} type="button" onClick={onClose} aria-label="Close photo viewer" style={{ position: "absolute", top: 18, right: 22, zIndex: 4, width: 42, height: 42, borderRadius: "50%", background: "rgba(255,255,255,0.95)", border: "1px solid #E0E4ED", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 20, color: "#19202E", padding: 0 }}>×</button>
      {nav && <button type="button" onClick={() => go(i - 1, "arrow")} aria-label="Previous photo" style={{ ...arrowStyle, left: 20 }}>‹</button>}
      {nav && <button type="button" onClick={() => go(i + 1, "arrow")} aria-label="Next photo" style={{ ...arrowStyle, right: 20 }}>›</button>}

      <div
        onWheel={onWheel}
        onDoubleClick={toggleZoom}
        onMouseDown={(e) => { if (scale > 1) { dragging.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y }; e.preventDefault(); } }}
        onMouseMove={(e) => { const d = dragging.current; if (d) setPan({ x: d.px + (e.clientX - d.x), y: d.py + (e.clientY - d.y) }); }}
        onMouseUp={() => { dragging.current = null; }}
        onMouseLeave={() => { dragging.current = null; }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{ flex: "0 1 auto", width: "min(92vw, 980px)", height: "min(74vh, 720px)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", cursor: scale > 1 ? "grab" : "zoom-in", touchAction: "none" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={images[i]}
          alt={alt}
          draggable={false}
          style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`, transition: dragging.current || pinch.current ? "none" : "transform .18s ease", background: "#fff", borderRadius: 12, padding: 10, boxSizing: "border-box" }}
        />
      </div>

      {nav && (
        <div style={{ marginTop: 14, display: "flex", gap: 8, alignItems: "center", maxWidth: "92vw", overflowX: "auto", padding: "2px 4px" }}>
          {images.map((u, k) => (
            <button key={u + k} type="button" onClick={() => go(k, "thumb")} aria-label={`Photo ${k + 1}`} aria-current={k === i} style={{ width: 56, height: 56, flex: "0 0 auto", padding: 0, borderRadius: 9, cursor: "pointer", background: "#fff", border: k === i ? "2px solid #6E7BF0" : "1px solid rgba(255,255,255,0.35)", overflow: "hidden" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={u} alt="" style={{ width: "100%", height: "100%", objectFit: "contain", padding: 4, boxSizing: "border-box" }} />
            </button>
          ))}
        </div>
      )}
      <div style={{ marginTop: 10, fontSize: 12, color: "rgba(255,255,255,0.75)" }}>
        {nav ? `${i + 1} of ${images.length} · ` : ""}double-click, scroll or pinch to zoom{scale > 1 ? " · drag to pan" : ""}
      </div>
    </div>
  );
}
