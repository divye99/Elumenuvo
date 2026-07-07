"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  ADMIN_COOKIE,
  ADMIN_TTL_MS,
  makeAdminToken,
  isAdmin,
} from "@/lib/admin/auth";
import { adminClient } from "@/lib/supabase/admin";

export type ActionResult = { ok: true } | { ok: false; error: string };

/** Append a price snapshot so the product-page price history grows (best-effort). */
async function logPrice(db: any, productId: string, elume_price: number, mrp?: number) {
  try { await db.from("price_history").insert({ product_id: productId, elume_price, mrp: mrp ?? null }); } catch { /* table may not exist yet */ }
}


/* ── Auth ── */
export async function login(formData: FormData): Promise<void> {
  const password = String(formData.get("password") ?? "");
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) redirect("/admin/login?error=unconfigured");
  if (password !== expected) redirect("/admin/login?error=invalid");
  const exp = Date.now() + ADMIN_TTL_MS;
  (await cookies()).set(ADMIN_COOKIE, makeAdminToken(exp), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(exp),
  });
  redirect("/admin");
}

export async function logout(): Promise<void> {
  (await cookies()).delete(ADMIN_COOKIE);
  redirect("/admin/login");
}

/* ── Products ── */
export async function upsertProduct(formData: FormData): Promise<void> {
  if (!(await isAdmin())) redirect("/admin/login");
  const db = adminClient();
  if (!db) redirect("/admin/products?error=service-role-missing");

  const id = String(formData.get("id") ?? "").trim();

  // Optional image upload → Supabase Storage (bucket: product-images).
  let image_url: string | null = String(formData.get("current_image_url") ?? "") || null;
  const file = formData.get("image");
  if (file instanceof File && file.size > 0) {
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
    const path = `${id}-${Date.now()}.${ext}`;
    const buf = Buffer.from(await file.arrayBuffer());
    const { error: upErr } = await db.storage
      .from("product-images")
      .upload(path, buf, { contentType: file.type || "image/jpeg", upsert: true });
    if (upErr) redirect(`/admin/products?error=${encodeURIComponent("Image upload: " + upErr.message)}`);
    image_url = db.storage.from("product-images").getPublicUrl(path).data.publicUrl;
  }

  // Packaging / variant attributes → attrs jsonb.
  const attrs: Record<string, string> = {};
  const attrField = (form: string, key: string) => {
    const v = String(formData.get(form) ?? "").trim();
    if (v) attrs[key] = v;
  };
  attrField("attr_size", "Size");
  attrField("attr_length", "Length");
  attrField("attr_colour", "Colour");
  attrField("attr_quality", "Quality");
  attrField("attr_pack", "Pack");

  const row = {
    id,
    sku: String(formData.get("sku") ?? "").trim(),
    name: String(formData.get("name") ?? "").trim(),
    brand: String(formData.get("brand") ?? "").trim(),
    category: String(formData.get("category") ?? "").trim(),
    spec: String(formData.get("spec") ?? "").trim() || null,
    mrp: Number(formData.get("mrp") ?? 0),
    elume_price: Number(formData.get("elume_price") ?? 0),
    unit: String(formData.get("unit") ?? "pc").trim() || "pc",
    sort_order: Number(formData.get("sort_order") ?? 0),
    is_active: formData.get("is_active") === "on",
    is_recommended: formData.get("is_recommended") === "on",
    parent_id: String(formData.get("parent_id") ?? "").trim() || null,
    attrs: Object.keys(attrs).length ? attrs : null,
    image_url,
  };
  const { error } = await db.from("products").upsert(row);
  if (error) redirect(`/admin/products?error=${encodeURIComponent(error.message)}`);
  await logPrice(db, id, row.elume_price, row.mrp);
  revalidatePath("/admin/products");
  revalidatePath("/catalogue");
  redirect("/admin/products?ok=1");
}

