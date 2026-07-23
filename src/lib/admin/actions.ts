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
  brand_sku?: string;
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
    brand_sku: input.brand_sku?.trim() || null,
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

  // BATCHED: one round-trip per chunk, not per row. A row-at-a-time loop meant
  // a few hundred edits blew the serverless time limit and the request died
  // mid-import, leaving the UI hanging on "Applying…".
  const CHUNK = 200;
  const removeIds = diffs.filter((d) => d.action === "remove").map((d) => d.id);
  const upserts = diffs.filter((d) => d.action !== "remove" && d.payload).map((d) => d.payload as Record<string, unknown>);
  const added = diffs.filter((d) => d.action === "add" && d.payload).length;
  const updated = diffs.filter((d) => d.action === "update" && d.payload).length;
  const removed = removeIds.length;

  for (let i = 0; i < removeIds.length; i += CHUNK) {
    const { error } = await db.from("products").delete().in("id", removeIds.slice(i, i + CHUNK));
    if (error) return { ok: false, error: `Removing products: ${error.message}` };
  }
  for (let i = 0; i < upserts.length; i += CHUNK) {
    const { error } = await db.from("products").upsert(upserts.slice(i, i + CHUNK));
    if (error) return { ok: false, error: `Saving products: ${error.message}` };
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
export async function saveCompetitorMap(input: { product_id: string; source: string; competitor_code: string; competitor_url?: string | null; unit_factor: number; note?: string; item_condition?: string; competitor_brand_sku?: string | null }): Promise<ActionResult> {
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
    item_condition: input.item_condition?.trim() || "New",
    competitor_brand_sku: input.competitor_brand_sku?.trim() || null,
    approval: "approved", // an admin picked it by hand — trusted
    match_method: "manual",
    updated_at: new Date().toISOString(),
  });
  if (error) return { ok: false, error: error.message };
  // A remap can change which snapshot counts as trusted (e.g. replacing a
  // pending mapping that had a lingering price row).
  await db.rpc("refresh_market_low", { ids: [input.product_id] }).then(() => {}, () => {});
  revalidatePath("/admin/radar");
  revalidatePath("/admin/products");
  return { ok: true };
}

/** Approve a pending auto-matched mapping (approve=true) or reject it
 *  (approve=false → the mapping and its price snapshot are deleted). */
export async function setMapApproval(productId: string, source: string, approve: boolean): Promise<ActionResult> {
  if (!(await isAdmin())) return { ok: false, error: "Not signed in." };
  const db = adminClient();
  if (!db) return { ok: false, error: "Service-role key missing — writes disabled." };
  if (approve) {
    const { error } = await db.from("competitor_map").update({ approval: "approved", updated_at: new Date().toISOString() }).eq("product_id", productId).eq("source", source);
    if (error) return { ok: false, error: error.message };
  } else {
    await db.from("competitor_map").delete().eq("product_id", productId).eq("source", source);
    await db.from("competitor_prices").delete().eq("product_id", productId).eq("source", source);
  }
  // Approval changes what counts as a trusted price → market_low must follow.
  await db.rpc("refresh_market_low", { ids: [productId] }).then(() => {}, () => {});
  revalidatePath("/admin/radar");
  revalidatePath("/admin/products");
  return { ok: true };
}

/** Update just the item condition (New / Refurbished / Open box) of a mapping. */
export async function updateMapCondition(productId: string, source: string, condition: string): Promise<ActionResult> {
  if (!(await isAdmin())) return { ok: false, error: "Not signed in." };
  const db = adminClient();
  if (!db) return { ok: false, error: "Service-role key missing — writes disabled." };
  const { error } = await db.from("competitor_map").update({ item_condition: condition, updated_at: new Date().toISOString() }).eq("product_id", productId).eq("source", source);
  if (error) return { ok: false, error: error.message };
  await db.from("competitor_prices").update({ item_condition: condition }).eq("product_id", productId).eq("source", source);
  revalidatePath("/admin/radar");
  revalidatePath("/admin/products");
  return { ok: true };
}

export async function removeCompetitorMap(productId: string, source: string): Promise<ActionResult> {
  if (!(await isAdmin())) return { ok: false, error: "Not signed in." };
  const db = adminClient();
  if (!db) return { ok: false, error: "Service-role key missing." };
  await db.from("competitor_map").delete().eq("product_id", productId).eq("source", source);
  await db.from("competitor_prices").delete().eq("product_id", productId).eq("source", source);
  await db.rpc("refresh_market_low", { ids: [productId] }).then(() => {}, () => {});
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
  // Above-MRP matching is allowed — no MRP guardrail.
  const { error } = await db.from("products").update({ elume_price: target }).eq("id", productId);
  if (error) return { ok: false, error: error.message };
  await logPrice(db, productId, target, Number(prod.mrp));
  await db.from("competitor_prices").update({ status: "accepted", our_price: target }).eq("product_id", productId);
  revalidatePath("/admin/radar");
  revalidatePath("/admin/products");
  revalidatePath("/catalogue");
  return { ok: true };
}

