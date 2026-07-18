"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// A user-fillable product-image placeholder. Empty state shows the category
// gradient tile with a "Drop product photo / browse files" affordance; a
// dropped or browsed image fills it and persists across reloads via
// localStorage (keyed by `id`). Mirrors the prototype's <image-slot> behaviour.

const STORE_KEY = "elume.imageSlots";
const ACCEPT = ["image/png", "image/jpeg", "image/webp", "image/avif"];

function readStore(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY) || "{}");
  } catch {
    return {};
  }
}
function writeStore(next: Record<string, string>) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(next));
  } catch {
    /* quota / disabled — slot simply won't persist */
  }
}

export default function ImageSlot({
  id,
  tile,
  placeholder = "Drop product photo",
  radius = 0,
  imageUrl,
  allowUpload = false,
}: {
  id: string;
  tile: string;
  placeholder?: string;
  radius?: number;
  imageUrl?: string;
  /** Upload affordance is for the internal workspace only. On the public
   *  storefront a product photo is just a photo: clicks fall through to the
   *  card's link (the product page) instead of opening a file picker. */
  allowUpload?: boolean;
}) {
  const [localSrc, setSrc] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  // A real uploaded image (Supabase Storage) takes priority over a locally
  // dropped preview.
  const src = imageUrl ?? localSrc;

  useEffect(() => {
    // Hydrate any previously-dropped image for this slot from localStorage.
    // Starts null on the server and first client render (matching SSR), then
    // loads on mount — the standard "read from external store" effect.
    const store = readStore();
    if (store[id]) setSrc(store[id]);
  }, [id]);

  const ingest = useCallback(
    (file: File | undefined) => {
      if (!file || !ACCEPT.includes(file.type)) return;
      const reader = new FileReader();
      reader.onload = () => {
        const data = String(reader.result);
        setSrc(data);
        const store = readStore();
        store[id] = data;
        writeStore(store);
      };
      reader.readAsDataURL(file);
    },
    [id]
  );

  return (
    <div
      onClick={allowUpload ? (e) => {
        e.stopPropagation();
        inputRef.current?.click();
      } : undefined}
      onDragOver={allowUpload ? (e) => {
        e.preventDefault();
        setOver(true);
      } : undefined}
      onDragLeave={allowUpload ? () => setOver(false) : undefined}
      onDrop={allowUpload ? (e) => {
        e.preventDefault();
        e.stopPropagation();
        setOver(false);
        ingest(e.dataTransfer.files?.[0]);
      } : undefined}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        background: src ? "#fff" : tile,
        borderRadius: radius || undefined,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        cursor: allowUpload ? "pointer" : undefined,
        overflow: "hidden",
        outline: over ? "2px dashed #4E5BDC" : "none",
        outlineOffset: -4,
      }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        // "contain", not "cover": product photography must show the WHOLE
        // product at first glance. Cover zoomed to fill the slot and cropped
        // tops/bottoms off fans and wire boxes. The slot's white background
        // letterboxes cleanly, and the padding keeps the product off the edges.
        <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "contain", padding: "6%", boxSizing: "border-box" }} />
      ) : allowUpload ? (
        <div style={{ textAlign: "center", pointerEvents: "none", padding: "0 10px" }}>
          <div style={{ fontSize: 11.5, fontWeight: 600, color: "#8A93A6" }}>{placeholder}</div>
          <div style={{ fontSize: 10.5, color: "#A8AFBC", marginTop: 2 }}>browse files</div>
        </div>
      ) : null}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT.join(",")}
        onChange={(e) => ingest(e.target.files?.[0])}
        style={{ display: "none" }}
      />
    </div>
  );
}
