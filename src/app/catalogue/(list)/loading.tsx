/** Skeleton grid shown while the catalogue payload loads (first visit or
 *  ISR revalidation); search navigations land instantly instead of hanging.
 *
 *  Lives inside the (list) route group ON PURPOSE. A loading.tsx at
 *  /catalogue would also wrap /catalogue/[id], and that streaming boundary
 *  flushes the response - committing HTTP 200 - before the product page can
 *  call notFound(). Deleted products then answered "This page could not be
 *  found" with a 200 status: a soft 404 that Google keeps crawling and never
 *  drops. The group scopes this skeleton to the listing page only. */
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
