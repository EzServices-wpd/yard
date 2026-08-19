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
const land = await page.evaluate(() => ({
  hero: /Type it\. Buy the parts/.test(document.body.innerText),
  formerly: /formerly/i.test(document.body.innerText),
}));
console.log("LANDING", land);
await page.screenshot({ path: "/workspace/screenshots/yard-landing.png", fullPage: true });

await page.evaluate(() => localStorage.clear());
await page.goto(
  base + "/workspace?q=" + encodeURIComponent("3 foot Eiffel Tower from popsicle sticks"),
  { waitUntil: "networkidle" },
);
await page.waitForTimeout(2500);
const eiffel = await page.evaluate(() => {
  const el = document.querySelector("[data-yard-pieces]");
  return {
    pieces: el?.getAttribute("data-yard-pieces"),
    kind: el?.getAttribute("data-yard-kind"),
    mode: el?.getAttribute("data-yard-mode"),
    hull: el?.getAttribute("data-yard-hull"),
    form: el?.getAttribute("data-yard-form"),
    hasLook: /Look/.test(document.body.innerText),
    hasForm: /Form/.test(document.body.innerText),
  };
});
console.log("EIFFEL", eiffel);
await page.screenshot({ path: "/workspace/screenshots/yard-eiffel-3d.png" });

await page.getByRole("button", { name: /^hull$/i }).click();
await page.waitForTimeout(400);
const bothOn = await page.evaluate(() => {
  const el = document.querySelector("[data-yard-pieces]");
  return { hull: el?.getAttribute("data-yard-hull"), form: el?.getAttribute("data-yard-form") };
});
console.log("GHOST BOTH", bothOn);
await page.screenshot({ path: "/workspace/screenshots/yard-eiffel-ghosts.png" });

await page.getByRole("button", { name: /^free$/i }).click();
await page.getByRole("button", { name: /build plan/i }).click();
await page.waitForTimeout(600);
const plan = await page.evaluate(() => ({
  plates: document.querySelectorAll("svg").length,
  export: /Export/.test(document.body.innerText),
  showOn: /Show on bench/.test(document.body.innerText),
}));
console.log("PLAN", plan);
await page.screenshot({ path: "/workspace/screenshots/yard-eiffel-plan.png" });

const showBtn = page.getByRole("button", { name: /Show on bench/i }).first();
if (await showBtn.count()) await showBtn.click();
await page.waitForTimeout(400);

await page.getByRole("button", { name: /Export/i }).click();
await page.waitForTimeout(300);
const exp = await page.evaluate(() => /Isometric plates|Markdown|HTML plates/.test(document.body.innerText));
console.log("EXPORT", exp);
await page.screenshot({ path: "/workspace/screenshots/yard-export.png" });
await page.getByRole("button", { name: /^cancel$/i }).click();

await page.keyboard.press("Escape");
// close plan via X
const closePlan = page.getByRole("button", { name: /^close$/i }).first();
if (await closePlan.count()) await closePlan.click();

await page.getByRole("button", { name: /measure/i }).click();
await page.waitForTimeout(400);
const meas = await page.evaluate(() => /Measure a space|Fit this opening/.test(document.body.innerText));
console.log("MEASURE", meas);
await page.screenshot({ path: "/workspace/screenshots/yard-measure.png" });

await page.getByRole("button", { name: /^build$/i }).click();
await page.waitForTimeout(800);
const build = await page.evaluate(() => {
  const el = document.querySelector("[data-yard-pieces]");
  return { mode: el?.getAttribute("data-yard-mode"), snap: /Snap to the glow/.test(document.body.innerText) };
});
console.log("BUILD MODE", build);
await page.screenshot({ path: "/workspace/screenshots/yard-build-mode.png" });

const mobile = await browser.newContext({ viewport: { width: 390, height: 844 } });
const m = await mobile.newPage();
await watch(m, "mobile");
await m.goto(base + "/", { waitUntil: "networkidle" });
const overflow = await m.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
console.log("MOBILE OVERFLOW", overflow);
await m.screenshot({ path: "/workspace/screenshots/yard-landing-mobile.png", fullPage: true });
await m.goto(
  base + "/workspace?q=" + encodeURIComponent("3 foot Eiffel Tower from popsicle sticks"),
  { waitUntil: "networkidle" },
);
await m.waitForTimeout(2200);
await m.screenshot({ path: "/workspace/screenshots/yard-eiffel-mobile.png" });

console.log("ERRORS", errors);
await browser.close();
if (!land.hero || Number(eiffel.pieces) < 20 || eiffel.form !== "1" || !exp || !meas) {
  process.exit(1);
}
if (errors.some((e) => /failed to load|is not defined|cannot read/i.test(e))) {
  process.exit(1);
}
