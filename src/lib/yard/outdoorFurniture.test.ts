import assert from "node:assert/strict";
import { it } from "node:test";
import { generateFromPrompt } from "./promptMain.ts";
import { buildPlan } from "./report.ts";

it("outdoor furniture with no stock typed is 1x slats on 2x6 legs with exterior screws", () => {
  const p = generateFromPrompt("adirondack chair");
  const by = (role: string) => new Set(p.instances.filter((i) => i.role === role).map((i) => i.catalogId));
  assert.deepEqual([...by("seat")], ["lumber-1x4-8"]);
  assert.deepEqual([...by("leg")], ["lumber-2x6-8"]);
  const bom = buildPlan(p).bom;
  assert.ok(bom.some((b) => /screw/i.test(b.name) && /exterior|stainless/i.test(b.name)));
  assert.ok(!bom.some((b) => /2×4 Stud/.test(b.name)));
});
it("typed stock wins on outdoor furniture", () => {
  const p = generateFromPrompt("adirondack chair from 2x4");
  assert.ok(p.instances.every((i) => i.catalogId === "lumber-2x4-8"));
});
