import { Sk, SkProductCard } from "@/components/storefront/Skeleton";
import StoreChrome from "@/components/storefront/StoreChrome";

/** Wholesale skeleton: dark policy hero footprint + the savings grid. */
export default function WholesaleLoading() {
  return (
    <StoreChrome>
      <main style={{ maxWidth: 1280, margin: "0 auto", padding: "0 24px 64px" }}>
        <div style={{ margin: "22px 0 26px" }}><Sk h={250} r={18} style={{ background: "#E3E6EF" }} /></div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 12 }}>
          <Sk h={22} w={260} r={7} /><Sk h={12} w={220} r={6} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(224px, 1fr))", gap: 14 }}>
          {Array.from({ length: 8 }, (_, i) => <SkProductCard key={i} width={224} />)}
        </div>
      </main>
    </StoreChrome>
  );
}
