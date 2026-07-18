/** Skeleton grid shown while the catalogue payload loads (first visit or
 *  ISR revalidation); search navigations land instantly instead of hanging. */
export default function CatalogueLoading() {
  return (
    <main style={{ maxWidth: 1280, margin: "0 auto", padding: "22px 24px 60px" }}>
      <div style={{ height: 44, borderRadius: 12, background: "#F0F2F6", marginBottom: 20, animation: "elumePulse 1.2s ease-in-out infinite" }} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(232px, 1fr))", gap: 16 }}>
        {Array.from({ length: 10 }, (_, i) => (
          <div key={i} style={{ height: 300, borderRadius: 14, background: "#F0F2F6", animation: `elumePulse 1.2s ease-in-out ${(i % 5) * 0.1}s infinite` }} />
        ))}
      </div>
      <style>{`@keyframes elumePulse { 0%,100% { opacity: 1 } 50% { opacity: .55 } }`}</style>
    </main>
  );
}
