// Batch C2 (home): at most 6 example chips, each with its baked Ideas drawing; one plan strip (the linen canary,
// $183.70) instead of the icon cards and the 1-2-3 row; no photo slot; no store links outside Buy lists.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { generateFromPrompt } from "../src/lib/yard/prompt";
import { buildPlan } from "../src/lib/yard/report";
import { DREAMS } from "../src/lib/yard/promptDreams";
import DRAWINGS from "../src/lib/ideas/drawings.json";

const home = fs.readFileSync("src/routes/index.tsx", "utf8");

test("at most 6 example chips, each a real idea with a baked drawing on disk", () => {
  const ids = JSON.parse(home.match(/const CHIP_IDS = (\[[^\]]*\])/)![1].replace(/'/g, '"')) as string[];
  assert.ok(ids.length > 0 && ids.length <= 6, `${ids.length} chips`);
  assert.match(home, /\.slice\(0, 6\)/);
  const m = DRAWINGS as Record<string, { v: string }>;
  for (const id of [...ids, "linen"]) {
    assert.ok(DREAMS.some((d) => d.id === id) || id === "linen", `${id}: not an example idea`);
    assert.ok(m[id], `${id}: no drawing in the manifest`);
    assert.ok(fs.existsSync(`public/ideas/drawings/${id}.${m[id].v}.svg`), `${id}: drawing file missing`);
  }
  assert.match(home, /<ChipArt src=\{chipArt\?\.\[d\.id\]\} \/>/);
  assert.match(home, /width=\{36\} height=\{36\} loading="lazy"/, "chip drawings have a fixed box (CLS 0)");
});

test("the plan strip replaces the icon cards and the 1-2-3 row, and shows the linen canary's real plan", () => {
  assert.doesNotMatch(home, /function Feature\(|const STEPS = |lucide-react";[\s\S]*?(Hammer|ClipboardList|ShoppingBag)/);
  assert.doesNotMatch(home, /<(Hammer|ClipboardList|ShoppingBag)\b/);
  assert.match(home, /const PLAN_PROMPT = "linen closet 31\.5 wide 78 tall 16 deep";/);
  const plan = buildPlan(generateFromPrompt("linen closet 31.5 wide 78 tall 16 deep"));
  assert.equal(plan.totals.estCostUsd.toFixed(2), "183.70");
  assert.equal(plan.totals.pieces, 11);
  assert.equal(plan.bom.reduce((s, b) => s + (b.estimatedCost ?? 0), 0).toFixed(2), "183.70", "Buy rows add up to the total");
});

test("headline and subline kept; no photo slot; no store links in the strip", () => {
  assert.match(home, /\["Think", "it", "up\."\], \["Yard", "works", "it", "out\."\]/);
  assert.match(home, /One model\. Every cut, part and step\./);
  assert.doesNotMatch(home, /\.(jpe?g|webp|avif|mp4|webm)\b/, "no photo or video yet (5B waits for a real build)");
  const strip = home.slice(home.indexOf("function PlanStrip("));
  assert.doesNotMatch(strip, /href|offers|affiliate|retailer/, "the strip carries no store links");
});
