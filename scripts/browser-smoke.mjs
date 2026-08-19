#!/usr/bin/env node
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { chromium } from "playwright";
import { checkedOutputPath, checkedUrl } from "./browser-guard.mjs";
import { computeBrandWarnings } from "./brand-check.mjs";

const url = checkedUrl(process.argv[2] || "http://127.0.0.1:8080/");
const outPng = checkedOutputPath(process.argv[3] || "/workspace/screenshots/app-builder-preview.png", ["/workspace"]);
const timeoutMs = Number(process.env.BROWSER_SMOKE_TIMEOUT_MS || 45000);
mkdirSync(dirname(outPng), { recursive: true });

const consoleErrors = [];
const pageErrors = [];
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] });

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on("console", (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text()); });
  page.on("pageerror", (err) => pageErrors.push(String(err?.message || err)));
  const resp = await page.goto(url, { waitUntil: "networkidle", timeout: timeoutMs });
  const status = resp?.status() ?? 0;
  await page.waitForTimeout(1000);
  const title = await page.title();
  const hasCanvas = (await page.locator("canvas").count()) > 0;
  const bodyTextLen = (await page.locator("body").innerText().catch(() => "")).trim().length;
  await page.screenshot({ path: outPng, fullPage: false });
  const brandWarnings = computeBrandWarnings({ hasCanvas });
  console.log(JSON.stringify({ url, status, title, hasCanvas, bodyTextLen, consoleErrors, pageErrors, brandWarnings, screenshot: outPng }, null, 2));
  for (const w of brandWarnings) console.error(w);
  if (status >= 400 || status === 0) process.exit(1);
  if (pageErrors.length || consoleErrors.length) process.exit(2);
  process.exit(0);
} catch (err) {
  console.error(JSON.stringify({ ok: false, url, error: String(err?.message || err) }, null, 2));
  process.exit(1);
} finally {
  await browser.close();
}