/** Save one product's editable details (the "Details" tab of the product hub). */
export async function updateProductDetails(input: {
  id: string;
  name: string;
  spec: string;
  unit: string;
  mrp: number;
  elume_price: number;
  is_active: boolean;
  is_recommended: boolean;
  attrs: Record<string, string>;
}): Promise<ActionResult> {
  if (!(await isAdmin())) return { ok: false, error: "Not signed in." };
  const db = adminClient();
  if (!db) return { ok: false, error: "Service-role key missing — writes disabled." };
  if (!input.id) return { ok: false, error: "Missing product id." };
  if (!(input.mrp > 0) || !(input.elume_price > 0)) return { ok: false, error: "MRP and Elume price must be positive." };
  const attrs = Object.fromEntries(Object.entries(input.attrs).filter(([, v]) => v && v.trim()));
  const { error } = await db.from("products").update({
    name: input.name.trim(),
    spec: input.spec.trim() || null,
    unit: input.unit.trim() || "pc",
    mrp: input.mrp,
    elume_price: input.elume_price,
    is_active: input.is_active,
    is_recommended: input.is_recommended,
    attrs: Object.keys(attrs).length ? attrs : null,
  }).eq("id", input.id);
  if (error) return { ok: false, error: error.message };
  await logPrice(db, input.id, input.elume_price, input.mrp);
  revalidatePath("/admin/products");
  revalidatePath("/catalogue");
  return { ok: true };
}

/** Inline bulk pricing save — body is JSON [{id, mrp, elume_price}]. */
export async function bulkUpdatePricing(edits: { id: string; mrp: number; elume_price: number }[]): Promise<ActionResult> {
  if (!(await isAdmin())) return { ok: false, error: "Not signed in." };
  const db = adminClient();
  if (!db) return { ok: false, error: "Service-role key missing — writes disabled." };
  const clean = edits.filter((e) => e.id && Number.isFinite(e.mrp) && Number.isFinite(e.elume_price) && e.mrp > 0 && e.elume_price > 0);
  if (clean.length === 0) return { ok: false, error: "No valid rows to save." };
  for (const e of clean) {
    const { error } = await db.from("products").update({ mrp: e.mrp, elume_price: e.elume_price }).eq("id", e.id);
    if (error) return { ok: false, error: `${e.id}: ${error.message}` };
    await logPrice(db, e.id, e.elume_price, e.mrp);
  }
  revalidatePath("/admin/products");
  revalidatePath("/catalogue");
  return { ok: true };
}

/** Parse + diff an uploaded CSV against the live catalogue (no writes). */
export async function previewImport(csvText: string) {
  if (!(await isAdmin())) return { diffs: [], errors: ["Not signed in."] };
  const { listProductRows } = await import("@/lib/admin/data");
  const { diffFromCsv } = await import("@/lib/admin/import");
  const existing = await listProductRows();
  return diffFromCsv(csvText, existing);
}

/** Apply a parsed CSV import (add/update/remove) in one go, then log it. The
 *  parsed `diffs` come from lib/admin/import.ts and are re-validated here. */
export async function applyImport(
  diffs: {
    action: "add" | "update" | "remove";
    id: string;
    summary: string;
    payload: Record<string, unknown> | null;
  }[],
  filename: string
): Promise<ActionResult & { applied?: number }> {
  if (!(await isAdmin())) return { ok: false, error: "Not signed in." };
  const db = adminClient();
  if (!db) return { ok: false, error: "Service-role key missing — writes disabled." };
  if (!diffs.length) return { ok: false, error: "Nothing to apply." };

  let added = 0, updated = 0, removed = 0;
  for (const d of diffs) {
    if (d.action === "remove") {
      const { error } = await db.from("products").delete().eq("id", d.id);
      if (error) return { ok: false, error: `Remove ${d.id}: ${error.message}` };
      removed++;
    } else if (d.payload) {
      const { error } = await db.from("products").upsert(d.payload);
      if (error) return { ok: false, error: `${d.action} ${d.id}: ${error.message}` };
      if (d.action === "add") added++; else updated++;
    }
  }

  // Change log (best-effort — never blocks the import if the table is absent).
  try {
    await db.from("import_log").insert({
      actor: "admin",
      filename,
      added,
      updated,
      removed,
      summary: diffs.map((d) => `[${d.action}] ${d.summary}`).slice(0, 500),
    });
  } catch { /* import_log table not created yet — ignore */ }

  revalidatePath("/admin/products");
  revalidatePath("/admin/products/import");
  revalidatePath("/catalogue");
  return { ok: true, applied: added + updated + removed };
}

