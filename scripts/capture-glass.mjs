import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";
import path from "node:path";

const OUT = path.resolve("screenshots");
mkdirSync(OUT, { recursive: true });

const CHROME =
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const URL = "http://localhost:3000";

const browser = await chromium.launch({
  executablePath: CHROME,
  channel: "chrome",
});
const page = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2, // retina-quality output
});

await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 60000 });
await page.getByText("Procure every site").first().waitFor({ timeout: 60000 });
// settle fonts + entrance animations
await page.waitForTimeout(1500);

// 1) Hero (nav + frosted search/chips + dark hero mockup)
await page.screenshot({ path: path.join(OUT, "01-hero.png") });
console.log("saved 01-hero.png");

// 2) Catalogue glass cards
await page.evaluate(() => {
  const el = document.getElementById("catalogue");
  const y = el.getBoundingClientRect().top + window.scrollY - 80;
  window.scrollTo({ top: y, behavior: "instant" });
});
await page.waitForTimeout(700);
await page.screenshot({ path: path.join(OUT, "02-catalogue.png") });
console.log("saved 02-catalogue.png");

// 3) Request-access modal (frosted scrim + glass panel)
await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
await page.waitForTimeout(300);
await page.evaluate(() => {
  const el = [...document.querySelectorAll("div")].find(
    (d) => d.children.length === 0 && d.textContent.trim() === "Request access"
  );
  el?.click();
});
await page.waitForTimeout(700);
await page.screenshot({ path: path.join(OUT, "03-modal.png") });
console.log("saved 03-modal.png");

// 4) Full-page (everything, one tall image)
await page.evaluate(() => {
  const x = [...document.querySelectorAll("div")].find(
    (d) => d.children.length === 0 && d.textContent.trim() === "×"
  );
  x?.click();
  window.scrollTo({ top: 0, behavior: "instant" });
});
await page.waitForTimeout(500);
await page.screenshot({ path: path.join(OUT, "04-full-page.png"), fullPage: true });
console.log("saved 04-full-page.png");

await browser.close();
console.log("done");
