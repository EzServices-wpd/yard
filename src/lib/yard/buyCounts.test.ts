import assert from "node:assert/strict";
import { it } from "node:test";
import { generateFromPrompt } from "./promptMain.ts";
import { buildPlan } from "./report.ts";
import { countedName } from "./positiveWording.ts";

it("Buy nouns agree with the count and packs cover what is drawn", () => {
  assert.equal(countedName("Standard Popsicle Stick", 1, "pack of 100 (92 sticks used)"), "Standard Popsicle Sticks");
  assert.equal(countedName("Coat hooks", 1, "each"), "Coat hook");
  assert.equal(countedName("Wood glue", 1, "bottle"), "Wood glue");
  const hooks = (q: string) => buildPlan(generateFromPrompt(q)).bom.find((b) => /coat hook/i.test(b.name))!;
  assert.deepEqual([hooks("coat rack 36 wide five hooks").quantity, hooks("coat rack 36 wide five hooks").unit], [1, "pack of 6"]);
  const stick = buildPlan(generateFromPrompt("doll bed")).bom.find((b) => /stick/i.test(b.name))!;
  assert.match(stick.name, /Sticks$/);
});

it("pack lines buy ceil(count / pack size) packs at every store", () => {
  const plan = buildPlan(generateFromPrompt("coat rack"));
  for (const b of plan.bom) {
    const n = b.unit.match(/pack of (\d+)/i);
    if (!n) continue;
    for (const o of b.offers ?? []) if (o.unitPrice > 0) assert.equal(o.packsNeeded, Math.ceil((b.quantity * Number(n[1])) / o.packQty), `${b.name} ${o.retailer}`);
    assert.ok((b.estimatedCost ?? 0) < 30, `${b.name} ${b.estimatedCost}`);
  }
});

it("no step says it drives 0 screws", () => {
  for (const q of ["pocket vanity", "bookshelf", "coat rack", "linen closet 31.5 wide 78 tall 16 deep"]) {
    for (const s of buildPlan(generateFromPrompt(q)).instructions) assert.doesNotMatch(s.description, /drives 0\b|Drive 0 ×/, `${q}: ${s.title}`);
  }
});
