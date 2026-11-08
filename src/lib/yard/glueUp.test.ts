import { it } from "node:test";
import assert from "node:assert/strict";
import { generateFromPrompt } from "./promptMain.ts";
import { buildPlan } from "./report.ts";

// The saw step cuts a glue-up's layers, and a drawer is never treated as a lamination.
it("glue-ups: saw step cuts the layers; drawers are not laminations", () => {
  // The water wheel's hubs are one ply each, set in the rims' open centres: nothing to laminate.
  const ww = buildPlan(generateFromPrompt("water wheel")).instructions;
  assert.ok(!ww.some((s) => s.title === "Glue up the thick parts"), "water wheel: no glue-up");
  for (const q of ["pocket vanity", "dresser"]) {
    const g = buildPlan(generateFromPrompt(q)).instructions.find((s) => s.title === "Glue up the thick parts");
    assert.ok(!g || !/drawer/i.test(g.description), q);
  }
});

// A sheet part thicker than its sheet but under 2" (a 1 1/4" wall on 3/4" ply) is a glue-up too, never cut at 1 1/4".
it("a part thicker than its sheet is cut as layers", () => {
  const p = generateFromPrompt("water wheel");
  const hub = p.panels.find((x) => x.name === "hub 1")!;
  hub.size = { ...hub.size, width: 1.25 };
  const ins = buildPlan(p).instructions;
  assert.match(ins.find((s) => /^Cut /.test(s.title))!.description, /2 hub layers 3 7\/8 × 3 7\/8 × 3\/4"/i);
  assert.match(ins.find((s) => s.title === "Glue up the thick parts")!.description, /hub(?: 1)?: 2 layers/);
});

// Critic: cut-list counts equal model counts. Any part thicker than its stock is a glue-up (even under 1.5x), so a glue-up
// row counts layers and its note says how many make each part: rows / layers is the model's part count.
it("cut-list counts: one piece per model part, glue layers counted as layers (deck stairs, pergola, murphy bed, mudroom locker)", () => {
  const cut = (q: string) => buildPlan(generateFromPrompt(q)).cutList;
  const n = (q: string, name: string) => {
    const c = cut(q).find((x) => x.name === name)!;
    return c.quantity / Number(/Glue up (\d+) layers/.exec(c.notes ?? "")?.[1] ?? 1);
  };
  assert.equal(n("deck stairs", "Tread"), 3);
  assert.equal(n("pergola", "Rafter"), 8);
  assert.equal(n("mudroom locker", "Side"), 4);
  assert.equal(n("murphy bed", "Bed face · left"), 1);
  for (const q of ["deck stairs", "pergola", "murphy bed", "mudroom locker", "water wheel"])
    for (const c of cut(q)) {
      const m = /Glue up (\d+) layers/.exec(c.notes ?? "");
      if (!m) continue;
      assert.equal(c.quantity % Number(m[1]), 0, `${q}: ${c.name} layers come in whole parts`);
    }
});
