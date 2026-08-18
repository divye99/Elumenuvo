import { NextResponse } from "next/server";
import sitemap from "@/app/sitemap";
import { submitIndexNow } from "@/lib/indexnow";

/**
 * Weekly IndexNow safety net (Mon, see vercel.json): submits the full
 * sitemap so anything the event-driven pings missed (admin write paths call
 * submitIndexNow directly) still reaches Bing/Yandex/Naver within a week.
 * Google does not consume IndexNow; Google discovery stays sitemap + GSC.
 * Key, host and endpoint all live in lib/indexnow.ts - one implementation.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  const auth = request.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const entries = await sitemap();
  const urls = entries.map((e) => e.url);
  await submitIndexNow(urls);
  return NextResponse.json({ ok: true, submitted: urls.length });
}
