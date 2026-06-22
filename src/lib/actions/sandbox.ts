"use server";

/**
 * Sandbox server actions — used by the marketing CTA ("Try the live demo") and
 * the in-app "Reset workspace" button. Provisioning is a mutation, so these are
 * POST-only server actions (never GET links — Next prefetch would trigger them).
 */
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  provisionSandbox,
  deleteSandbox,
} from "@/lib/services/sandboxProvisioning";
import {
  SANDBOX_COOKIE,
  makeSandboxToken,
  readSandboxToken,
} from "@/lib/sandbox/cookie";

async function setSandboxCookie(orgId: string, expiresAt: Date) {
  const store = await cookies();
  store.set(SANDBOX_COOKIE, makeSandboxToken(orgId, expiresAt.getTime()), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

/** Provision a fresh sandbox and drop the visitor into the app. */
export async function startTrial() {
  const { orgId, expiresAt } = await provisionSandbox();
  await setSandboxCookie(orgId, expiresAt);
  redirect("/app");
}

/** Wipe the current sandbox and hand back a clean copy. */
export async function resetSandbox() {
  const current = readSandboxToken((await cookies()).get(SANDBOX_COOKIE)?.value);
  if (current) await deleteSandbox(current);
  const { orgId, expiresAt } = await provisionSandbox();
  await setSandboxCookie(orgId, expiresAt);
  redirect("/app");
}