export async function deleteProduct(formData: FormData): Promise<void> {
  if (!(await isAdmin())) redirect("/admin/login");
  const db = adminClient();
  if (!db) redirect("/admin/products?error=service-role-missing");
  const id = String(formData.get("id") ?? "");
  const { error } = await db.from("products").delete().eq("id", id);
  if (error) redirect(`/admin/products?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/admin/products");
  revalidatePath("/catalogue");
  redirect("/admin/products?ok=deleted");
}

/* ── Competitor price radar (multi-source) ── */

/** Proxy a competitor's catalogue search for the admin's match picker. */
export async function searchCompetitorAction(source: string, query: string) {
  if (!(await isAdmin())) return [];
  const { getAdapter } = await import("@/lib/competitors");
  const adapter = getAdapter(source);
  if (!adapter) return [];
  return adapter.search(query);
}

/** Create/update the mapping for one of our products, for a given source. */
export async function saveCompetitorMap(input: { product_id: string; source: string; competitor_code: string; competitor_url?: string | null; unit_factor: number; note?: string }): Promise<ActionResult> {
  if (!(await isAdmin())) return { ok: false, error: "Not signed in." };
  const db = adminClient();
  if (!db) return { ok: false, error: "Service-role key missing — writes disabled." };
  if (!input.product_id || !input.source || !input.competitor_code) return { ok: false, error: "Product, source and competitor code are required." };
  const factor = Number(input.unit_factor);
  const { error } = await db.from("competitor_map").upsert({
    product_id: input.product_id,
    source: input.source,
    competitor_code: input.competitor_code.trim(),
    competitor_url: input.competitor_url?.trim() || null,
    unit_factor: Number.isFinite(factor) && factor > 0 ? factor : 1,
    note: input.note?.trim() || null,
    updated_at: new Date().toISOString(),
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/radar");
  return { ok: true };
}

export async function removeCompetitorMap(productId: string, source: string): Promise<ActionResult> {
  if (!(await isAdmin())) return { ok: false, error: "Not signed in." };
  const db = adminClient();
  if (!db) return { ok: false, error: "Service-role key missing." };
  await db.from("competitor_map").delete().eq("product_id", productId).eq("source", source);
  await db.from("competitor_prices").delete().eq("product_id", productId).eq("source", source);
  revalidatePath("/admin/radar");
  return { ok: true };
}

/** Accept a suggestion → set the Elume price to the ₹1-under target. */
export async function acceptSuggestion(productId: string, source: string): Promise<ActionResult> {
  if (!(await isAdmin())) return { ok: false, error: "Not signed in." };
  const db = adminClient();
  if (!db) return { ok: false, error: "Service-role key missing — writes disabled." };
  const { data: row } = await db.from("competitor_prices").select("suggested_price").eq("product_id", productId).eq("source", source).maybeSingle();
  const suggested = row?.suggested_price;
  if (suggested == null) return { ok: false, error: "No suggestion to apply." };
  const { error } = await db.from("products").update({ elume_price: suggested }).eq("id", productId);
  if (error) return { ok: false, error: error.message };
  await db.from("competitor_prices").update({ status: "accepted", our_price: suggested }).eq("product_id", productId).eq("source", source);
  revalidatePath("/admin/radar");
  revalidatePath("/admin/products");
  revalidatePath("/catalogue");
  return { ok: true };
}

export async function dismissSuggestion(productId: string, source: string): Promise<ActionResult> {
  if (!(await isAdmin())) return { ok: false, error: "Not signed in." };
  const db = adminClient();
  if (!db) return { ok: false, error: "Service-role key missing." };
  await db.from("competitor_prices").update({ status: "dismissed" }).eq("product_id", productId).eq("source", source);
  revalidatePath("/admin/radar");
  return { ok: true };
}

/** Save a repricing rule (global or per-category). */
export async function saveRepricingRule(input: {
  scope: string;
  basis: "market_avg" | "cheapest";
  delta: number;
  delta_type: "rupees" | "percent";
  max_change_pct: number;
  never_above_mrp: boolean;
  enabled: boolean;
}): Promise<ActionResult> {
  if (!(await isAdmin())) return { ok: false, error: "Not signed in." };
  const db = adminClient();
  if (!db) return { ok: false, error: "Service-role key missing — writes disabled." };
  const { error } = await db.from("repricing_settings").upsert({
    scope: input.scope.trim() || "global",
    basis: input.basis,
    delta: Number(input.delta) || 0,
    delta_type: input.delta_type,
    max_change_pct: Number(input.max_change_pct) || 0,
    never_above_mrp: input.never_above_mrp,
    enabled: input.enabled,
    updated_at: new Date().toISOString(),
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/radar");
  return { ok: true };
}

export async function deleteRepricingRule(scope: string): Promise<ActionResult> {
  if (!(await isAdmin())) return { ok: false, error: "Not signed in." };
  const db = adminClient();
  if (!db) return { ok: false, error: "Service-role key missing." };
  if (scope === "global") return { ok: false, error: "The global rule can't be deleted." };
  await db.from("repricing_settings").delete().eq("scope", scope);
  revalidatePath("/admin/radar");
  return { ok: true };
}

/** Apply a rule-recommended price to a product. Re-validates the guardrails
 *  server-side (never above MRP) so a stale client can't push a bad price. */
export async function applyRecommendedPrice(productId: string, target: number): Promise<ActionResult> {
  if (!(await isAdmin())) return { ok: false, error: "Not signed in." };
  const db = adminClient();
  if (!db) return { ok: false, error: "Service-role key missing — writes disabled." };
  if (!(target > 0)) return { ok: false, error: "Invalid price." };
  const { data: prod } = await db.from("products").select("mrp, category").eq("id", productId).maybeSingle();
  if (!prod) return { ok: false, error: "Product not found." };
  const { listRepricingRules } = await import("@/lib/admin/data");
  const { resolveRule } = await import("@/lib/admin/repricing");
  const rule = resolveRule(prod.category, await listRepricingRules());
  if (rule.never_above_mrp && Number(prod.mrp) > 0 && target > Number(prod.mrp)) {
    return { ok: false, error: `Blocked: ₹${target} is above MRP ₹${prod.mrp}.` };
  }
  const { error } = await db.from("products").update({ elume_price: target }).eq("id", productId);
  if (error) return { ok: false, error: error.message };
  await logPrice(db, productId, target, Number(prod.mrp));
  await db.from("competitor_prices").update({ status: "accepted", our_price: target }).eq("product_id", productId);
  revalidatePath("/admin/radar");
  revalidatePath("/admin/products");
  revalidatePath("/catalogue");
  return { ok: true };
}

/** Run the sync for one source now (same core the monthly GitHub Action uses). */
export async function syncCompetitorNow(source: string): Promise<ActionResult & { result?: { mapped: number; fetched: number; failed: number; suggestions: number } }> {
  if (!(await isAdmin())) return { ok: false, error: "Not signed in." };
  const db = adminClient();
  if (!db) return { ok: false, error: "Service-role key missing — writes disabled." };
  const { runCompetitorSync } = await import("@/lib/admin/competitor-sync");
  try {
    const result = await runCompetitorSync(db, source, "manual");
    revalidatePath("/admin/radar");
    return { ok: true, result };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Sync failed." };
  }
}

/* ── Content (JSON blobs) ── */
export async function updateContent(formData: FormData): Promise<void> {
  if (!(await isAdmin())) redirect("/admin/login");
  const db = adminClient();
  if (!db) redirect("/admin/content?error=service-role-missing");
  const key = String(formData.get("key") ?? "");
  const raw = String(formData.get("data") ?? "");
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    redirect(`/admin/content?error=${encodeURIComponent(`Invalid JSON for "${key}"`)}`);
  }
  const { error } = await db.from("content").update({ data }).eq("key", key);
  if (error) redirect(`/admin/content?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/admin/content");
  revalidatePath("/");
  revalidatePath("/app");
  redirect(`/admin/content?ok=${encodeURIComponent(key)}`);
}
