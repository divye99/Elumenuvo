import Link from "next/link";
import { requireAdmin } from "@/lib/admin/auth";
import { adminClient } from "@/lib/supabase/admin";
import { buildPortfolio } from "@/lib/personal/engine";
import { istDate } from "@/lib/admin/ist";
import { fmt } from "@/lib/format";

export const dynamic = "force-dynamic";

/**
 * Admin → Customers: account intelligence as a sales weapon.
 *
 * The list ranks every buying customer by lifetime value with their cadence
 * at a glance. Opening one shows their portfolio (categories, brands) and
 * the replenishment predictions - the same engine the customer's own
 * dashboard uses - with a one-click bridge into the WhatsApp cart-link
 * builder pre-filled with everything that's due. "Your usual 2.5 sqmm
 * order is due" outreach, three clicks end to end.
 */
export default async function AdminCustomers({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
  await requireAdmin();
  const { email } = await searchParams;
  const db = adminClient();
  if (!db) return <div>Service role missing.</div>;

  type OrderRow = { email: string | null; name: string | null; total: number | null; created_at: string; is_guest: boolean | null };
  const rows: OrderRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data } = await db
      .from("orders")
      .select("email, name, total, created_at, is_guest")
      .not("status", "in", "(cancelled,payment_abandoned,awaiting_payment)")
      .order("created_at", { ascending: false })
      .range(from, from + 999);
    if (!data?.length) break;
    rows.push(...(data as OrderRow[]));
    if (data.length < 1000) break;
  }

  const byEmail = new Map<string, { name: string; orders: number; spend: number; lastAt: string; guest: boolean }>();
  for (const o of rows) {
    if (!o.email) continue;
    const key = o.email.toLowerCase();
    const c = byEmail.get(key) ?? { name: o.name ?? "", orders: 0, spend: 0, lastAt: o.created_at, guest: o.is_guest ?? false };
    c.orders += 1;
    c.spend += Number(o.total) || 0;
    if (o.created_at > c.lastAt) c.lastAt = o.created_at;
    if (o.name && !c.name) c.name = o.name;
    byEmail.set(key, c);
  }
  const customers = [...byEmail.entries()].sort((a, b) => b[1].spend - a[1].spend);

  const selected = email ? await buildPortfolio(email) : null;

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 6px" }}>Customers</h1>
      <p style={{ fontSize: 13.5, color: "#56627A", margin: "0 0 18px", maxWidth: 760 }}>
        Every buying customer by lifetime value. Open one for their portfolio and predicted reorders,
        then send them a prefilled WhatsApp cart in one click.
      </p>

      {selected && email && (
        <div style={{ background: "#fff", border: "1px solid #C9CFF6", borderRadius: 14, padding: 18, marginBottom: 20 }}>
          <div style={{ display: "flex", gap: 16, alignItems: "baseline", flexWrap: "wrap" }}>
            <span style={{ fontSize: 15.5, fontWeight: 800 }}>{email}</span>
            <span style={{ fontSize: 12.5, color: "#8A93A6" }}>{selected.orders} orders · {selected.units} units · <b style={{ color: "#19202E" }}>{fmt(selected.spend)}</b> lifetime</span>
            <span style={{ fontSize: 12.5, color: "#8A93A6" }}>first {selected.firstAt ? istDate(selected.firstAt) : "-"} · last {selected.lastAt ? istDate(selected.lastAt) : "-"}</span>
            <Link href="/admin/customers" style={{ marginLeft: "auto", fontSize: 12.5, color: "#8A93A6" }}>✕ close</Link>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "12px 0" }}>
            {selected.byCategory.map((c) => (
              <span key={c.cat} style={{ fontSize: 11.5, fontWeight: 600, color: "#3A4358", background: "#F5F6F9", borderRadius: 999, padding: "4px 11px" }}>{c.cat} · {c.units}u · {fmt(c.spend)}</span>
            ))}
            {selected.byBrand.slice(0, 6).map((b) => (
              <span key={b.brand} style={{ fontSize: 11.5, fontWeight: 600, color: "#3A46B8", background: "#EEF0FE", borderRadius: 999, padding: "4px 11px" }}>{b.brand}</span>
            ))}
          </div>
          {selected.nextCategories.length > 0 && (
            <div style={{ fontSize: 12.5, color: "#56627A", marginTop: 4 }}>
              <b style={{ color: "#19202E" }}>Predicted next phase:</b>{" "}
              {selected.nextCategories.map((n, i) => <span key={n.cat}>{i > 0 && " · "}<b style={{ color: "#3A46B8" }}>{n.cat}</b> <span style={{ color: "#8A93A6" }}>({n.why})</span></span>)}
            </div>
          )}
          <div style={{ fontSize: 13.5, fontWeight: 700, margin: "14px 0 8px" }}>
            Predicted due for reorder {selected.due.length === 0 && <span style={{ fontWeight: 400, color: "#8A93A6", fontSize: 12.5 }}>- nothing yet (needs 2+ purchases of the same product)</span>}
          </div>
          {selected.due.map((d) => (
            <div key={d.id} style={{ display: "flex", gap: 10, alignItems: "center", padding: "7px 0", borderTop: "1px solid #F5F6F9", fontSize: 12.5 }}>
              <span style={{ flex: 1, minWidth: 0, fontWeight: 600 }}>{d.name}</span>
              <span style={{ color: "#C77700" }}>every ~{d.gapDays}d · last {d.lastDays}d ago · {d.times}×</span>
              <span style={{ fontWeight: 700 }}>{fmt(d.price)}</span>
            </div>
          ))}
          {selected.due.length > 0 && (
            <Link
              href={`/admin/cart-links?items=${selected.due.map((d) => `${d.id}:1`).join(",")}&phone=`}
              style={{ display: "inline-block", marginTop: 12, background: "#1FAF56", color: "#fff", fontWeight: 700, fontSize: 13, padding: "10px 18px", borderRadius: 9 }}
            >
              Build WhatsApp cart with all due items →
            </Link>
          )}
        </div>
      )}

      <div style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 14, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,2fr) minmax(0,1.4fr) 70px 110px 100px", gap: 10, padding: "10px 16px", fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "#8A93A6" }}>
          <span>Customer</span><span>Email</span><span style={{ textAlign: "right" }}>Orders</span><span style={{ textAlign: "right" }}>Lifetime</span><span>Last order</span>
        </div>
        {customers.map(([em, c]) => (
          <Link key={em} href={`/admin/customers?email=${encodeURIComponent(em)}`} style={{ display: "grid", gridTemplateColumns: "minmax(0,2fr) minmax(0,1.4fr) 70px 110px 100px", gap: 10, padding: "11px 16px", borderTop: "1px solid #F5F6F9", fontSize: 13, color: "#19202E", alignItems: "center" }}>
            <span style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {c.name || "-"} {c.guest && <span style={{ fontSize: 9.5, fontWeight: 800, color: "#C77700", background: "#FFF3E0", padding: "1px 6px", borderRadius: 5, marginLeft: 4 }}>GUEST</span>}
            </span>
            <span style={{ color: "#56627A", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{em}</span>
            <span style={{ textAlign: "right" }}>{c.orders}</span>
            <span style={{ textAlign: "right", fontWeight: 700 }}>{fmt(c.spend)}</span>
            <span style={{ color: "#8A93A6", fontSize: 12 }}>{istDate(c.lastAt)}</span>
          </Link>
        ))}
        {customers.length === 0 && <div style={{ padding: 22, fontSize: 13, color: "#8A93A6" }}>No paid orders yet.</div>}
      </div>
    </div>
  );
}
