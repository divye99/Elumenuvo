"use client";

import { useRouter, useSearchParams } from "next/navigation";

/** Dropdown filter bar for the analytics page. Every select writes its value
 *  into the URL, so filtered views are shareable and survive refresh. */
export default function Filters({ countries, states, devices }: { countries: string[]; states: string[]; devices: string[] }) {
  const router = useRouter();
  const sp = useSearchParams();

  const set = (key: string, value: string) => {
    const q = new URLSearchParams(sp.toString());
    if (value) q.set(key, value); else q.delete(key);
    router.push(`/admin/analytics?${q.toString()}`);
  };

  const sel: React.CSSProperties = { border: "1px solid #E0E4ED", borderRadius: 9, padding: "7px 10px", fontSize: 12.5, background: "#fff", color: "#19202E", maxWidth: 190 };

  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
      <select style={sel} value={sp.get("identity") ?? ""} onChange={(e) => set("identity", e.target.value)}>
        <option value="">Everyone</option>
        <option value="identified">Identified only</option>
        <option value="anonymous">Anonymous only</option>
      </select>
      <select style={sel} value={sp.get("device") ?? ""} onChange={(e) => set("device", e.target.value)}>
        <option value="">All devices</option>
        {devices.map((d) => <option key={d} value={d}>{d}</option>)}
      </select>
      <select style={sel} value={sp.get("country") ?? ""} onChange={(e) => set("country", e.target.value)}>
        <option value="">All countries</option>
        {countries.map((c) => <option key={c} value={c}>{c === "IN" ? "India" : c}</option>)}
      </select>
      <select style={sel} value={sp.get("state") ?? ""} onChange={(e) => set("state", e.target.value)}>
        <option value="">All states</option>
        {states.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
      <select style={sel} value={sp.get("src") ?? ""} onChange={(e) => set("src", e.target.value)}>
        <option value="">All sources</option>
        <option value="google">From Google</option>
        <option value="campaign">Campaign / UTM</option>
        <option value="referral">Other referral</option>
        <option value="direct">Direct</option>
      </select>
      <select style={sel} value={sp.get("min") ?? ""} onChange={(e) => set("min", e.target.value)}>
        <option value="">Any activity</option>
        <option value="2">2+ pages</option>
        <option value="5">5+ pages</option>
        <option value="cart">Added to cart</option>
      </select>
      <select style={sel} value={sp.get("bots") ?? ""} onChange={(e) => set("bots", e.target.value)}>
        <option value="">Humans only</option>
        <option value="1">Include likely bots</option>
        <option value="only">Likely bots only</option>
      </select>
      {(sp.get("identity") || sp.get("device") || sp.get("country") || sp.get("state") || sp.get("src") || sp.get("min") || sp.get("bots")) && (
        <button onClick={() => router.push(`/admin/analytics?days=${sp.get("days") ?? "14"}`)} style={{ border: "none", background: "none", color: "#4E5BDC", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
          Clear filters
        </button>
      )}
    </div>
  );
}
