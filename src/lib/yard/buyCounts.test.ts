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
