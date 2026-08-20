#!/usr/bin/env node
import { mkdirSync } from "node:fs";
import { chromium } from "playwright";

const url =
  process.argv[2] ||
  "http://127.0.0.1:8080/workspace?q=golden%20gate%20bridge%20from%20popsicle%20sticks&local=1";
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
await page.locator("[data-yard-deck='1']").waitFor({ timeout: 20000 });
await page.locator("[data-yard-building]").waitFor({ state: "detached", timeout: 15000 }).catch(() => {});
await page.waitForTimeout(600);

const stats = async () =>
  page.locator("[data-yard-pieces]").evaluate((el) => ({
    pieces: el.getAttribute("data-yard-pieces"),
    kind: el.getAttribute("data-yard-kind"),
    mode: el.getAttribute("data-yard-mode"),
    detail: el.getAttribute("data-yard-detail"),
    traverse: el.getAttribute("data-yard-traverse"),
    load: el.getAttribute("data-yard-load"),
    deck: el.getAttribute("data-yard-deck"),
  }));

await page.screenshot({ path: "/workspace/screenshots/gg-full.png" });
const full = await stats();

await page.getByRole("button", { name: "Frame", exact: true }).click();
await page.waitForTimeout(400);
await page.screenshot({ path: "/workspace/screenshots/gg-frame.png" });
const frame = await stats();

await page.getByRole("button", { name: "Full", exact: true }).click();
await page.getByRole("button", { name: "Walk", exact: true }).click();
await page.waitForTimeout(500);
await page.screenshot({ path: "/workspace/screenshots/gg-walk.png" });
const walk = await stats();

const probeReady = await page.waitForFunction(() => Boolean(window.__controlsTest), null, { timeout: 5000 });
const before = await page.evaluate(() => {
  const t = window.__controlsTest;
  return { yaw: t.getYaw(), pos: t.getPosition(), speed: t.getSpeed() };
});
await page.evaluate(() => window.__controlsTest.setKeys(["KeyW"]));
await page.waitForTimeout(450);
const afterW = await page.evaluate(() => {
  const t = window.__controlsTest;
  return { yaw: t.getYaw(), pos: t.getPosition(), speed: t.getSpeed() };
});
await page.evaluate(() => window.__controlsTest.setKeys([]));
await page.waitForTimeout(80);
await page.evaluate(() => window.__controlsTest.setKeys(["KeyA"]));
await page.waitForTimeout(450);
const afterA = await page.evaluate(() => {
  const t = window.__controlsTest;
  return { yaw: t.getYaw(), pos: t.getPosition(), speed: t.getSpeed() };
});
await page.evaluate(() => window.__controlsTest.setKeys(["KeyD"]));
await page.waitForTimeout(450);
const afterD = await page.evaluate(() => {
  const t = window.__controlsTest;
  return { yaw: t.getYaw(), pos: t.getPosition(), speed: t.getSpeed() };
});
await page.evaluate(() => window.__controlsTest.setKeys([]));
await page.screenshot({ path: "/workspace/screenshots/gg-walk-moved.png" });

await page.getByRole("button", { name: "Look", exact: true }).click();
await page.getByRole("button", { name: "Load", exact: true }).click();
await page.waitForTimeout(300);
await page.screenshot({ path: "/workspace/screenshots/gg-load.png" });
const loadText = await page.locator("[data-yard-load-panel]").innerText().catch(() => "");

const wDx = afterW.pos.x - before.pos.x;
const aDz = afterA.pos.z - afterW.pos.z;
const dDz = afterD.pos.z - afterA.pos.z;
const signs = {
  wForwardX: wDx,
  aStrafeLeftZ: aDz,
  dStrafeRightZ: dDz,
  ok: wDx > 0.4 && aDz < -0.25 && dDz > 0.25,
};

await page.getByRole("button", { name: "Build plan" }).click();
await page.waitForTimeout(400);
await page.screenshot({ path: "/workspace/screenshots/gg-plan.png" });

const verdict = {
  full,
  frame,
  walk,
  loadText,
  before,
  afterW,
  afterA,
  afterD,
  signs,
  probeReady: Boolean(probeReady),
  consoleErrors,
  pageErrors,
};
console.log(JSON.stringify(verdict, null, 2));
await browser.close();
if (pageErrors.length || consoleErrors.length) process.exit(2);
if (!signs.ok) process.exit(3);
if (full.deck !== "1" || full.traverse !== "deck" || full.load !== "display") process.exit(4);
if (frame.detail !== "frame" || walk.mode !== "walk") process.exit(5);
process.exit(0);
