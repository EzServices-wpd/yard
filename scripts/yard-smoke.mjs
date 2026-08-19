import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const base = process.argv[2] || "http://127.0.0.1:8080";
await mkdir("/workspace/screenshots", { recursive: true });

const browser = await chromium.launch({
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--ignore-gpu-blocklist"],
});
const errors = [];

async function watch(page, label) {
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(`${label}: ${msg.text()}`);
  });
  page.on("pageerror", (err) => errors.push(`${label}: ${err.message}`));
}

const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await desktop.newPage();
await watch(page, "desktop");

await page.goto(base + "/", { waitUntil: "networkidle" });
const landOk = await page.evaluate(() => /Type it\. Buy the parts/.test(document.body.innerText));
console.log("LANDING", landOk);
await page.screenshot({ path: "/workspace/screenshots/yard-landing.png", fullPage: true });

await page.evaluate(() => localStorage.clear());
await page.goto(
  base + "/workspace?q=" + encodeURIComponent("3 foot Eiffel Tower from popsicle sticks"),
  { waitUntil: "networkidle" },
);
await page.waitForTimeout(2200);
const eiffel = await page.evaluate(() => {
  const el = document.querySelector("[data-yard-pieces]");
  return { pieces: el?.getAttribute("data-yard-pieces"), kind: el?.getAttribute("data-yard-kind") };
});
console.log("EIFFEL", eiffel);
await page.screenshot({ path: "/workspace/screenshots/yard-eiffel-3d.png" });

await page.getByRole("button", { name: /build plan/i }).click();
await page.waitForTimeout(500);
const planOk = await page.evaluate(() => /Cut list|Buy|Build plan/i.test(document.body.innerText));
console.log("PLAN", planOk);
await page.screenshot({ path: "/workspace/screenshots/yard-eiffel-plan.png" });

await page.goto(
  base + "/workspace?q=" + encodeURIComponent("linen closet for a 31.5 inch bathroom alcove, 78 tall, 16 deep"),
  { waitUntil: "networkidle" },
);
await page.waitForTimeout(1800);
const closet = await page.evaluate(() => {
  const el = document.querySelector("[data-yard-pieces]");
  return { pieces: el?.getAttribute("data-yard-pieces"), kind: el?.getAttribute("data-yard-kind") };
});
console.log("CLOSET", closet);
await page.screenshot({ path: "/workspace/screenshots/yard-closet.png" });

await page.goto(
  base + "/workspace?q=" + encodeURIComponent("window rough opening 36 by 48, 6 inches deep"),
  { waitUntil: "networkidle" },
);
await page.waitForTimeout(1200);
await page.getByRole("button", { name: /build plan/i }).click();
await page.waitForTimeout(400);
const win = await page.evaluate(() => /king|header|rough opening/i.test(document.body.innerText));
console.log("WINDOW", win);
await page.screenshot({ path: "/workspace/screenshots/yard-window.png" });

const mobile = await browser.newContext({ viewport: { width: 390, height: 844 } });
const m = await mobile.newPage();
await watch(m, "mobile");
await m.goto(base + "/", { waitUntil: "networkidle" });
await m.screenshot({ path: "/workspace/screenshots/yard-landing-mobile.png", fullPage: true });
await m.goto(
  base + "/workspace?q=" + encodeURIComponent("3 foot Eiffel Tower from popsicle sticks"),
  { waitUntil: "networkidle" },
);
await m.waitForTimeout(2200);
await m.screenshot({ path: "/workspace/screenshots/yard-eiffel-mobile.png" });

console.log("CONSOLE_ERRORS", errors.length ? errors : "none");
await browser.close();
if (!landOk || eiffel.kind !== "eiffel" || Number(eiffel.pieces) < 50) process.exitCode = 1;
