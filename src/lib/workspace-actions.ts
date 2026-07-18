"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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
