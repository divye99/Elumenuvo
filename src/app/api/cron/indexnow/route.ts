import { NextResponse } from "next/server";
import sitemap from "@/app/sitemap";

/**
 * IndexNow submitter - weekly cron (see vercel.json).
 *
 * IndexNow instantly notifies Bing, Yandex, Seznam and Naver of our URLs
 * (Bing's index also feeds DuckDuckGo and several AI search products).
 * Google does NOT consume IndexNow - Google discovery stays sitemap +
 * Search Console.
 *
 * Key file: public/bd9036705f957a5e3c43484bbfb1973b.txt (protocol requires
 * the key to be retrievable at the site root). Submits the full sitemap URL
 * list, capped at IndexNow's 10,000-URLs-per-POST limit.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const KEY = "bd9036705f957a5e3c43484bbfb1973b";
const HOST = "elumenuvo.com";

export async function GET(request: Request) {
  const auth = request.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const entries = await sitemap();
  const urlList = entries.map((e) => e.url).slice(0, 10_000);

  const res = await fetch("https://api.indexnow.org/indexnow", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ host: HOST, key: KEY, keyLocation: `https://${HOST}/${KEY}.txt`, urlList }),
  });

  // 200/202 = accepted; anything else is worth surfacing in logs.
  const ok = res.status === 200 || res.status === 202;
  if (!ok) console.error("[indexnow]", res.status, await res.text().catch(() => ""));
  return NextResponse.json({ ok, status: res.status, submitted: urlList.length });
}
