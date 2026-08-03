import { NextResponse } from "next/server";
import { latestReadings } from "@/lib/metals-market";
import { sendMetalsPriceReminder } from "@/lib/email";

/**
 * Thrice-daily copper price-update reminder → info@ (9am / 11am / 2pm IST).
 *
 * Vercel Hobby crons are daily-max, so this is hit by GitHub Actions
 * (.github/workflows/metals-price-reminders.yml) at 03:30 / 05:30 / 08:30 UTC
 * Mon-Sat. The email carries the latest internal MCX + LME readings and
 * deep-links to /admin/metals. Requires RESEND_API_KEY in the runtime
 * (send() no-ops gracefully without it).
 *
 * Auth: `Authorization: Bearer $CRON_SECRET`.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/** Label the slot from the current IST time (nearest of 9:00 / 11:00 / 14:00),
 *  so a manually-triggered run still reads sensibly. */
function slotLabel(): string {
  const ist = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: false })
    .format(new Date());
  const [h, m] = ist.split(":").map(Number);
  const mins = h * 60 + m;
  const slots: [number, string][] = [[9 * 60, "9:00 am"], [11 * 60, "11:00 am"], [14 * 60, "2:00 pm"]];
  slots.sort((a, b) => Math.abs(a[0] - mins) - Math.abs(b[0] - mins));
  return slots[0][1];
}

export async function GET(request: Request) {
  const secret = (process.env.CRON_SECRET || "").trim();
  const auth = request.headers.get("authorization") ?? "";
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { mcx, lme } = await latestReadings();
  const slot = slotLabel();
  const sent = await sendMetalsPriceReminder(slot, {
    mcx: mcx ? { price: mcx.price, change: mcx.change, changePct: mcx.changePct, ts: mcx.ts } : null,
    lme: lme ? { price: lme.price, change: lme.change, changePct: lme.changePct, ts: lme.ts } : null,
  });

  console.log(`[metals-reminder] slot=${slot} sent=${sent.ok}${sent.skipped ? " (skipped: no RESEND_API_KEY)" : ""}`);
  return NextResponse.json({ ok: true, slot, sent });
}
