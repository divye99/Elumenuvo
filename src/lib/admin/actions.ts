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

  const row = {
    id: String(formData.get("id") ?? "").trim(),
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
  };
  const { error } = await db.from("products").upsert(row);
  if (error) redirect(`/admin/products?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/admin/products");
  revalidatePath("/catalogue");
  redirect("/admin/products?ok=1");
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
