import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generateFromPrompt } from "./promptMain";
import { buildPlan } from "./report";
import { detectMaterial } from "./promptHelpers";
import { buyListCart } from "./amazonCart";

describe("finish list", () => {
  it("names the porch bench legs in the seal step", () => {
    const seal = buildPlan(generateFromPrompt("porch bench")).instructions.find((s) => /Seal it/.test(s.title));
    assert.match(seal?.description ?? "", /Front left leg/);
    assert.doesNotMatch(seal?.description ?? "", /2 sides \(the feet\)/);
  });

  it("puts exterior finish on the cart", () => {
    const plan = buildPlan(generateFromPrompt("porch bench"));
    const finish = plan.bom.find((line) => /spar|exterior finish/i.test(line.name));
    assert.ok(finish?.asin);
    const cart = buyListCart(plan.bom);
    assert.ok(cart.lines.some((line) => /finish|screw|glue/i.test(line.name)));
  });

  it("counts a bar pull per door", () => {
    const plan = buildPlan(generateFromPrompt("linen closet 31.5 wide 78 tall 16 deep"));
    const pulls = plan.bom.find((line) => /bar pull/i.test(line.name));
    assert.ok(pulls);
    assert.ok((pulls?.quantity ?? 0) >= 2);
  });

  it("says a popsicle stool is a display model and a PVC birdhouse joins with cement", () => {
    const stool = generateFromPrompt("popsicle stick step stool");
    assert.match(stool.notes[0], /display model/);
    assert.equal(stool.holdStockId, "lumber-2x4-8");
    const bird = generateFromPrompt("PVC birdhouse");
    assert.match(bird.notes[0], /solvent cement/);
    assert.doesNotMatch(bird.notes.join(" "), /popsicle|stick wall/);
    assert.ok(bird.instances.length < 20, `pipe house should be a frame, got ${bird.instances.length}`);
    assert.ok(bird.instances.some((i) => i.role === "post"));
    assert.equal(bird.panels.length, 0);
    const stool = buildPlan(generateFromPrompt("popsicle stick step stool"));
    const after = stool.instructions.slice(stool.instructions.findIndex((s) => /Do not cut/.test(s.title)) + 1);
    assert.ok(after.length > 0);
    assert.equal(after.some((s) => /^Cut\b/.test(s.title)), false);
    assert.equal(detectMaterial("bamboo pole").id, "bamboo-pole-6");
    assert.equal(detectMaterial("thick dowel rack").id, "dowel-1-36");
  });
});
