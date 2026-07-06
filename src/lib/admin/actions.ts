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
  revalidatePath("/admin/products");
  revalidatePath("/catalogue");
  redirect("/admin/products?ok=1");
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

/* ── Competitor price radar (Vashi) ── */

/** Proxy the Vashi OCC search for the admin's "find match" picker. */
export async function searchVashiAction(query: string) {
  if (!(await isAdmin())) return [];
  const { searchVashi } = await import("@/lib/admin/vashi");
  return searchVashi(query);
}

/** Create/update the Vashi mapping for one of our products. */
export async function saveCompetitorMap(input: { product_id: string; vashi_code: string; unit_factor: number; note?: string }): Promise<ActionResult> {
  if (!(await isAdmin())) return { ok: false, error: "Not signed in." };
  const db = adminClient();
  if (!db) return { ok: false, error: "Service-role key missing — writes disabled." };
  if (!input.product_id || !input.vashi_code) return { ok: false, error: "Product and Vashi code are required." };
  const factor = Number(input.unit_factor);
  const { error } = await db.from("competitor_map").upsert({
    product_id: input.product_id,
    vashi_code: input.vashi_code.trim(),
    unit_factor: Number.isFinite(factor) && factor > 0 ? factor : 1,
    note: input.note?.trim() || null,
    updated_at: new Date().toISOString(),
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/admin/radar");
  return { ok: true };
}

export async function removeCompetitorMap(productId: string): Promise<ActionResult> {
  if (!(await isAdmin())) return { ok: false, error: "Not signed in." };
  const db = adminClient();
  if (!db) return { ok: false, error: "Service-role key missing." };
  await db.from("competitor_map").delete().eq("product_id", productId);
  await db.from("competitor_prices").delete().eq("product_id", productId);
  revalidatePath("/admin/radar");
  return { ok: true };
}

/** Accept a suggestion → set the Elume price to the ₹1-under target. */
export async function acceptSuggestion(productId: string): Promise<ActionResult> {
  if (!(await isAdmin())) return { ok: false, error: "Not signed in." };
  const db = adminClient();
  if (!db) return { ok: false, error: "Service-role key missing — writes disabled." };
  const { data: row } = await db.from("competitor_prices").select("suggested_price").eq("product_id", productId).maybeSingle();
  const suggested = row?.suggested_price;
  if (suggested == null) return { ok: false, error: "No suggestion to apply." };
  const { error } = await db.from("products").update({ elume_price: suggested }).eq("id", productId);
  if (error) return { ok: false, error: error.message };
  await db.from("competitor_prices").update({ status: "accepted", our_price: suggested }).eq("product_id", productId);
  revalidatePath("/admin/radar");
  revalidatePath("/admin/products");
  revalidatePath("/catalogue");
  return { ok: true };
}

export async function dismissSuggestion(productId: string): Promise<ActionResult> {
  if (!(await isAdmin())) return { ok: false, error: "Not signed in." };
  const db = adminClient();
  if (!db) return { ok: false, error: "Service-role key missing." };
  await db.from("competitor_prices").update({ status: "dismissed" }).eq("product_id", productId);
  revalidatePath("/admin/radar");
  return { ok: true };
}

/** Run the whole sync now (same core the monthly GitHub Action uses). */
export async function syncCompetitorNow(): Promise<ActionResult & { result?: { mapped: number; fetched: number; failed: number; suggestions: number } }> {
  if (!(await isAdmin())) return { ok: false, error: "Not signed in." };
  const db = adminClient();
  if (!db) return { ok: false, error: "Service-role key missing — writes disabled." };
  const { runCompetitorSync } = await import("@/lib/admin/competitor-sync");
  try {
    const result = await runCompetitorSync(db, "manual");
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
