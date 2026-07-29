import { Sk, SkLines } from "@/components/storefront/Skeleton";

/** Checkout skeleton: form column + 340px sticky summary, same grid. */
export default function CheckoutLoading() {
  return (
    <main style={{ maxWidth: 1080, margin: "0 auto", padding: "30px 24px 60px" }}>
      <Sk h={28} w={180} r={8} />
      <div style={{ height: 20 }} />
      <div className="co-skel" style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 22, alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Sk h={170} r={14} />
          <Sk h={300} r={14} />
          <Sk h={120} r={14} />
        </div>
        <div style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 14, padding: 18 }}>
          <Sk h={16} w={130} r={6} />
          <div style={{ height: 14 }} />
          <SkLines n={4} h={12} gap={10} lastW="50%" />
          <div style={{ height: 16 }} />
          <Sk h={44} r={11} />
        </div>
      </div>
      <style>{`@media (max-width: 860px) { .co-skel { grid-template-columns: 1fr !important; } }`}</style>
    </main>
  );
}
