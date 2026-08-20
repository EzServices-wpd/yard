#!/usr/bin/env node
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const url =
  process.argv[2] ||
  "http://127.0.0.1:8080/workspace?q=3%20ft%20popsicle%20stick%20pyramid&local=1";
mkdirSync("/workspace/screenshots", { recursive: true });

const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const consoleErrors = [];
const pageErrors = [];
page.on("console", (msg) => {
  if (msg.type() === "error") consoleErrors.push(msg.text());
});
page.on("pageerror", (err) => pageErrors.push(String(err?.message || err)));

await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
await page.locator("[data-yard-kind='pyramid']").waitFor({ timeout: 25000 });
await page.locator("[data-yard-building]").waitFor({ state: "detached", timeout: 15000 }).catch(() => {});
await page.waitForTimeout(800);

const stats = async () =>
  page.locator("[data-yard-pieces]").evaluate((el) => ({
    pieces: el.getAttribute("data-yard-pieces"),
    kind: el.getAttribute("data-yard-kind"),
    mode: el.getAttribute("data-yard-mode"),
    detail: el.getAttribute("data-yard-detail"),
    traverse: el.getAttribute("data-yard-traverse"),
    load: el.getAttribute("data-yard-load"),
  }));

await page.screenshot({ path: "/workspace/screenshots/pyr-full.png" });
const full = await stats();

await page.getByRole("button", { name: "Frame", exact: true }).click();
await page.waitForTimeout(400);
await page.screenshot({ path: "/workspace/screenshots/pyr-frame.png" });
const frame = await stats();

await page.getByRole("button", { name: "Full", exact: true }).click();
await page.waitForTimeout(200);
if (await page.getByRole("button", { name: "Walk", exact: true }).count()) {
  await page.getByRole("button", { name: "Walk", exact: true }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: "/workspace/screenshots/pyr-walk.png" });
  const walk = await stats();
  await page.waitForFunction(() => window.__controlsTest, null, { timeout: 5000 }).catch(() => {});
  const probeReady = await page.evaluate(() => Boolean(window.__controlsTest));
  let signs = null;
  if (probeReady) {
    await page.evaluate(() => window.__controlsTest?.setKeys?.(["KeyW"]));
    await page.waitForTimeout(400);
    const afterW = await page.evaluate(() => ({
      pos: window.__controlsTest?.getPosition?.(),
      yaw: window.__controlsTest?.getYaw?.(),
    }));
    await page.evaluate(() => window.__controlsTest?.setKeys?.(["KeyA"]));
    await page.waitForTimeout(400);
    const afterA = await page.evaluate(() => window.__controlsTest?.getPosition?.());
    await page.evaluate(() => window.__controlsTest?.setKeys?.(["KeyD"]));
    await page.waitForTimeout(400);
    const afterD = await page.evaluate(() => window.__controlsTest?.getPosition?.());
    await page.evaluate(() => window.__controlsTest?.setKeys?.([]));
    await page.waitForTimeout(200);
    await page.screenshot({ path: "/workspace/screenshots/pyr-walk-in.png" });
    signs = { afterW, afterA, afterD };
  }
  console.log(JSON.stringify({ full, frame, walk, signs, probeReady, consoleErrors, pageErrors }, null, 2));
} else {
  console.log(JSON.stringify({ full, frame, noWalk: true, consoleErrors, pageErrors }, null, 2));
}

await browser.close();
if (pageErrors.length || consoleErrors.length) process.exit(2);
