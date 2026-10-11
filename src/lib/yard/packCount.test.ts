import assert from "node:assert/strict";
import { it } from "node:test";
import { generateFromPrompt } from "./promptMain.ts";
import { buildPlan } from "./report.ts";

it("a craft stick pack line in Buy names the sticks the cut list uses", () => {
  const plan = buildPlan(generateFromPrompt("doll bed from popsicle sticks"));
  const cut = plan.cutList.filter((c) => /popsicle/i.test(c.material)).reduce((n, c) => n + c.quantity, 0);
  const line = plan.bom.find((b) => b.catalogId === "popsicle-standard")!;
  const used = Number(line.unit.match(/\((\d+) sticks used\)/)?.[1]);
  assert.ok(used >= cut && used <= cut + 2, `${line.unit} vs ${cut}`);
  assert.ok(line.quantity * Number(line.unit.match(/of (\d+)/)![1]) >= used);
});
