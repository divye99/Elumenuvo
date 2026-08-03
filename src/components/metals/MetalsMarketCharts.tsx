import TradingViewWidget from "./TradingViewWidget";

/**
 * The two public market-reference charts on a copper page: MCX copper futures
 * (INR) and the international copper benchmark. Both are TradingView embeds -
 * the legal way to show exchange data publicly (our own stored MCX/LME series
 * power only the admin console). Server component; the widgets hydrate client-side.
 *
 * Symbols (verified Aug 2026): MCX:COPPER1! is the MCX near-month continuous
 * future; LME:CA1! is LME Grade A Copper continuous, which TradingView serves
 * to anonymous visitors (delayed). If LME embeds ever become login-gated,
 * fall back to COMEX:HG1! and relabel.
 */
export default function MetalsMarketCharts() {
  return (
    <section data-pdp-sec="market-charts" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: "1px", textTransform: "uppercase", color: "#8A93A6" }}>Market reference</div>
        <h2 style={{ fontFamily: "var(--space-grotesk)", fontSize: 20, fontWeight: 600, letterSpacing: "-0.4px", margin: "4px 0 0", color: "#19202E" }}>
          Copper on the exchanges
        </h2>
        <p style={{ fontSize: 13, color: "#56627A", margin: "6px 0 0", lineHeight: 1.55, maxWidth: 720 }}>
          Our selling rate tracks the market through the day. Compare it against MCX copper futures (INR) and LME
          copper (USD) - both charts are live from TradingView with 24-hour to multi-year ranges.
        </p>
      </div>
      <div className="metals-charts" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <TradingViewWidget symbol="MCX:COPPER1!" title="MCX Copper futures · ₹/kg" />
        <TradingViewWidget symbol="LME:CA1!" title="LME Copper (Grade A) · $/tonne" />
      </div>
      <p style={{ fontSize: 11.5, color: "#8A93A6", margin: 0 }}>
        Exchange charts are provided by TradingView for reference only and may be delayed. They are not our selling price.
      </p>
    </section>
  );
}
