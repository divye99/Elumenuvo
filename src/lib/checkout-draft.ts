/**
 * Checkout draft - what the shopper has typed, kept in localStorage so leaving
 * the page never costs them the form.
 *
 * The case this exists for: someone fills the whole delivery address as a
 * guest, clicks "Sign in" from inside checkout, and comes back to an empty
 * form. Traced sessions showed people retyping a full site address three times
 * before giving up at the payment window.
 *
 * Identity fields (name/email/phone/gstin) are deliberately NOT restored over
 * a signed-in prefill: once there is an account, the account is authoritative.
 * The address blocks always win, because that is the expensive typing.
 */

const KEY = "elume.checkout.draft";
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // a fortnight-old address is stale

export type CheckoutDraft = {
  name: string; email: string; phone: string; iso: string;
  gstin: string; wantGst: boolean; sameAsBilling: boolean;
  billing: Record<string, string>;
  shipping: Record<string, string>;
};

type Stored = { at: number; draft: CheckoutDraft };

export function saveCheckoutDraft(draft: CheckoutDraft): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ at: Date.now(), draft } satisfies Stored));
  } catch { /* private mode or quota: the form still works, just not resumable */ }
}

export function readCheckoutDraft(): CheckoutDraft | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Stored;
    if (!parsed?.draft || typeof parsed.at !== "number") return null;
    if (Date.now() - parsed.at > MAX_AGE_MS) { clearCheckoutDraft(); return null; }
    return parsed.draft;
  } catch {
    return null;
  }
}

export function clearCheckoutDraft(): void {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}

/** True when an address block has anything worth restoring. */
export function hasAddress(a: Record<string, string> | undefined | null): boolean {
  return !!a && Object.values(a).some((v) => typeof v === "string" && v.trim() !== "" && v.trim() !== "India");
}
