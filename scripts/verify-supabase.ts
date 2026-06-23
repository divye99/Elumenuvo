// Quick check that the Supabase products + content tables are live via the anon key.
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";

async function main() {
  const c = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } }
  );

  const { data: products, error: pe } = await c
    .from("products")
    .select("id, name, brand")
    .order("sort_order");
  const { data: content, error: ce } = await c.from("content").select("key");

  console.log("PRODUCTS:", products?.length ?? "ERR", pe?.message ?? "");
  if (products) {
    const brands = [...new Set(products.map((p) => p.brand))].sort();
    console.log("  brands:", brands.join(", "));
    console.log("  cmi count:", products.filter((p) => p.brand === "CMI").length);
  }
  console.log("CONTENT KEYS:", content?.map((r) => r.key).join(", ") ?? "ERR", ce?.message ?? "");
}

main();
