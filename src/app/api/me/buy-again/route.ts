import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/supabase/admin";

/**
 * Personalization feed for the signed-in shopper: products they actually
 * bought (most recent + most repeated first). Session-scoped — anonymous
 * visitors get an empty list and the catalogue renders exactly as before.
 */
export const dynamic = "force-dynamic";

const REAL = ["placed", "confirmed", "packed", "shipped", "partially_shipped", "out_for_delivery", "delivered"];

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) return NextResponse.json({ items: [], email: null });

    const db = adminClient();
    if (!db) return NextResponse.json({ items: [], email: null });

    const { data: orders } = await db
      .from("orders")
      .select("items, created_at, user_id, email")
      .in("status", REAL)
      .order("created_at", { ascending: false })
      .limit(50);

    const mine = (orders ?? []).filter(
      (o: any) => o.user_id === user.id || (o.email ?? "").toLowerCase() === user.email!.toLowerCase()
    );

    // Rank: frequency first, then recency of last purchase.
    const stat = new Map<string, { count: number; last: string }>();
    for (const o of mine) {
      for (const it of (o.items ?? []) as { id?: string; qty?: number }[]) {
        if (!it.id) continue;
        const s = stat.get(it.id) ?? { count: 0, last: o.created_at };
        s.count += 1;
        stat.set(it.id, s);
      }
    }
    const ids = [...stat.entries()].sort((a, b) => b[1].count - a[1].count || (a[1].last < b[1].last ? 1 : -1)).slice(0, 10).map(([id]) => id);
    if (!ids.length) return NextResponse.json({ items: [], email: user.email });

    const { data: prods } = await db
      .from("products")
      .select("id, name, brand, category, mrp, elume_price, unit, image_url")
      .in("id", ids)
      .eq("is_active", true);

    const byId = new Map((prods ?? []).map((p: any) => [p.id, p]));
    const items = ids
      .map((id) => byId.get(id))
      .filter(Boolean)
      .map((p: any) => ({ id: p.id, name: p.name, brand: p.brand, cat: p.category, price: Number(p.elume_price), mrp: Number(p.mrp), unit: p.unit, image: p.image_url }));

    const meta = user.user_metadata as Record<string, unknown> | null;
    return NextResponse.json({ items, email: user.email, name: (meta?.full_name as string) ?? null });
  } catch {
    return NextResponse.json({ items: [], email: null });
  }
}
