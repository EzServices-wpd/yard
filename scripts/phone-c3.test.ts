// Batch C3 (phones): one nav label everywhere ("Workbench", as #72's title), 44px+ targets on phones.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const home = fs.readFileSync("src/routes/index.tsx", "utf8");
const chrome = fs.readFileSync("src/components/site/chrome.tsx", "utf8");
const plan = fs.readFileSync("src/routes/plans/$slug.tsx", "utf8");

test("the nav names the workspace 'Workbench' on home and on every chrome page", () => {
  assert.match(chrome, /label: "Workbench"/);
  const nav = home.slice(home.indexOf("<nav aria-label=\"Main\" className=\"flex items-center gap-1\">"), home.indexOf("</nav>"));
  assert.match(nav, />\s*Workbench\s*</);
  assert.doesNotMatch(nav, />\s*Bench\s*</);
});

test("phone targets: the home prompt input keeps 48px in the column layout; Free plans links and /plans buttons are 44px below lg", () => {
  assert.match(home, /id="dream"[\s\S]{0,300}className="h-12 min-h-12 /);
  assert.match(home, /\{p\.name\}<\/Link>/);
  assert.match(home, /max-lg:inline-flex max-lg:min-h-11 max-lg:items-center">\{p\.name\}/);
  for (const label of ["Open the 3D model", "Make it your size"]) assert.match(plan, new RegExp(`max-lg:min-h-11 max-lg:items-center">${label}`));
});

test("Made on Yard shows a non-chip idea instead of a second linen card: one linen price on home ($193.68 in the strip)", async () => {
  const { DREAMS } = await import("../src/lib/yard/promptDreams");
  const { showcaseFor } = await import("../src/lib/yard/homeShowcase");
  const chips = JSON.parse(home.match(/const CHIP_IDS = (\[[^\]]*\])/)![1]) as string[];
  const pieces = home.slice(home.indexOf("const PIECES = ["), home.indexOf("] as const;", home.indexOf("const PIECES = [")));
  assert.doesNotMatch(pieces, /id: "linen"|prompt: "linen/);
  assert.match(pieces, /id: "ldesk"/);
  assert.ok(!chips.includes("ldesk"), "not one of the chips");
  const d = DREAMS.find((x) => x.id === "ldesk")!;
  const s = showcaseFor(d.prompt);
  assert.deepEqual([s.overall.width, s.overall.depth, s.overall.height], [60, 48, 30], "the size typed is the size drawn");
  assert.ok(s.pieces > 0 && s.buyUsd > 0 && (s.svg.match(/<path/g) ?? []).length > 10);
});
