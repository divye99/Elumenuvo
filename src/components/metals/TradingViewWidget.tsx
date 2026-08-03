"use client";

import { useEffect, useRef } from "react";

/**
 * TradingView advanced-chart embed (the LEGAL public market chart: TradingView
 * is licensed for exchange data and its terms allow embedding with the
 * attribution kept intact). Our own stored LME/MCX series stay INTERNAL -
 * this widget is the only market data the public site shows.
 *
 * The embed script reads its JSON config from its own innerHTML, so it is
 * injected imperatively; the widget manages the iframe from there.
 */
export default function TradingViewWidget({ symbol, title }: { symbol: string; title: string }) {
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    el.innerHTML = "";
    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol,
      interval: "D",
      timezone: "Asia/Kolkata",
      theme: "light",
      style: "1",
      locale: "en",
      hide_top_toolbar: false,
      hide_legend: false,
      allow_symbol_change: false,
      save_image: false,
      calendar: false,
      support_host: "https://www.tradingview.com",
    });
    el.appendChild(script);
    return () => { el.innerHTML = ""; };
  }, [symbol]);

  return (
    <div style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 16, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, padding: "14px 18px 10px" }}>
        <span style={{ fontSize: 13.5, fontWeight: 700, color: "#19202E" }}>{title}</span>
        <span style={{ fontSize: 11, color: "#8A93A6" }}>{symbol}</span>
      </div>
      <div style={{ height: 420 }}>
        <div ref={box} className="tradingview-widget-container" style={{ height: "100%", width: "100%" }} />
      </div>
      {/* Attribution is a condition of TradingView's free embed licence. */}
      <div style={{ padding: "8px 18px 12px", fontSize: 11, color: "#8A93A6" }}>
        Chart by{" "}
        <a href="https://www.tradingview.com/" target="_blank" rel="noopener nofollow noreferrer" style={{ color: "#4E5BDC", fontWeight: 600 }}>
          TradingView
        </a>
      </div>
    </div>
  );
}
