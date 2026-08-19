import { chromium } from "playwright";

const base = process.argv[2] || "https://yard-peach.vercel.app";

const PROMPTS = [
  {
    id: "eiffel",
    q: "3 foot Eiffel Tower from popsicle sticks",
    expectKind: /eiffel|lattice|tower/i,
  },
  {
    id: "pocket",
    q: `I have a pocket space in my bathroom with these exact dimensions:
Back wall: 38.5 inches wide. Left side depth: 26 inches. Right side depth: 33.5 inches. All walls: 102 inches high. Open to the front.
I want mixed-use towel and linen storage as well as a vanity space.
A centered rectangular unit 38 inches wide \u00d7 17 inches deep \u00d7 102 inches high.`,
    expectKind: /closet|opening|pocket/i,
  },
  {
    id: "alcove",
    q: "linen closet for a 31.5 inch bathroom alcove, 78 tall, 16 deep",
    expectKind: /closet|opening/i,
  },
  {
    id: "andersen",
    q: "Andersen 100 Series 36 by 48 double hung window, frame the rough opening",
    expectKind: /window|opening/i,
  },
];

const browser = await chromium.launch({
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--ignore-gpu-blocklist"],
});
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  acceptDownloads: true,
});
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (err) => errors.push(err.message));

const results = [];

async function check(name, fn) {
  try {
    const value = await fn();
    results.push({ name, ok: true, value });
    console.log("OK", name, typeof value === "object" ? JSON.stringify(value) : value);
    return value;
  } catch (err) {
    results.push({ name, ok: false, error: err instanceof Error ? err.message : String(err) });
    console.log("FAIL", name, err instanceof Error ? err.message : err);
    return null;
  }
}

await check("landing", async () => {
  const res = await page.goto(base + "/", { waitUntil: "domcontentloaded", timeout: 30000 });
  if (!res || res.status() >= 400) throw new Error(`status ${res?.status()}`);
  await page.waitForTimeout(800);
  const text = await page.evaluate(() => document.body.innerText);
  if (!/Type it\. Buy the parts/.test(text)) throw new Error("missing hero");
  if (/Dev User/.test(text)) throw new Error("Dev User leaked onto landing");
  return { status: res.status(), signIn: /Sign in/.test(text) };
});

await check("login-skip", async () => {
  const res = await page.goto(base + "/login", { waitUntil: "domcontentloaded", timeout: 20000 });
  if (!res || res.status() >= 400) throw new Error(`status ${res?.status()}`);
  await page.waitForTimeout(400);
  const skip = page.getByRole("link", { name: /skip/i });
  if (!(await skip.count())) throw new Error("no skip link");
  await skip.click();
  await page.waitForURL(/\/workspace/, { timeout: 15000 });
  return page.url();
});

for (const p of PROMPTS) {
  await check(p.id, async () => {
    await page.evaluate(() => localStorage.clear());
    const res = await page.goto(base + "/workspace?q=" + encodeURIComponent(p.q), {
      waitUntil: "domcontentloaded",
      timeout: 45000,
    });
    if (!res || res.status() >= 400) throw new Error(`status ${res?.status()}`);
    await page.waitForSelector("[data-yard-pieces]", { timeout: 25000 });
    await page.waitForTimeout(2200);
    const bench = await page.evaluate(() => {
      const el = document.querySelector("[data-yard-pieces]");
      return {
        pieces: Number(el?.getAttribute("data-yard-pieces") || 0),
        kind: el?.getAttribute("data-yard-kind") || "",
      };
    });
    if (!bench.pieces) throw new Error(`no pieces kind=${bench.kind}`);
    if (p.expectKind && !p.expectKind.test(bench.kind)) {
      throw new Error(`kind ${bench.kind} did not match ${p.expectKind}`);
    }
    const planBtn = page.getByRole("button", { name: /build plan/i });
    if (await planBtn.count()) await planBtn.click();
    await page.waitForTimeout(800);
    const plan = await page.evaluate(() => {
      const text = document.body.innerText;
      return {
        cut: /Cut list|Buy|Build plan|Step/i.test(text),
        export: /Export/i.test(text),
      };
    });
    if (!plan.cut) throw new Error("plan drawer missing cut/buy/steps");
    const exportBtn = page.getByRole("button", { name: /export/i }).first();
    if (!(await exportBtn.count())) throw new Error("no export button");
    const [download] = await Promise.all([
      page.waitForEvent("download", { timeout: 12000 }).catch(() => null),
      exportBtn.click(),
    ]);
    await page.waitForTimeout(600);
    const exportUi = await page.evaluate(() =>
      /PDF|Isometric|Markdown|ready/i.test(document.body.innerText),
    );
    return {
      ...bench,
      plan: plan.cut,
      exportUi,
      pdf: download ? download.suggestedFilename() : null,
    };
  });
}

await browser.close();

const failed = results.filter((r) => !r.ok);
console.log("SUMMARY", JSON.stringify({ passed: results.length - failed.length, failed: failed.length, errors }));
if (failed.length) process.exit(1);
