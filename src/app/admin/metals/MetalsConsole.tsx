"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { lotKg, unitPriceFromRate } from "@/lib/metals";

/** One metals product row as the console needs it (serialized by the page). */
export type ConsoleProduct = {
  id: string;
  name: string;
  spec: string;
  unit: string;
  lot: string | null;
  attrs: Record<string, string> | null;
  gstRate: number;
  price: number; // stored GST-inclusive per selling unit
  active: boolean;
};

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

export default function MetalsConsole({ products }: { products: ConsoleProduct[] }) {
  const router = useRouter();
  const [rates, setRates] = useState<Record<string, string>>({});
  const [fillAll, setFillAll] = useState("");
  const [status, setStatus] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const entries = useMemo(
    () =>
      products
        .map((p) => ({ id: p.id, rate: parseFloat(rates[p.id] ?? "") }))
        .filter((e) => Number.isFinite(e.rate) && e.rate > 0),
    [products, rates]
  );

  async function post(body: unknown): Promise<{ ok: boolean; error?: string; needsConfirm?: boolean }> {
    try {
      const res = await fetch("/api/admin/metals/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      return await res.json();
    } catch {
      return { ok: false, error: "Network error - try again." };
    }
  }

  function saveRates() {
    if (!entries.length) return;
    setStatus(null);
    startTransition(async () => {
      let res = await post({ op: "set-rates", entries });
      // Fat-finger guard: the server flags >15% moves; apply only after the
      // operator explicitly confirms the jump.
      if (!res.ok && res.needsConfirm) {
        if (!window.confirm(`${res.error}\n\nApply anyway?`)) return;
        res = await post({ op: "set-rates", entries, force: true });
      }
      if (res.ok) {
        setStatus({ kind: "ok", text: `Saved ${entries.length} rate${entries.length > 1 ? "s" : ""}. Storefront prices are live.` });
        setRates({});
        setFillAll("");
        router.refresh();
      } else {
        setStatus({ kind: "err", text: res.error ?? "Could not save." });
      }
    });
  }

  function toggle(p: ConsoleProduct) {
    setStatus(null);
    startTransition(async () => {
      const res = await post({ op: "toggle-active", id: p.id, active: !p.active });
      if (res.ok) router.refresh();
      else setStatus({ kind: "err", text: res.error ?? "Could not update." });
    });
  }

  const inp: React.CSSProperties = {
    width: 110,
    padding: "8px 10px",
    border: "1px solid #E0E4ED",
    borderRadius: 9,
    fontSize: 14,
    fontWeight: 600,
    fontFamily: "inherit",
  };

  return (
    <div style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 14, padding: "20px 24px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        <span style={{ fontSize: 13, fontWeight: 700 }}>Today's rate</span>
        <input
          style={inp}
          inputMode="decimal"
          placeholder="₹/kg ex-GST"
          value={fillAll}
          onChange={(e) => setFillAll(e.target.value)}
        />
        <button
          onClick={() => {
            if (!parseFloat(fillAll)) return;
            setRates(Object.fromEntries(products.map((p) => [p.id, fillAll])));
          }}
          style={{ fontSize: 13, fontWeight: 700, color: "#1D2F8A", background: "#EEF0FD", border: "none", padding: "9px 14px", borderRadius: 9, cursor: "pointer" }}
        >
          Fill all rows
        </button>
        <span style={{ fontSize: 12, color: "#8A93A6" }}>One copper rate usually applies across products - fill, adjust any row, then save.</span>
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
        <thead>
          <tr>
            {["Product", "Sells as", "Current rate", "Current price", "New rate (₹/kg ex-GST)", "New price (incl. GST)", "Live"].map((h) => (
              <th key={h} style={{ textAlign: "left", fontSize: 11, fontWeight: 800, letterSpacing: 0.7, textTransform: "uppercase", color: "#8A93A6", padding: "8px 10px 8px 0", borderBottom: "1px solid #E8EBF1" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {products.map((p) => {
            const kg = lotKg(p.attrs);
            const curRate = p.price / (1 + p.gstRate) / kg;
            const next = parseFloat(rates[p.id] ?? "");
            const nextPrice = Number.isFinite(next) && next > 0 ? unitPriceFromRate(next, p.gstRate, p.attrs) : null;
            return (
              <tr key={p.id}>
                <td style={{ padding: "12px 10px 12px 0", borderBottom: "1px solid #F5F6F9", fontWeight: 600 }}>
                  {p.name}
                  {p.lot && <span style={{ marginLeft: 8, fontSize: 11.5, fontWeight: 700, color: "#1D2F8A", background: "#EEF0FD", borderRadius: 7, padding: "2px 8px" }}>{p.lot}</span>}
                </td>
                <td style={{ padding: "12px 10px 12px 0", borderBottom: "1px solid #F5F6F9", color: "#56627A" }}>{kg === 1 ? "per kg" : `${p.lot} lot (${kg.toLocaleString("en-IN")} kg)`}</td>
                <td style={{ padding: "12px 10px 12px 0", borderBottom: "1px solid #F5F6F9" }}>₹{curRate.toFixed(2)}/kg</td>
                <td style={{ padding: "12px 10px 12px 0", borderBottom: "1px solid #F5F6F9" }}>{inr(p.price)}</td>
                <td style={{ padding: "12px 10px 12px 0", borderBottom: "1px solid #F5F6F9" }}>
                  <input
                    style={inp}
                    inputMode="decimal"
                    placeholder={curRate.toFixed(2)}
                    value={rates[p.id] ?? ""}
                    onChange={(e) => setRates((r) => ({ ...r, [p.id]: e.target.value }))}
                  />
                </td>
                <td style={{ padding: "12px 10px 12px 0", borderBottom: "1px solid #F5F6F9", fontWeight: 600, color: nextPrice != null ? "#19202E" : "#A0A7B5" }}>
                  {nextPrice != null ? inr(nextPrice) : "-"}
                </td>
                <td style={{ padding: "12px 0", borderBottom: "1px solid #F5F6F9" }}>
                  <button
                    onClick={() => toggle(p)}
                    disabled={pending}
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      padding: "5px 12px",
                      borderRadius: 8,
                      cursor: "pointer",
                      border: "none",
                      color: p.active ? "#137a4b" : "#56627A",
                      background: p.active ? "#E6F5EE" : "#F1F3F8",
                    }}
                  >
                    {p.active ? "Live" : "Hidden"}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 18 }}>
        <button
          onClick={saveRates}
          disabled={pending || entries.length === 0}
          style={{
            background: entries.length ? "#1D2F8A" : "#AEB6C4",
            color: "#fff",
            fontWeight: 700,
            fontSize: 14,
            border: "none",
            padding: "11px 22px",
            borderRadius: 11,
            cursor: entries.length ? "pointer" : "default",
          }}
        >
          {pending ? "Saving…" : `Save ${entries.length || ""} rate${entries.length === 1 ? "" : "s"}`}
        </button>
        {status && (
          <span style={{ fontSize: 13, fontWeight: 600, color: status.kind === "ok" ? "#1F9D63" : "#D14343" }}>{status.text}</span>
        )}
      </div>
    </div>
  );
}
