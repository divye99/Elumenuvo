"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_COUNTRY, phoneError, toE164 } from "@/lib/phone";

/** Owner-scoped project CRUD for the live buyer workspace. Runs under the
 *  user's own session, so RLS enforces ownership; no service role involved. */

export type WsResult = { ok: true } | { ok: false; error: string };

export async function createAppProject(name: string, site: string, stage: string): Promise<WsResult> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "Please sign in again." };
    const clean = name.trim().slice(0, 120);
    if (!clean) return { ok: false, error: "Give the project a name." };
    const st = ["Rough-in", "Wiring", "Panel & DB", "Finishing"].includes(stage) ? stage : "Rough-in";
    const { error } = await supabase.from("app_projects").insert({ user_id: user.id, name: clean, site: site.trim().slice(0, 160) || null, stage: st });
    if (error) return { ok: false, error: error.message };
    revalidatePath("/app");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not create the project." };
  }
}

export type ProjectDetailsInput = {
  id?: string; // present = update, absent = create
  name: string;
  stage: string;
  contact_name: string;
  contact_phone: string; // national digits, India (10 digits) - or empty
  line1: string; line2: string; line3: string;
  city: string; district: string; state: string; pin: string;
};

/** Create or update a project WITH its site contact + delivery address, so
 *  picking the project at checkout can fill every field. Owner-scoped by RLS. */
export async function saveAppProject(input: ProjectDetailsInput): Promise<WsResult> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "Please sign in again." };

    const name = input.name.trim().slice(0, 120);
    if (!name) return { ok: false, error: "Give the project a name." };
    const stage = ["Rough-in", "Wiring", "Panel & DB", "Finishing"].includes(input.stage) ? input.stage : "Rough-in";

    // Contact + address are optional as a block, but validated when given.
    let phone: string | null = null;
    if (input.contact_phone.trim()) {
      const err = phoneError(input.contact_phone, DEFAULT_COUNTRY);
      if (err) return { ok: false, error: err };
      phone = toE164(input.contact_phone, DEFAULT_COUNTRY);
    }
    if (input.pin.trim() && !/^\d{6}$/.test(input.pin.trim())) return { ok: false, error: "PIN code must be 6 digits." };

    const clip = (s: string, n = 160) => s.trim().slice(0, n) || null;
    const row = {
      name, stage,
      // `site` stays the one-line summary shown across the workspace.
      site: clip([input.line1, input.city, input.state].map((s) => s.trim()).filter(Boolean).join(", ")) ,
      contact_name: clip(input.contact_name, 120),
      contact_phone: phone,
      address_line1: clip(input.line1), address_line2: clip(input.line2), address_line3: clip(input.line3),
      city: clip(input.city, 80), district: clip(input.district, 80),
      state: clip(input.state, 60), pin: clip(input.pin, 6),
    };

    const { error } = input.id
      ? await supabase.from("app_projects").update(row).eq("id", input.id) // RLS scopes to owner
      : await supabase.from("app_projects").insert({ ...row, user_id: user.id });
    if (error) return { ok: false, error: error.message };
    revalidatePath("/app");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not save the project." };
  }
}

export async function deleteAppProject(id: string): Promise<WsResult> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from("app_projects").delete().eq("id", id); // RLS scopes to owner
    if (error) return { ok: false, error: error.message };
    revalidatePath("/app");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not delete the project." };
  }
}
