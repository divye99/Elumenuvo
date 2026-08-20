/* eslint-disable @next/next/no-img-element */
// Logo lockups from the Factor X identity kit (Aug 2026). Plain <img> (not
// next/image) to match the prototype's exact height-driven sizing with
// transparent PNGs.
//
// Variant guide (all sourced from the kit, use the one that fits the surface):
//   Mark               - the "e" + gold star, colour, for light surfaces
//   Mark white         - white "e" + star, for dark surfaces (workspace sidebar)
//   Wordmark / white   - "elume" alone; pairs with Mark in headers
//   Lockup             - stacked mark-over-wordmark, for centered auth cards
//   Horizontal (asset) - /assets/elume-horizontal(.png|-white.png), used in
//                        emails and the invoice PDF where one image must
//                        carry the whole identity

export function Mark({ height = 30, white = false }: { height?: number; white?: boolean }) {
  return (
    <img
      src={white ? "/assets/elume-mark-white.png" : "/assets/elume-mark.png"}
      alt="Elume"
      style={{ height, width: "auto", display: "block" }}
    />
  );
}

export function Wordmark({ height = 17, white = false, opacity }: { height?: number; white?: boolean; opacity?: number }) {
  return (
    <img
      src={white ? "/assets/elume-wordmark-white.png" : "/assets/elume-wordmark.png"}
      alt="elume"
      style={{ height, width: "auto", display: "block", opacity }}
    />
  );
}

/** Stacked full logo (mark over wordmark) for centered contexts: auth cards,
 *  empty states, anywhere the brand stands alone rather than in a nav row. */
export function Lockup({ height = 64 }: { height?: number }) {
  return <img src="/assets/elume-logo-stacked.png" alt="Elume" style={{ height, width: "auto", display: "block" }} />;
}
