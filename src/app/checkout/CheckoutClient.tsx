"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { readCheckoutDraft, saveCheckoutDraft, clearCheckoutDraft, hasAddress } from "@/lib/checkout-draft";
import { inspectGstin } from "@/lib/gstin";
import SavedPicker, { type PickerOption } from "@/app/checkout/SavedPicker";
import Link from "next/link";
import { GROTESK } from "@/lib/fonts";
import { fmt } from "@/lib/format";
import { unitPriceFor, baseExGst } from "@/lib/pricing";
import { COUNTRIES, DEFAULT_COUNTRY, countryByIso, maxDigits, nationalDigits, normalisePhoneE164, phoneError, toE164 } from "@/lib/phone";
import { useCart } from "@/lib/cart";
import { startOnlinePayment, confirmOnlinePayment } from "@/lib/order-actions";
import { identify } from "@/lib/analytics";
import { openRazorpay } from "@/lib/razorpay-checkout";
import { useRouter } from "next/navigation";
import { stashOrder } from "@/lib/gtag";
import { INDIA_STATES } from "@/lib/india";

type Prefill = { name: string; email: string; phone: string; gstin: string; company: string; isBusiness: boolean; signedIn: boolean };

/** A one-tap delivery choice: a workspace project (site) or an address saved
 *  automatically from a past paid order. Selecting one fills contact + address. */
export type SavedEntry = {
  kind: "project" | "address";
  id: string;
  label: string; // project name, or the address's first line
  sub: string;   // one-line address summary
  contact_name: string;
  phone: string; // E.164 or ""
  line1: string; line2: string; line3: string;
  city: string; district: string; state: string; pin: string; country: string;
  usedBilling?: boolean;  // has been a billing address before
  usedShipping?: boolean; // has received a delivery before (projects always count)
};

/** Split an E.164 number back into (iso, national digits) for the phone field. */
function splitE164(stored: string): { iso: string; national: string } | null {
  const digits = (stored ?? "").replace(/\D/g, "");
  if (!digits) return null;
  const byLongestDial = [...COUNTRIES].sort((a, b) => b.dial.length - a.dial.length);
  for (const c of byLongestDial) {
    if (digits.startsWith(c.dial) && digits.length > c.dial.length) {
      return { iso: c.iso, national: digits.slice(c.dial.length) };
    }
  }
  return { iso: DEFAULT_COUNTRY.iso, national: digits };
}

type Address = { line1: string; line2: string; line3: string; city: string; district: string; state: string; pin: string; country: string };
const emptyAddress = (): Address => ({ line1: "", line2: "", line3: "", city: "", district: "", state: "", pin: "", country: "India" });

/** One line for the order record: line1, line2, line3, City, District, State - PIN, Country. */
function composeAddress(a: Address): string {
  const statePin = [a.state, a.pin && `- ${a.pin}`].filter(Boolean).join(" ");
  return [a.line1, a.line2, a.line3, a.city, a.district, statePin, a.country].map((s) => s.trim()).filter(Boolean).join(", ");
}

/** First missing required field, or null when the address is complete. */
function addressError(a: Address, label: string): string | null {
  if (!a.line1.trim()) return `Please enter Address line 1 (${label}).`;
  if (!a.city.trim()) return `Please enter the city (${label}).`;
  if (!a.district.trim()) return `Please enter the district (${label}).`;
  if (!a.state) return `Please pick the state / union territory (${label}).`;
  if (!/^\d{6}$/.test(a.pin.trim())) return `Please enter a valid 6-digit PIN code (${label}).`;
  return null;
}

