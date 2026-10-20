/**
 * Quick wins for release/2026-10-22 (Grok review §8 (a)–(e) + full tab titles). Pins each rule at its one place.
 *   npx tsx --test scripts/quick-wins.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { userText, LEAKS } from "../src/lib/yard/userText";
import { clean } from "../src/lib/yard/pdfKit";
import { generateFromPrompt } from "../src/lib/yard/prompt";
import { buildPlan } from "../src/lib/yard/report";

const shell = fs.readFileSync("src/components/workspace/shell.tsx", "utf8");

test("(a) the lamp covers the bench only while the engine solves; an AI check over a priced model is a chip", () => {
  assert.match(shell, /const lampOn = pending && !stalled && \(building \|\| !priced\);/);
  assert.match(shell, /<LavaLamp key=\{lampKey\} show=\{lampOn\}[^>]*caption="Building" \/>/);
  assert.doesNotMatch(shell, /Fitting the opening/, "no opening caption on builds that have no opening");
  assert.match(shell, /data-yard-ai-chip="1"/);
});

test("(b) a build still pending after STALL_MS stops the lamp and offers three builds", () => {
  assert.match(shell, /export const STALL_MS = 45_000;/);
  assert.match(shell, /data-yard-stalled="1"/);
  const ideas = shell.match(/const STALL_IDEAS = \[([^\]]+)\]/)![1].split(",").map((s) => s.trim().replace(/^"|"$/g, ""));
  assert.equal(ideas.length, 3);
  for (const q of ideas) assert.ok(generateFromPrompt(q).panels.length > 0, `${q} builds`);
});

test("full tab titles: the tab is the header the page shows", () => {
  assert.match(shell, /document\.title = `\$\{headerTitle\(project\)\} · Yard`;/);
});

test("(d) leaked engine wording never reaches a person: one scrub for the bench, plan drawer, export and PDF", () => {
  assert.equal(userText("Fit it. This part was on the model and not yet in a step."), "Fit it.");
  assert.equal(userText("Drive 4 screws. These screws are counted in another step's total."), "Drive 4 screws.");
  assert.equal(userText("One join class: attach the aprons to the legs."), "One join: attach the aprons to the legs.");
  assert.equal(userText('Assumed 34" tall (vanity class default) — type a height to lock it.'), 'Assumed 34" tall — type a height to lock it.');
  assert.equal(userText("Walk the road on the bench. A toy can roll it."), "A toy can roll it.");
  assert.ok(!/class default/.test(clean('Assumed 21" deep (chest class default)')), "PDF text goes through the scrub");
  for (const f of ["plan-drawer.tsx", "export-dialog.tsx"]) {
    const src = fs.readFileSync(`src/components/workspace/${f}`, "utf8");
    assert.match(src, /userText\(s\.description\)/, f);
    assert.doesNotMatch(src, /\{s\.description\}|\{s\.tips\}/, `${f}: raw step text`);
  }
  // Real plans: no leak survives the scrub on the builds the review walked.
  for (const q of ["30 inch vanity", "dining table", "picnic table", "toy road", "dresser", "chest 36 wide"]) {
    const plan = buildPlan(generateFromPrompt(q));
    for (const s of plan.instructions) for (const t of [s.description, s.tips ?? ""]) for (const re of LEAKS) assert.ok(!re.test(userText(t)), `${q}: ${re} in "${t}"`);
  }
});

test("(d) Buy says '1 item goes'; the build card never shows an Unverified badge", () => {
  const buy = fs.readFileSync("src/components/workspace/buy-list.tsx", "utf8");
  assert.match(buy, /itemCount === 1 \? "item goes" : "items go"/);
  const info = fs.readFileSync("src/components/workspace/build-info.tsx", "utf8");
  assert.doesNotMatch(info, />\{info\.trust\}</, "the trust word is not printed");
  assert.match(shell, /replace\(\/\^Unverified:\\s\*\/, ""\)/);
});

test("(walk 3) a control's label names what it opens: 'Material: …' opens the stock picker, Options opens the menu", () => {
  const src = fs.readFileSync("src/components/workspace/bench-options.tsx", "utf8");
  const chip = src.slice(src.indexOf("data-yard-material-chip") - 400, src.indexOf("data-yard-material-chip"));
  assert.match(chip, /onClick=\{onStock\}/, "the Material chip opens the stock picker");
  const opts = src.slice(src.indexOf("data-yard-options-toggle") - 400, src.indexOf("data-yard-options-toggle"));
  assert.match(opts, /onClick=\{onToggle\}/);
  assert.doesNotMatch(src.slice(src.indexOf("data-yard-options-toggle") - 400, src.indexOf("data-yard-options-toggle") + 600), /Material:/, "the menu toggle is not labelled Material");
  const bar = fs.readFileSync("src/components/workspace/prompt-bar.tsx", "utf8");
  assert.match(bar, /onStock=\{\(\) => \{\s*setOptionsOpen\(false\);\s*onStock\(\);/);
});

test("(walk 5) no runtime third-party CDN assets: the bench HDRI is self-hosted and no drei preset fetches one", () => {
  assert.ok(fs.existsSync("public/hdri/empty_warehouse_01_1k.hdr"));
  assert.equal(fs.readFileSync("public/hdri/empty_warehouse_01_1k.hdr").subarray(0, 10).toString(), "#?RADIANCE");
  const CDN = /https?:\/\/(?:fonts\.googleapis\.com|fonts\.gstatic\.com|raw\.githack\.com|[\w.-]*githack\.com|cdn\.jsdelivr\.net|unpkg\.com|cdnjs\.cloudflare\.com|raw\.githubusercontent\.com|[\w.-]*\.cloudfront\.net)/i;
  // No allow-list: the fonts are self-hosted too (row 113), so a Google Fonts URL in src fails like any CDN.
  const walk = (d: string): string[] => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(`${d}/${e.name}`) : /\.(tsx?|mjs|css|html)$/.test(e.name) && !/\.test\./.test(e.name) ? [`${d}/${e.name}`] : []));
  const bad: string[] = [];
  for (const f of walk("src")) {
    const t = fs.readFileSync(f, "utf8");
    for (const m of t.matchAll(/https?:\/\/[^\s"'`)]+/g)) if (CDN.test(m[0])) bad.push(`${f}: ${m[0]}`);
    // drei presets (Environment preset=, useEnvironment({ preset })) load from raw.githack.com at runtime.
    if (/<(?:Environment|Stage)\b[^>]*\bpreset=/.test(t) || /useEnvironment\(\{[^}]*preset/.test(t)) bad.push(`${f}: drei preset (fetches from githack)`);
  }
  assert.deepEqual(bad, []);
});

test("(walk 6) the privacy page is never dated in the future, and not before its wording's commit", async () => {
  const src = fs.readFileSync("src/routes/privacy.tsx", "utf8");
  const day = src.match(/export const PRIVACY_UPDATED = "(\d{4}-\d{2}-\d{2})"/)![1];
  assert.ok(day >= "2026-10-17", "on or after the wording's commit (ca8cf29, 17 Oct)");
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  assert.ok(day <= today, `${day} is after today (${today})`);
  assert.doesNotMatch(src, /Last updated \d+ \w+ \d{4}\./, "the date is rendered from PRIVACY_UPDATED, not typed twice");
});
