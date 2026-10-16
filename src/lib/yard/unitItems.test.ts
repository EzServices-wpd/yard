import { test } from "node:test";
import assert from "node:assert/strict";
import { generateFromPrompt } from "./promptMain.ts";
import { buildPlan, packWordsFromCart } from "./report.ts";

const dims = (q: string) => generateFromPrompt(q).panels.map((p) => [p.size.width, p.size.height, p.size.depth].sort((a, b) => b - a));

test("F47: one named craft item builds that one item at its unit-table size", () => {
  assert.deepEqual(dims("paper clip"), [[1.375, 0.375, 0.033]]);
  assert.deepEqual(dims("craft stick"), [[4.5, 0.375, 0.08]]);
  assert.deepEqual(dims("3/8 dowel"), [[36, 0.375, 0.375]]);
  assert.equal(generateFromPrompt("paper clip").primaryMaterialId, "paper-clip-no1");
});

test("F47: a paper clip chain is N real clips linked, each turned 90°", () => {
  const p = generateFromPrompt("paperclip chain");
  assert.ok(p.panels.length >= 10);
  assert.ok(p.panels.every((x) => Math.max(x.size.width, x.size.height, x.size.depth) === 1.375));
  assert.notDeepEqual(p.panels[0].size, p.panels[1].size);
  assert.ok(Math.abs(generateFromPrompt("paper clip chain 12 inches long").overall.width - 12) < 1);
});

test("F17 + F13: washer tower stacks 0.438\" discs; pony bead bracelet is beads, not a pony", () => {
  const w = generateFromPrompt("washer tower");
  assert.ok(w.panels.length > 10 && w.panels.every((x) => x.materialId === "washer-no8" && x.size.width === 0.438 && x.size.height === 0.049 && !!x.polygon));
  const b = generateFromPrompt("pony bead bracelet");
  assert.ok(b.panels.length > 10 && b.panels.every((x) => x.materialId === "pony-bead"));
  assert.match(b.name, /bracelet/i);
  assert.notEqual(generateFromPrompt("washer and dryer pedestal").primaryMaterialId, "washer-no8");
});

test("Buy sells the pack and says the pieces used", () => {
  const line = buildPlan(generateFromPrompt("washer tower")).bom.find((x) => /washer/i.test(x.name))!;
  assert.match(line.unit, /pack of 100/);
  assert.match(line.notes ?? "", /\d+ pieces used/);
});

test("F4/I3: pack words follow the carted listing", () => {
  const [b] = packWordsFromCart([{ name: "Sticks", quantity: 9, unit: "packs of 100 (837 sticks used)", offers: [{ best: true, packQty: 1000, packsNeeded: 1 } as never] } as never]);
  assert.equal(b.unit, "pack of 1000 (837 sticks used)");
  assert.equal(b.quantity, 1);
});
