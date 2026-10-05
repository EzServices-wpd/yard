import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generateFromPrompt } from "./promptMain.ts";
import { buildPlan } from "./report.ts";
import { stepScrewCount } from "./stepJointScrews.ts";

const buyScrews = (plan: ReturnType<typeof buildPlan>) => {
  const line = plan.bom.find((b) => /screws from the model's joints/.test(b.notes ?? ""));
  return Number(line?.notes?.match(/(\d+) screws from the model's joints/)?.[1] ?? NaN);
};

describe("Buy counts come from the same joints the steps drive", () => {
  for (const prompt of ["linen closet 31.5 wide 78 tall 16 deep", "bookcase 30 wide 48 tall"]) {
    it(`${prompt}: step screws equal Buy screws, back fastened on every edge after the box stands`, () => {
      const project = generateFromPrompt(prompt);
      const plan = buildPlan(project);
      assert.equal(stepScrewCount(plan), buyScrews(plan));
      const titles = plan.instructions.map((s) => s.title);
      const back = titles.findIndex((t) => /back of the box/i.test(t));
      const top = titles.findIndex((t) => /Top/.test(t) && /Attach/.test(t));
      assert.ok(back > top && top > 0, titles.join(" | "));
    });
  }
  it("linen carcase stays 31 1/2 × 78 × 16", () => {
    const p = generateFromPrompt("linen closet 31.5 wide 78 tall 16 deep");
    assert.deepEqual([p.overall.width, p.overall.height, p.overall.depth], [31.5, 78, 16]);
  });
  it("coat rack: the typed hook count wins in steps and Buy, and hook screws are counted", () => {
    const plan = buildPlan(generateFromPrompt("coat rack 36 wide five hooks"));
    const hooks = plan.bom.find((b) => /hook/i.test(b.name));
    assert.match(hooks?.notes ?? "", /^5 hooks/);
    assert.match(hooks?.notes ?? "", /10 hook screws/);
    const text = plan.instructions.map((s) => `${s.title} ${s.description}`).join(" ");
    assert.match(text, /Screw 5 hooks/);
    assert.doesNotMatch(text + (hooks?.notes ?? ""), /\b6 hooks\b/);
  });
});