export default function CheckoutClient({
  prefill, onlineEnabled, saved = [], savedGstins = [], savedPhones = [],
}: {
  prefill: Prefill; onlineEnabled: boolean; saved?: SavedEntry[];
  savedGstins?: PickerOption[]; savedPhones?: PickerOption[];
}) {
  const { items, total, baseTotal, gstTotal, clear, ready } = useCart();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [code, setCode] = useState("");
  const [codeState, setCodeState] = useState<{ status: "idle" | "checking" | "ok" | "err"; percent?: number; msg?: string }>({ status: "idle" });
  const [err, setErr] = useState<string | null>(null);
  const errRef = useRef<HTMLDivElement>(null);

  // A validation error can be off-screen (the pay button is also in the sticky
  // summary), so always bring the message into view.
  useEffect(() => {
    if (err) errRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [err]);

  // Country is chosen explicitly rather than parsed out of free text: it is
  // what decides how many digits are valid, and India is the only place we
  // deliver to, so it leads.
  // A draft of whatever was typed last time this form was open. Restored below
  // once, on mount: reading localStorage during render would break hydration.
  const [iso, setIso] = useState(DEFAULT_COUNTRY.iso);
  const country = countryByIso(iso);

  const [f, setF] = useState({
    name: prefill.name, email: prefill.email, phone: prefill.phone,
    billing: emptyAddress(), shipping: emptyAddress(), sameAsBilling: true,
    gstin: prefill.gstin, wantGst: prefill.isBusiness || !!prefill.gstin,
  });

  /* ── Resume an interrupted checkout ──
     Signing in mid-checkout used to wipe the form. The address blocks always
     come back; identity fields only fill the gaps the prefill left, so a
     freshly created account never gets overwritten by the guest values that
     were typed before it existed. ── */
  const [resumed, setResumed] = useState(false);
  useEffect(() => {
    const d = readCheckoutDraft();
    if (!d) return;
    if (d.iso) setIso(d.iso);
    setF((p) => ({
      ...p,
      name: p.name || d.name || "",
      email: p.email || d.email || "",
      phone: p.phone || d.phone || "",
      gstin: p.gstin || d.gstin || "",
      wantGst: p.wantGst || !!d.wantGst,
      sameAsBilling: d.sameAsBilling ?? p.sameAsBilling,
      billing: hasAddress(d.billing) ? (d.billing as unknown as Address) : p.billing,
      shipping: hasAddress(d.shipping) ? (d.shipping as unknown as Address) : p.shipping,
    }));
    if (hasAddress(d.billing) || hasAddress(d.shipping)) setResumed(true);
  }, []);

  // Keep the draft current. Cheap enough to write on every keystroke, and it
  // has to survive a navigation that can happen at any moment.
  useEffect(() => {
    saveCheckoutDraft({
      name: f.name, email: f.email, phone: f.phone, iso,
      gstin: f.gstin, wantGst: f.wantGst, sameAsBilling: f.sameAsBilling,
      billing: f.billing as unknown as Record<string, string>,
      shipping: f.shipping as unknown as Record<string, string>,
    });
  }, [f, iso]);
  const set = (k: keyof typeof f, v: string | boolean) => setF((p) => ({ ...p, [k]: v }));
  const setAddr = (which: "billing" | "shipping", k: keyof Address, v: string) =>
    setF((p) => ({ ...p, [which]: { ...p[which], [k]: v } }));

  // Saved sites & addresses. The top picker drives the DELIVERY: with
  // "shipping same as billing" ticked it fills billing (billing IS the
  // delivery address then); unticked, it fills the shipping block and leaves
  // billing alone - so a developer bills the office and ships to the site.
  // Everything stays editable: a pick is a starting point, not a lock.
  const [savedSel, setSavedSel] = useState<string>("");
  const applySaved = (e: SavedEntry) => {
    setSavedSel(e.id);
    const ph = splitE164(e.phone);
    if (ph) setIso(ph.iso);
    const addr: Address = {
      line1: e.line1, line2: e.line2, line3: e.line3,
      city: e.city, district: e.district, state: e.state, pin: e.pin,
      country: e.country || "India",
    };
    setF((p) => ({
      ...p,
      name: e.contact_name || p.name,
      phone: ph?.national ?? p.phone,
      ...(p.sameAsBilling ? { billing: addr } : { shipping: addr }),
    }));
  };

  // The delivery picker offers projects + addresses that have received a
  // delivery; billing-only addresses (the office) live on the billing chips.
  const deliverySaved = saved.filter((e) => e.kind === "project" || e.usedShipping !== false);
  // Billing chips: addresses that have actually been billed to before.
  const billingSaved = saved.filter((e) => e.kind === "address" && e.usedBilling);
  const [billSel, setBillSel] = useState<string>("");
  const applyBilling = (e: SavedEntry) => {
    setBillSel(e.id);
    setF((p) => ({
      ...p,
      billing: {
        line1: e.line1, line2: e.line2, line3: e.line3,
        city: e.city, district: e.district, state: e.state, pin: e.pin,
        country: e.country || "India",
      },
    }));
  };

  const gst = useMemo(() => ({ base: baseTotal, tax: gstTotal }), [baseTotal, gstTotal]);

  // A GSTIN names its own state of registration in its first two digits, so a
  // valid one fills the billing state for free. Only fills a blank: a typed
  // state is never overwritten.
  const gstCheck = useMemo(() => inspectGstin(f.gstin), [f.gstin]);
  useEffect(() => {
    if (!gstCheck.valid || !gstCheck.state) return;
    // Only fill a value the state <select> actually offers. Three GST codes
    // have no counterpart in the list (the pre-merger "Daman and Diu", plus
    // the 97/99 administrative codes), and setting one would blank the field.
    if (!(INDIA_STATES as readonly string[]).includes(gstCheck.state)) return;
    setF((p) => (p.billing.state ? p : { ...p, billing: { ...p.billing, state: gstCheck.state! } }));
  }, [gstCheck.valid, gstCheck.state]);

  // Business account with a GSTIN already on file: invoice it automatically and
  // never ask again at checkout.
  const gstOnFile = prefill.isBusiness && !!prefill.gstin;

  const orderInput = () => ({
    name: f.name, email: f.email, phone: toE164(f.phone, country) ?? f.phone,
    billing_address: composeAddress(f.billing),
    shipping_address: composeAddress(f.sameAsBilling ? f.billing : f.shipping),
    gstin: gstOnFile ? prefill.gstin : f.wantGst ? f.gstin : undefined,
    payment_method: "online", // pay-on-delivery is retired; Razorpay only
    items: items.map((i) => ({ id: i.id, name: i.name, qty: i.qty, price: i.price, cat: i.cat })),
    discount_code: codeState.status === "ok" ? code.trim().toUpperCase() : undefined,
    // Structured billing + shipping ride along so each can be auto-saved
    // separately (flagged by use) once the order is PAID.
    address_details: {
      billing: { ...f.billing },
      shipping: { ...(f.sameAsBilling ? f.billing : f.shipping) },
    },
  });

  const applyCode = async () => {
    if (!code.trim()) return;
    if (!f.email.trim()) { setCodeState({ status: "err", msg: "Fill in your email first - codes can be tied to an email." }); return; }
    setCodeState({ status: "checking" });
    try {
      const r = await fetch("/api/discount/check", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: code.trim(), email: f.email.trim() }) });
      const d = await r.json();
      setCodeState(d.ok ? { status: "ok", percent: d.percent } : { status: "err", msg: d.error });
    } catch { setCodeState({ status: "err", msg: "Couldn't check the code - try again." }); }
  };
  const discount = codeState.status === "ok" ? Math.round(total * ((codeState.percent ?? 0) / 100) * 100) / 100 : 0;
  const payable = Math.round((total - discount) * 100) / 100;

  const submit = () =>
    start(async () => {
      setErr(null);

      // Client-side address checks before any server round-trip.
      const phoneErr = phoneError(f.phone, country);
      if (phoneErr) { setErr(phoneErr); return; }
      const billErr = addressError(f.billing, "billing address");
      if (billErr) { setErr(billErr); return; }
      if (!f.sameAsBilling) {
        const shipErr = addressError(f.shipping, "shipping address");
        if (shipErr) { setErr(shipErr); return; }
      }
      if (!gstOnFile && f.wantGst) {
        const g = inspectGstin(f.gstin);
        if (!g.valid) { setErr(`${g.error ?? "Please enter a valid 15-character GSTIN"}, or untick the GST invoice option.`); return; }
      }
      if (!onlineEnabled) { setErr("Online payment is being enabled - ordering opens as soon as Razorpay goes live."); return; }

      const input = orderInput();

      // Pay online: create a Razorpay order, open the modal, verify, then persist.
      const started = await startOnlinePayment(input);
      if (started.ok) identify(input.email, input.name);
      if (!started.ok) { setErr(started.error); return; }
      let payment;
      try {
        payment = await openRazorpay({
          keyId: started.keyId, amount: started.amount, razorpayOrderId: started.razorpayOrderId,
          name: started.name, email: started.email, phone: started.phone, orderId: started.orderId,
        });
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Payment window failed to open."); return;
      }
      if (!payment) { setErr("Payment cancelled - you weren't charged."); return; }

      // The order was already persisted (as awaiting_payment) in step 1, so the
      // confirm only verifies the signature and flips it to paid - the amount
      // and contents come from the server-side row, never from the browser.
      const res = await confirmOnlinePayment({
        orderId: started.orderId,
        razorpay_order_id: payment.razorpay_order_id,
        razorpay_payment_id: payment.razorpay_payment_id,
        razorpay_signature: payment.razorpay_signature,
      });
      if (res.ok) {
        // Hand the confirmation to /order-confirmed (the GA4 purchase URL).
        // The payload rides sessionStorage - order value and email never
        // touch the query string.
        stashOrder({
          orderId: res.orderId, total: res.total, email: f.email.trim(),
          signedIn: prefill.signedIn,
          items: items.map((i) => ({ id: i.id, name: i.name, qty: i.qty, price: i.price })),
        });
        clear();
        clearCheckoutDraft(); // paid: the draft has served its purpose
        router.replace(`/order-confirmed?order=${encodeURIComponent(res.orderId)}`);
      }
      else setErr(res.error);
    });

  // Only announce an empty cart once the stored cart has actually been read.
  // Before that, `items` is [] purely because state starts empty, and telling
  // someone mid-purchase that their cart is empty is alarming and wrong.
  if (!ready) {
    return <main style={{ maxWidth: 640, margin: "0 auto", padding: "48px 28px", textAlign: "center", color: "#8A93A6", fontSize: 14 }}>Loading your cart…</main>;
  }
  if (items.length === 0) {
    return (
      <main style={{ maxWidth: 640, margin: "0 auto", padding: "48px 28px", textAlign: "center" }}>
        <p style={{ fontSize: 15, color: "#56627A" }}>Your cart is empty.</p>
        <Link href="/catalogue" style={{ color: "#4E5BDC", fontWeight: 600 }}>Browse the catalogue →</Link>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 1080, margin: "0 auto", padding: "28px 28px 56px" }}>
      <h1 style={{ fontFamily: GROTESK, fontSize: 28, fontWeight: 600, letterSpacing: "-0.6px", margin: "0 0 4px" }}>Checkout</h1>
      {!prefill.signedIn && (
        <p style={{ fontSize: 13, color: "#56627A", margin: "0 0 18px" }}>
          Checking out as a guest.{" "}
          {/* ?next brings them straight back here, and the draft above means
              the form is still filled when they arrive. */}
          <Link href="/signin?next=/checkout" style={{ color: "#4E5BDC", fontWeight: 600 }}>Sign in</Link>{" "}
          to save your details and track orders. Nothing you have typed will be lost.
        </p>
      )}
      {resumed && (
        <p style={{ fontSize: 13, color: "#137a4b", background: "#F2FBF6", border: "1px solid #DCEDE3", borderRadius: 9, padding: "9px 12px", margin: "0 0 16px" }}>
          We kept the address you entered earlier. Check it over before paying.
        </p>
      )}

      <div className="co-grid" style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 22, alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Saved sites & addresses: repeat buyers pick instead of retyping.
              Projects come from the workspace; addresses save themselves from
              past paid orders. */}
          {deliverySaved.length > 0 && (
            <Section title="Deliver to a saved site or address">
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {deliverySaved.map((e) => {
                  const on = savedSel === e.id;
                  return (
                    <div
                      key={e.id}
                      onClick={() => applySaved(e)}
                      style={{ display: "flex", gap: 11, alignItems: "flex-start", border: `1.5px solid ${on ? "#4E5BDC" : "#E0E4ED"}`, background: on ? "#F7F8FF" : "#fff", borderRadius: 11, padding: "11px 13px", cursor: "pointer" }}
                    >
                      <span style={{ marginTop: 2, width: 15, height: 15, flex: "none", borderRadius: "50%", border: `1.5px solid ${on ? "#4E5BDC" : "#C7CCDA"}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {on && <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#4E5BDC" }} />}
                      </span>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#19202E", display: "flex", gap: 7, alignItems: "baseline", flexWrap: "wrap" }}>
                          {e.label}
                          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.4px", textTransform: "uppercase", color: e.kind === "project" ? "#4E5BDC" : "#1F9D63", background: e.kind === "project" ? "#EEF0FD" : "#E6F5EE", padding: "1.5px 7px", borderRadius: 7 }}>
                            {e.kind === "project" ? "Project" : "Saved address"}
                          </span>
                        </div>
                        <div style={{ fontSize: 12, color: "#56627A", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis" }}>
                          {[e.contact_name, e.sub].filter(Boolean).join(" · ")}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {savedSel && (
                  <div onClick={() => setSavedSel("")} style={{ fontSize: 12.5, color: "#4E5BDC", fontWeight: 600, cursor: "pointer", padding: "2px 2px 0" }}>
                    Use a different address instead (edit the fields below)
                  </div>
                )}
              </div>
            </Section>
          )}

          {/* Contact */}
          <Section title="Contact">
            <Row>
              <Field label="Full name *"><input name="full_name" autoComplete="name" value={f.name} onChange={(e) => set("name", e.target.value)} style={inp} /></Field>
              <Field label="Phone *">
                {/* Saved numbers first: the site number and the accounts
                    number are rarely the same, and one traced session gave us
                    three different numbers with no way to tell them apart. */}
                {savedPhones.length > 0 && (
                  <div style={{ marginBottom: 9 }}>
                    <SavedPicker
                      options={savedPhones}
                      selected={toE164(f.phone, country) ?? ""}
                      onSelect={(v) => { const s = splitE164(v); if (s) { setIso(s.iso); set("phone", s.national); } }}
                      onAddNew={(v) => {
                        const e164 = normalisePhoneE164(v);
                        if (!e164) return "Please enter a valid mobile number.";
                        const s = splitE164(e164);
                        if (s) { setIso(s.iso); set("phone", s.national); }
                        return null;
                      }}
                      addLabel="Add a number"
                      placeholder="98765 43210"
                      inputMode="tel"
                    />
                  </div>
                )}
                <div style={{ display: "flex", gap: 6 }}>
                  <select
                    aria-label="Country dialling code"
                    value={iso}
                    onChange={(e) => { setIso(e.target.value); set("phone", nationalDigits(f.phone, countryByIso(e.target.value))); }}
                    style={{ ...inp, width: 104, flex: "0 0 auto", paddingRight: 4, cursor: "pointer" }}
                  >
                    {COUNTRIES.map((c) => (
                      <option key={c.iso} value={c.iso}>{c.iso} +{c.dial}</option>
                    ))}
                  </select>
                  <input
                    name="phone"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel-national"
                    /* Digits only, and never more than this country allows -
                       the field itself makes a wrong-length number impossible
                       to type, rather than only complaining at submit. */
                    maxLength={maxDigits(country)}
                    value={f.phone}
                    onChange={(e) => set("phone", e.target.value.replace(/\D/g, "").slice(0, maxDigits(country)))}
                    placeholder={country.example}
                    required
                    style={inp}
                  />
                </div>
              </Field>
            </Row>
            <Field label="Email *"><input name="email" type="email" autoComplete="email" value={f.email} onChange={(e) => set("email", e.target.value)} style={inp} /></Field>
          </Section>

          {/* Addresses */}
          <Section title="Billing address">
            {/* Addresses this account has billed to before - one tap fills
                just the billing block (delivery stays whatever was picked). */}
            {billingSaved.length > 0 && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {billingSaved.map((e) => {
                  const on = billSel === e.id;
                  return (
                    <span key={e.id} onClick={() => applyBilling(e)} title={e.sub}
                      style={{ fontSize: 12, fontWeight: 600, color: on ? "#fff" : "#3A4358", background: on ? "#4E5BDC" : "#F0F2F6", border: `1px solid ${on ? "#4E5BDC" : "#E0E4ED"}`, borderRadius: 8, padding: "6px 11px", cursor: "pointer", maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      🧾 {e.label}{e.city ? `, ${e.city}` : ""}
                    </span>
                  );
                })}
              </div>
            )}
            <AddressFields a={f.billing} onChange={(k, v) => { setBillSel(""); setAddr("billing", k, v); }} />
            <label style={ck}><input type="checkbox" checked={f.sameAsBilling} onChange={(e) => set("sameAsBilling", e.target.checked)} /> Shipping address same as billing</label>
          </Section>
          {!f.sameAsBilling && (
            <Section title="Shipping address">
              <AddressFields a={f.shipping} onChange={(k, v) => setAddr("shipping", k, v)} />
            </Section>
          )}

          {/* GST. Business accounts already gave us their GSTIN at sign-up, so we
              just confirm it - they're never asked again. Everyone else is offered it. */}
          {gstOnFile ? (
            <Section title="GST invoice">
              <div style={{ display: "flex", gap: 12, alignItems: "flex-start", background: "#E6F5EE", border: "1px solid #BEE7D2", borderRadius: 11, padding: "12px 14px" }}>
                <span style={{ fontSize: 17 }}>🧾</span>
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: "#166A44" }}>A GST invoice will be issued automatically</div>
                  <div style={{ fontSize: 12.5, color: "#3A4358", marginTop: 3 }}>
                    {prefill.company && <><b>{prefill.company}</b> · </>}
                    <span style={{ fontFamily: "var(--space-mono)" }}>{prefill.gstin}</span>
                  </div>
                  <div style={{ fontSize: 11.5, color: "#56627A", marginTop: 4 }}>
                    Input tax credit claimable. To change your GSTIN, update it in{" "}
                    <Link href="/app" style={{ color: "#4E5BDC", fontWeight: 600 }}>your account</Link>.
                  </div>
                </div>
              </div>
            </Section>
          ) : (
            <Section title="GST invoice (optional)">
              <label style={ck}><input type="checkbox" checked={f.wantGst} onChange={(e) => set("wantGst", e.target.checked)} /> I want a GST invoice</label>
              {f.wantGst && (
                <Field label="GSTIN *">
                  {/* A group can hold one registration per state, so this is a
                      pick-list, not a single value. Choosing one here is
                      independent of the address: a repeat order can change
                      either, both or neither. */}
                  {savedGstins.length > 0 ? (
                    <SavedPicker
                      options={savedGstins}
                      selected={f.gstin.trim().toUpperCase()}
                      onSelect={(v) => set("gstin", v)}
                      onAddNew={(v) => {
                        const c = inspectGstin(v);
                        if (!c.valid) return c.error ?? "That GSTIN does not look right.";
                        set("gstin", v.toUpperCase());
                        return null;
                      }}
                      addLabel="Add a GSTIN"
                      placeholder="27AAACE1234F1Z5"
                      mono
                      maxLength={15}
                    />
                  ) : (
                    <>
                      <input
                        value={f.gstin} onChange={(e) => set("gstin", e.target.value.toUpperCase())} maxLength={15}
                        placeholder="27AAACE1234F1Z5"
                        style={{ ...inp, fontFamily: "var(--space-mono)", borderColor: gstCheck.empty ? "#E0E4ED" : gstCheck.valid ? "#8FD3B0" : "#F0BBA8" }}
                      />
                      {/* Checked against the GSTIN's own check digit, so a typo
                          is caught before payment rather than on the invoice. */}
                      {!gstCheck.empty && (
                        <span style={{ display: "block", fontSize: 11.5, marginTop: 5, fontWeight: 600, color: gstCheck.valid ? "#1F9D63" : "#C2410C" }}>
                          {gstCheck.valid ? `✓ Valid · ${gstCheck.state}` : gstCheck.error}
                        </span>
                      )}
                    </>
                  )}
                </Field>
              )}
              {!prefill.signedIn && (
                <div style={{ fontSize: 11.5, color: "#8A93A6" }}>
                  Buying for a business?{" "}
                  <Link href="/business" style={{ color: "#4E5BDC", fontWeight: 600 }}>Open a business account</Link>{" "}
                  and we&apos;ll invoice your GSTIN automatically, every time.
                </div>
              )}
            </Section>
          )}

          {/* Payment: online only (pay-on-delivery is retired) */}
          <Section title="Payment">
            {onlineEnabled ? (
              <div style={{ ...payOpt, borderColor: "#4E5BDC", background: "#F7F8FF", cursor: "default" }}>
                <span style={{ fontSize: 18 }}>🔒</span>
                <span><b>Pay online</b><br /><span style={{ fontSize: 11.5, color: "#8A93A6" }}>UPI, cards &amp; netbanking · secure Razorpay checkout</span></span>
              </div>
            ) : (
              <div style={{ ...payOpt, borderColor: "#F0DFC0", background: "#FFF9EE", cursor: "default" }}>
                <span style={{ fontSize: 18 }}>🔒</span>
                <span>
                  <b style={{ color: "#8a6116" }}>Online payment is being enabled</b>
                  <br />
                  <span style={{ fontSize: 11.5, color: "#8A93A6" }}>UPI, cards &amp; netbanking via Razorpay go live shortly. Ordering is paused until then.</span>
                </span>
              </div>
            )}
          </Section>

          {/* Pay CTA at the natural end of the form, so nobody has to scroll
              back up to the summary after filling everything in. */}
          <div ref={errRef} style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 14, padding: "16px 18px" }}>
            {err && <div style={{ background: "#FBE9E4", color: "#9a3b16", fontSize: 13, fontWeight: 600, padding: "10px 12px", borderRadius: 9, marginBottom: 12 }}>{err}</div>}
            <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 11.5, color: "#8A93A6" }}>Total payable (incl. GST)</div>
                <div style={{ fontFamily: GROTESK, fontSize: 22, fontWeight: 700, lineHeight: 1.2 }}>{fmt(payable)}</div>
              </div>
              <button onClick={submit} disabled={pending || !onlineEnabled} title={onlineEnabled ? "" : "Online payment is being enabled - ordering opens shortly"} style={{ flex: 1, minWidth: 200, marginLeft: "auto", background: "#4E5BDC", color: "#fff", fontWeight: 700, fontSize: 15, border: "none", padding: 15, borderRadius: 11, cursor: pending || !onlineEnabled ? "default" : "pointer", opacity: pending || !onlineEnabled ? 0.6 : 1 }}>
                {pending ? "Opening payment…" : onlineEnabled ? `Pay securely · ${fmt(payable)}` : "Payments enabling soon"}
              </button>
            </div>
            <div style={{ fontSize: 11.5, color: "#8A93A6", marginTop: 10 }}>
              🔒 Secured by Razorpay · you stay on Elume · UPI, cards, net banking &amp; wallets
            </div>
          </div>
        </div>

        {/* Order summary (sticky beside the form on desktop) */}
        <div className="co-summary" style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 16, padding: "18px 20px", position: "sticky", top: 84 }}>
          <div style={{ fontFamily: GROTESK, fontWeight: 600, fontSize: 15, marginBottom: 12 }}>Order summary</div>
          {items.map((it) => (
            <div key={it.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12.5, marginBottom: 7 }}>
              <span style={{ color: "#56627A", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.qty}× {it.name}</span>
              <span style={{ fontFamily: GROTESK, fontWeight: 600 }}>{fmt(baseExGst(unitPriceFor(it.price, it.qty, it.cat), it.cat, it.gstRate) * it.qty)}</span>
            </div>
          ))}
          <div style={{ borderTop: "1px solid #F0F2F6", marginTop: 8, paddingTop: 10 }}>
            {/* Prices are quoted ex-GST, so always show the taxable value + GST. */}
            <SumRow label="Subtotal (excl. GST)" value={fmt(gst.base)} muted />
            <SumRow label="GST" value={fmt(gst.tax)} muted />
            <SumRow label="Delivery" value="Free" green />
            {discount > 0 && <SumRow label={`Discount (${codeState.percent}% · ${code.trim().toUpperCase()})`} value={`− ${fmt(discount)}`} green />}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 8 }}>
              <span style={{ fontWeight: 600, fontSize: 14 }}>Total <span style={{ fontSize: 11, color: "#8A93A6", fontWeight: 500 }}>incl. GST</span></span>
              <span style={{ fontFamily: GROTESK, fontSize: 22, fontWeight: 700 }}>{fmt(payable)}</span>
            </div>
          </div>
          {/* Discount code */}
          <div style={{ marginTop: 10 }}>
            <div style={{ display: "flex", gap: 7 }}>
              <input value={code} onChange={(e) => { setCode(e.target.value.toUpperCase()); setCodeState({ status: "idle" }); }} placeholder="Discount code" style={{ flex: 1, border: "1px solid #E0E4ED", borderRadius: 9, padding: "9px 11px", fontSize: 12.5, textTransform: "uppercase" }} />
              <button onClick={applyCode} disabled={codeState.status === "checking" || !code.trim()} style={{ border: "1.5px solid #4E5BDC", background: "#fff", color: "#4E5BDC", fontWeight: 700, fontSize: 12.5, borderRadius: 9, padding: "0 14px", cursor: "pointer", opacity: codeState.status === "checking" ? 0.6 : 1 }}>
                {codeState.status === "checking" ? "…" : codeState.status === "ok" ? "✓" : "Apply"}
              </button>
            </div>
            {codeState.status === "ok" && <div style={{ fontSize: 12, color: "#1F9D63", fontWeight: 600, marginTop: 5 }}>{codeState.percent}% off applied.</div>}
            {codeState.status === "err" && <div style={{ fontSize: 12, color: "#D14343", fontWeight: 600, marginTop: 5 }}>{codeState.msg}</div>}
          </div>
          <button onClick={submit} disabled={pending || !onlineEnabled} title={onlineEnabled ? "" : "Online payment is being enabled - ordering opens shortly"} style={{ width: "100%", marginTop: 14, background: "#4E5BDC", color: "#fff", fontWeight: 700, fontSize: 14.5, border: "none", padding: 13, borderRadius: 11, cursor: pending || !onlineEnabled ? "default" : "pointer", opacity: pending || !onlineEnabled ? 0.6 : 1 }}>
            {pending ? "Opening payment…" : onlineEnabled ? `Pay securely · ${fmt(payable)}` : "Payments enabling soon"}
          </button>
          <div style={{ fontSize: 11, color: "#A0A7B5", textAlign: "center", marginTop: 8 }}>🔒 Secured by Razorpay</div>
        </div>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #E8EBF1", borderRadius: 14, padding: "16px 18px" }}>
      <div style={{ fontFamily: GROTESK, fontWeight: 600, fontSize: 14, marginBottom: 12 }}>{title}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{children}</div>
    </div>
  );
}
function Row({ children }: { children: React.ReactNode }) { return <div className="co-row" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>{children}</div>; }

/** Structured Indian address: 3 lines, city/district, state dropdown, PIN, country (India). */
function AddressFields({ a, onChange }: { a: Address; onChange: (k: keyof Address, v: string) => void }) {
  return (
    <>
      <Field label="Address line 1 *"><input name="address_line1" autoComplete="address-line1" value={a.line1} onChange={(e) => onChange("line1", e.target.value)} placeholder="Flat / house no., building" style={inp} /></Field>
      <Field label="Address line 2"><input name="address_line2" autoComplete="address-line2" value={a.line2} onChange={(e) => onChange("line2", e.target.value)} placeholder="Street, area, locality" style={inp} /></Field>
      <Field label="Address line 3 (optional)"><input name="landmark" value={a.line3} onChange={(e) => onChange("line3", e.target.value)} placeholder="Landmark (optional)" style={inp} /></Field>
      <Row>
        <Field label="City *"><input name="city" autoComplete="address-level2" value={a.city} onChange={(e) => onChange("city", e.target.value)} style={inp} /></Field>
        <Field label="District *"><input name="district" value={a.district} onChange={(e) => onChange("district", e.target.value)} style={inp} /></Field>
      </Row>
      <Row>
        <Field label="State / Union territory *">
          <select value={a.state} onChange={(e) => onChange("state", e.target.value)} style={{ ...inp, background: "#fff" }}>
            <option value="">Select state / UT…</option>
            {INDIA_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="PIN code *"><input name="pincode" autoComplete="postal-code" value={a.pin} onChange={(e) => onChange("pin", e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" placeholder="110001" style={inp} /></Field>
      </Row>
      <Field label="Country"><input value={a.country} readOnly style={{ ...inp, background: "#F7F8FB", color: "#56627A" }} /></Field>
    </>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label style={{ fontSize: 11.5, fontWeight: 600, color: "#56627A", display: "block", marginBottom: 4 }}>{label}</label>{children}</div>;
}
function SumRow({ label, value, muted, green }: { label: string; value: string; muted?: boolean; green?: boolean }) {
  return <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 6, color: muted ? "#8A93A6" : "#56627A" }}><span>{label}</span><span style={{ fontFamily: "var(--space-grotesk)", color: green ? "#1F9D63" : "#19202E", fontWeight: 600 }}>{value}</span></div>;
}
const inp: React.CSSProperties = { width: "100%", boxSizing: "border-box", border: "1px solid #E0E4ED", borderRadius: 9, padding: "9px 11px", fontSize: 13.5, outline: "none", background: "#fff" };
const ck: React.CSSProperties = { display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#3A4358" };
const payOpt: React.CSSProperties = { display: "flex", alignItems: "flex-start", gap: 10, border: "1.5px solid #E8EBF1", borderRadius: 11, padding: "12px 13px", cursor: "pointer", fontSize: 13.5 };
