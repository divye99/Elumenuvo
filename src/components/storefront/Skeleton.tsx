/**
 * Skeleton primitives - the Instagram/YouTube/Zomato pattern. Each route's
 * loading.tsx composes these into a grey copy of its REAL layout (same
 * containers, same column widths, same card sizes), so the page paints its
 * frame in the same frame as the tap, and content later fills the shapes
 * in place without anything jumping.
 *
 * Server components only - no state, no data, so Next.js can ship them with
 * the JS bundle and paint them instantly.
 */

export function Sk({ w, h, r = 10, style }: { w?: number | string; h: number | string; r?: number; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        width: w ?? "100%",
        height: h,
        borderRadius: r,
        background: "#EDEFF4",
        animation: "elumePulse 1.2s ease-in-out infinite",
        ...style,
      }}
    />
  );
}

/** Grey text lines; last one shorter, like real copy. */
export function SkLines({ n = 3, h = 13, gap = 9, lastW = "62%" }: { n?: number; h?: number; gap?: number; lastW?: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap }}>
      {Array.from({ length: n }, (_, i) => (
        <Sk key={i} h={h} w={i === n - 1 ? lastW : "100%"} r={6} />
      ))}
    </div>
  );
}

/** The exact footprint of a ProductCard (image slot, brand dot, title, spec
 *  bullets, price block, CTA) at the rail width used across the store. */
export function SkProductCard({ width = 216 }: { width?: number }) {
  return (
    <div style={{ width, flex: `0 0 ${width}px`, background: "#fff", border: "1px solid #E8EBF1", borderRadius: 14, overflow: "hidden" }}>
      <Sk h={168} r={0} />
      <div style={{ padding: "12px 14px 14px" }}>
        <Sk h={10} w={64} r={5} />
        <div style={{ height: 8 }} />
        <SkLines n={2} h={14} gap={6} lastW="75%" />
        <div style={{ height: 10 }} />
        <SkLines n={2} h={10} gap={5} lastW="55%" />
        <div style={{ height: 12 }} />
        <Sk h={22} w={110} r={6} />
        <div style={{ height: 12 }} />
        <Sk h={34} r={9} />
      </div>
    </div>
  );
}

/** One horizontal rail: heading row then N card shapes. */
export function SkRail({ cards = 5 }: { cards?: number }) {
  return (
    <section>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 10 }}>
        <Sk h={20} w={170} r={7} />
        <Sk h={12} w={80} r={6} />
        <div style={{ marginLeft: "auto" }}><Sk h={12} w={110} r={6} /></div>
      </div>
      <div style={{ display: "flex", gap: 14, overflow: "hidden", paddingBottom: 10 }}>
        {Array.from({ length: cards }, (_, i) => <SkProductCard key={i} />)}
      </div>
    </section>
  );
}

/** The frozen left filter rail's footprint (230px column on hub/collection pages). */
export function SkSidebar() {
  return (
    <aside style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 14, padding: "16px 16px 18px" }}>
      <Sk h={11} w={120} r={5} />
      <div style={{ height: 12 }} />
      <SkLines n={6} h={15} gap={10} lastW="70%" />
      <div style={{ height: 20 }} />
      <Sk h={11} w={60} r={5} />
      <div style={{ height: 12 }} />
      <SkLines n={8} h={13} gap={10} lastW="50%" />
    </aside>
  );
}

/** Shared shell for hub + collection skeletons: 1360 container, 230/1fr grid,
 *  matching CollectionBrowser / HubBrowser exactly. */
export function SkHubShell({ rails = 3 }: { rails?: number }) {
  return (
    <main style={{ maxWidth: 1360, margin: "0 auto", padding: "26px 24px 64px" }}>
      <Sk h={30} w={260} r={8} />
      <div style={{ height: 10 }} />
      <Sk h={14} w={420} r={6} />
      <div style={{ height: 18 }} />
      <div className="col-shell" style={{ display: "grid", gridTemplateColumns: "230px 1fr", gap: 26, alignItems: "start" }}>
        <SkSidebar />
        <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 26 }}>
          {Array.from({ length: rails }, (_, i) => <SkRail key={i} />)}
        </div>
      </div>
      <style>{`@media (max-width: 860px) { .col-shell { grid-template-columns: 1fr !important; } }`}</style>
    </main>
  );
}
