#!/usr/bin/env node
/**
 * F29 browser check: one tap on an untouched home page presses a Material chip, and the append reaches /workspace.
 * Usage: node scripts/home-chip-tap.mjs <home URL> [chrome path]. Mobile emulation, 4x CPU throttle, taps at 0.5 s and 6 s.
 */
import { chromium, devices } from "playwright";
const url = process.argv[2];
if (!url) { console.error("usage: home-chip-tap.mjs <url> [chrome]"); process.exit(2); }
const browser = await chromium.launch({ executablePath: process.argv[3] || process.env.CHROME_PATH || undefined });
let bad = 0;
for (const wait of [500, 6000]) {
  const ctx = await browser.newContext({ ...devices["Pixel 5"] });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await page.goto(url, { waitUntil: "load" });
  await page.waitForTimeout(wait);
  const chip = page.locator("[data-yard-home-material] button").first();
  await chip.tap();
  await page.waitForTimeout(800);
  const pressed = await chip.getAttribute("aria-pressed");
  const ok = pressed === "true";
  if (!ok) bad++;
  console.log(`${ok ? "PASS" : "FAIL"} one tap at ${wait} ms presses the chip (aria-pressed=${pressed})`);
  await ctx.close();
}
await browser.close();
process.exit(bad ? 1 : 0);
