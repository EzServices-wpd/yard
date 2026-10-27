// Batch C2 (home): at most 6 example chips, each with its baked Ideas drawing; one plan strip (the linen canary,
// $193.68) instead of the icon cards and the 1-2-3 row; no photo slot; no store links outside Buy lists.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { generateFromPrompt } from "../src/lib/yard/prompt";
import { buildPlan } from "../src/lib/yard/report";
import { DREAMS } from "../src/lib/yard/promptDreams";
import { promptWithHomeStock } from "../src/lib/yard/promptHelpers";
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
  assert.equal(plan.totals.estCostUsd.toFixed(2), "193.68");
  assert.equal(plan.totals.pieces, 11);
  assert.equal(plan.bom.reduce((s, b) => s + (b.estimatedCost ?? 0), 0).toFixed(2), "193.68", "Buy rows add up to the total");
});

test("headline and subline kept; no photo slot; no store links in the strip", () => {
  assert.match(home, /\["Think", "it", "up\."\], \["Yard", "works", "it", "out\."\]/);
  assert.match(home, /Plywood or popsicle sticks, PVC or cardboard\. One real model\. Every part, cut and step\./);
  assert.doesNotMatch(home, /One model\. Every cut, part and step\./, "the old subline is gone (PR 3)");
  assert.doesNotMatch(home, /\.(jpe?g|webp|avif|mp4|webm)\b/, "no photo or video yet (5B waits for a real build)");
  const strip = home.slice(home.indexOf("function PlanStrip("));
  assert.doesNotMatch(strip, /href|offers|affiliate|retailer/, "the strip carries no store links");
});

// PR 3b (Ezra 8:09 PM ET): home copy and two craft Material chips. Each chip's own append runs through the engine.
test("every home Material chip builds in its own stock, no refusal", () => {
  const appends = [...home.matchAll(/append: "([^"]+)" \}/g)].map((m) => m[1]);
  const want: Record<string, string> = {
    "from 3/4 plywood": "plywood-3-4-4x8", "from 2x4": "lumber-2x4-8", "from 1/2 inch dowel": "dowel-1-2-36",
    "from 3/4 inch PVC": "pvc-3-4-sch40", "from popsicle sticks": "popsicle-standard", "from cardboard": "cardboard-corrugated-sheet",
  };
  assert.deepEqual(appends, Object.keys(want), "the six chips, in order");
  for (const base of ["bookshelf 30 wide, 60 tall, five shelves", "birdhouse"]) {
    for (const a of appends) {
      const p = generateFromPrompt(promptWithHomeStock(base, a));
      assert.equal(p.primaryMaterialId, want[a], `${base} ${a}`);
      assert.ok(p.panels.length + p.instances.length > 0, `${base} ${a}: parts`);
      assert.ok(!p.notes.some((n) => /can't build|stand-in/i.test(n)), `${base} ${a}: refused`);
    }
  }
});

test("home copy and meta descriptions name every stock (PR 3b)", () => {
  const root = fs.readFileSync("src/routes/__root.tsx", "utf8");
  const desc = "Type what you want to build. Yard draws the real model and prices every part and cut, in plywood, popsicle sticks, PVC or cardboard. Free, no account.";
  assert.equal(root.split(`"${desc}"`).length - 1, 3, "description, twitter and og");
  assert.doesNotMatch(root, /One model\. Every cut, part and step\./);
  assert.match(fs.readFileSync("src/lib/yard/plans.ts", "utf8"), /TAGLINE = "Measured from a real 3D model, not a picture\. Every cut checked\."/);
  assert.match(home, /\{TAGLINE\}/);
});
