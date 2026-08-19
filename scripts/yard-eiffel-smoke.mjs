import { chromium } from "playwright";

const base = process.argv[2] || "http://127.0.0.1:8080";
const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader"] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const logs = [];
page.on("console", (m) => logs.push(`${m.type()}: ${m.text()}`));
page.on("pageerror", (e) => logs.push(`pageerror: ${e.message}`));

await page.goto(base + "/workspace", { waitUntil: "domcontentloaded" });
await page.evaluate(() => localStorage.clear());

const url = base + "/workspace?q=" + encodeURIComponent("3 foot Eiffel Tower from popsicle sticks") + "&t=" + Date.now();
await page.goto(url, { waitUntil: "networkidle" });
await page.waitForTimeout(2000);

const state = await page.evaluate(() => {
  const el = document.querySelector("[data-yard-pieces]");
  const canvas = document.querySelector("canvas");
  return {
    pieces: el?.getAttribute("data-yard-pieces"),
    kind: el?.getAttribute("data-yard-kind"),
    yard: window.__yard ?? null,
    canvas: canvas
      ? {
          w: canvas.width,
          h: canvas.height,
          cw: canvas.clientWidth,
          ch: canvas.clientHeight,
          style: canvas.getAttribute("style"),
          display: getComputedStyle(canvas).display,
          opacity: getComputedStyle(canvas).opacity,
          vis: getComputedStyle(canvas).visibility,
          z: getComputedStyle(canvas).zIndex,
        }
      : null,
  };
});
console.log("STATE", JSON.stringify(state, null, 2));
console.log("LOGS", logs.filter((l) => /error|fail|pageerror/i.test(l)).slice(0, 30));
await page.screenshot({ path: "/workspace/screenshots/yard-eiffel-3d.png" });
await browser.close();