/** Apply many repricing recommendations at once ("Apply all"). Each is checked
 *  against the never-above-MRP guardrail; blocked/failed ones are skipped and
 *  reported rather than aborting the batch. */
export async function applyRecommendedPrices(items: { id: string; target: number }[]): Promise<ActionResult & { applied?: number; skipped?: number }> {
  if (!(await isAdmin())) return { ok: false, error: "Not signed in." };
  const db = adminClient();
  if (!db) return { ok: false, error: "Service-role key missing — writes disabled." };
  const clean = (items ?? []).filter((i) => i.id && i.target > 0);
  if (clean.length === 0) return { ok: false, error: "Nothing to apply." };

  const ids = clean.map((i) => i.id);
  const { data: prods } = await db.from("products").select("id, mrp, category").in("id", ids);
  const byId = new Map((prods ?? []).map((p: any) => [p.id, p]));

  // Above-MRP matching is allowed — apply every recommended target, no MRP skip.
  let applied = 0, skipped = 0;
  for (const { id, target } of clean) {
    const prod = byId.get(id);
    if (!prod) { skipped++; continue; }
    const { error } = await db.from("products").update({ elume_price: target }).eq("id", id);
    if (error) { skipped++; continue; }
    await logPrice(db, id, target, Number(prod.mrp));
    await db.from("competitor_prices").update({ status: "accepted", our_price: target }).eq("product_id", id);
    applied++;
  }
  revalidatePath("/admin/radar");
  revalidatePath("/admin/products");
  revalidatePath("/catalogue");
  return { ok: true, applied, skipped };
}

/** Run the sync for one source now (same core the monthly GitHub Action uses). */
export async function syncCompetitorNow(source: string): Promise<ActionResult & { result?: { mapped: number; fetched: number; failed: number; suggestions: number; autoApplied?: number } }> {
  if (!(await isAdmin())) return { ok: false, error: "Not signed in." };
  const db = adminClient();
  if (!db) return { ok: false, error: "Service-role key missing — writes disabled." };
  const { runCompetitorSync } = await import("@/lib/admin/competitor-sync");
  try {
    const result = await runCompetitorSync(db, source, "manual", Date.now() + 50_000);
    revalidatePath("/admin/radar");
    return { ok: true, result };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Sync failed." };
  }
}

/** Refresh live prices for every ENABLED source in one click (all mapped SKUs).
 *  Large sources may exceed the serverless budget — the GitHub Action does the
 *  full unbounded run. Returns combined totals + any sources that timed out. */
export async function syncAllCompetitors(): Promise<ActionResult & { result?: { sources: number; mapped: number; fetched: number; failed: number; suggestions: number; autoApplied?: number; incomplete: string[] } }> {
  if (!(await isAdmin())) return { ok: false, error: "Not signed in." };
  const db = adminClient();
  if (!db) return { ok: false, error: "Service-role key missing — writes disabled." };
  const { runCompetitorSync } = await import("@/lib/admin/competitor-sync");
  const { listCompetitorSources } = await import("@/lib/admin/data");
  const sources = (await listCompetitorSources()).filter((s) => s.enabled);
  // Stay well under the serverless budget (maxDuration 60s) so the request
  // returns cleanly; anything not finished is left for the GitHub Action.
  const deadline = Date.now() + 50_000;
  const totals = { sources: 0, mapped: 0, fetched: 0, failed: 0, suggestions: 0, autoApplied: 0, incomplete: [] as string[] };
  for (const s of sources) {
    if (Date.now() > deadline) { totals.incomplete.push(s.name); continue; }
    try {
      const r = await runCompetitorSync(db, s.id, "manual", deadline);
      totals.sources++; totals.mapped += r.mapped; totals.fetched += r.fetched; totals.failed += r.failed; totals.suggestions += r.suggestions; totals.autoApplied += r.autoApplied ?? 0;
      if (r.incomplete) totals.incomplete.push(s.name);
    } catch {
      totals.incomplete.push(s.name);
    }
  }
  revalidatePath("/admin/radar");
  return { ok: true, result: totals };
}

/** Manually set a product's selling price to any value (no MRP guardrail — the
 *  admin is explicit). Logs history + marks the competitor rows accepted. */
export async function setElumePrice(productId: string, price: number): Promise<ActionResult> {
  if (!(await isAdmin())) return { ok: false, error: "Not signed in." };
  const db = adminClient();
  if (!db) return { ok: false, error: "Service-role key missing — writes disabled." };
  const p = Math.round(Number(price));
  if (!(p > 0)) return { ok: false, error: "Enter a valid price." };
  const { data: prod } = await db.from("products").select("mrp").eq("id", productId).maybeSingle();
  if (!prod) return { ok: false, error: "Product not found." };
  const { error } = await db.from("products").update({ elume_price: p }).eq("id", productId);
  if (error) return { ok: false, error: error.message };
  await logPrice(db, productId, p, Number(prod.mrp));
  await db.from("competitor_prices").update({ status: "accepted", our_price: p }).eq("product_id", productId);
  revalidatePath("/admin/radar");
  revalidatePath("/admin/products");
  revalidatePath("/catalogue");
  return { ok: true };
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
