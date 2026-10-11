import assert from "node:assert/strict";
import { it } from "node:test";
import { generateFromPrompt } from "./promptMain.ts";
import { buildPlan } from "./report.ts";

it("kids art easel is a real-size standing easel with a board and a tray", () => {
  const p = generateFromPrompt("kids art easel");
  assert.ok(p.overall.height >= 40, `${p.overall.height}`);
  assert.ok(!p.instances.length);
  for (const n of ["Left leg", "Right leg", "Board", "Tray"]) assert.ok(p.panels.some((x) => x.name === n), n);
});
it("folding builds its fold, or says plainly it does not fold", () => {
  const t = generateFromPrompt("folding table 48 by 24 36 inches high");
  const legs = t.panels.filter((x) => /\bleg\b/i.test(x.name) && x.type !== "rail" && !/bracket/i.test(x.name)).length;
  assert.equal(t.panels.filter((x) => /^Fold bracket \d+$/.test(x.name)).length, legs);
  assert.ok(buildPlan(t).bom.some((b) => /folding leg/i.test(b.name)));
  assert.match(generateFromPrompt("folding shelf").notes.join(" "), /does not fold/);
});
