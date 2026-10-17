// The plan drawer's '1/4" backer' note sits only on rows that are a real backer panel (Critic: 5 builds showed it
// on stick, dowel and skewer rows). Corpus: every Ideas card, home dream, recipe card, plus stick/dowel builds.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { IDEAS } from "../src/lib/yard/ideas";
import { DREAMS } from "../src/lib/yard/promptDreams";
import { generateFromPrompt } from "../src/lib/yard/promptMain";
import { buildPlan } from "../src/lib/yard/report";
import { isSheetStockCut } from "../src/lib/yard/nesting";
import { backerRowIds } from "../src/lib/plan/backer";
import RECIPES from "../src/lib/ideas/recipes.json";

const EXTRA = ["bookshelf 36x12x72", "linen closet 31.5 wide 78 tall 16 deep", "picture frame from bamboo skewers", "abacus", "bird feeder", "1/4 inch dowel ladder", "popsicle stick catapult", "dresser 36 wide"];
const prompts = [...new Set([...IDEAS.map((d) => d.prompt), ...DREAMS.map((d) => d.prompt), ...RECIPES.popular.map((r) => r.prompt), ...RECIPES.fresh.map((r) => r.prompt), ...EXTRA])];
const plans = prompts.map((p) => ({ p, plan: buildPlan(generateFromPrompt(p)) }));
const NOT_PANEL = /dowel|skewer|stick|straw|pvc|pipe|acrylic|glass|chipboard/i;

test("no non-panel row carries the backer note (dowels, sticks, skewers, panes, chipboard, whole items)", () => {
  let checked = 0;
  for (const { p, plan } of plans) {
    const keep = backerRowIds(plan);
    for (const c of plan.cutList) {
      if (!keep.has(c.id)) continue;
      checked++;
      const where = `${p}: ${c.name} (${c.material})`;
      assert.ok(!c.whole && plan.partsKind !== "whole", `${where} is a whole item`);
      assert.ok((c.thicknessIn ?? 0.75) < 0.5, `${where} is not thin`);
      assert.ok(isSheetStockCut(c), `${where} is not sheet stock`);
      assert.doesNotMatch(`${c.material} ${c.id}`, NOT_PANEL, `${where} is not a panel`);
    }
  }
  assert.ok(checked >= 20, `real backers still found (${checked})`);
});

test("the builds Critic flagged lose the note; real backs keep it", () => {
  const notes = (p: string) => { const { plan } = plans.find((x) => x.p === p)!; const k = backerRowIds(plan); return plan.cutList.filter((c) => k.has(c.id)).map((c) => c.name); };
  for (const p of ["picture frame from bamboo skewers", "abacus", "bird feeder", "1/4 inch dowel ladder", "popsicle stick catapult"]) assert.deepEqual(notes(p), [], p);
  assert.ok(notes("bookshelf 36x12x72").some((n) => /back/i.test(n)), "bookshelf back is a backer");
});

test("the drawer's note and thin-backer sentence read backerRowIds, not thickness alone", () => {
  const src = readFileSync(new URL("../src/components/workspace/plan-drawer.tsx", import.meta.url), "utf8");
  assert.match(src, /const thin = backerIds\.has\(c\.id\)/);
  assert.match(src, /const thinCuts = plan\.cutList\.filter\(\(c\) => backerIds\.has\(c\.id\)\)/);
  assert.doesNotMatch(src, /const thin = \(c\.thicknessIn/);
});
