import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generateFromPrompt } from "./promptMain.ts";
import { buildPlan } from "./report.ts";

const NOUNS = [
  "lemonade stand", "guinea pig hutch", "record crate", "plant ladder", "kayak rack", "toy chest", "puppet theater",
  "dollhouse", "bird feeder", "mailbox", "tiki bar", "garden bench", "raised bed", "sandbox", "rabbit hutch",
  "arcade cabinet", "firewood rack", "surfboard rack", "chicken coop", "doghouse", "playhouse", "boot tray",
  "laptop stand", "monitor riser", "headboard", "trellis", "cornhole boards", "toolbox", "spice rack",
];

describe("Any noun with no stock typed builds a simple real-size piece", () => {
  for (const noun of NOUNS) {
    it(noun, () => {
      const p = generateFromPrompt(noun);
      const o = p.overall;
      assert.ok(!/popsicle|craft|cardboard/.test(p.primaryMaterialId), p.primaryMaterialId);
      const parts = p.panels.length + (p.instances ?? []).length;
      assert.ok(parts >= 1 && parts <= 40, `parts ${parts}`);
      assert.ok(Math.max(o.width, o.height, o.depth) >= 8 && Math.max(o.width, o.height, o.depth) <= 96, `${o.width}x${o.height}x${o.depth}`);
      assert.ok(buildPlan(p).instructions.length > 0);
    });
  }
  it("fallback says what it built in step 1", () => {
    const plan = buildPlan(generateFromPrompt("lemonade stand"));
    assert.match(plan.instructions[0].description ?? "", /^Yard built a lemonade stand as a simple .+ sized for it\. Change any size in Measure\./);
  });
  it("linen closet keeps its three numbers", () => {
    const o = generateFromPrompt("linen closet 31.5 wide 78 tall 16 deep").overall;
    assert.deepEqual({ width: o.width, height: o.height, depth: o.depth }, { width: 31.5, height: 78, depth: 16 });
  });
  it("stock typed keeps the stock", () => {
    assert.match(generateFromPrompt("cardboard dollhouse").primaryMaterialId, /cardboard/);
  });
});

describe("Toy-scale beds are small platforms, never figures", () => {
  for (const prompt of ["doll bed", "toy bed", "barbie crib", "miniature bassinet", "fairy cot"]) {
    it(prompt, () => {
      const project = generateFromPrompt(prompt);
      const roles = [
        ...project.panels.map((x) => x.name),
        ...(project.instances ?? []).map((i) => i.role ?? i.name ?? ""),
      ].join(" ");
      assert.ok(!/^(Figure|Animal)$/i.test(project.name), project.name);
      assert.notEqual(project.kind, "figure");
      assert.notEqual(project.shape?.classId, "humanoid");
      assert.ok(!/\b(?:Arm|Torso|Head|Shin|Thigh|Forearm)\b/i.test(roles), roles);
      const o = project.overall;
      assert.ok(o.height <= 12, `height ${o.height}`);
      assert.ok(Math.max(o.width, o.depth) <= 24, `footprint ${o.width}x${o.depth}`);
      assert.ok(o.height < Math.max(o.width, o.depth), `flat bed ${o.width}x${o.height}x${o.depth}`);
    });
  }
  it("craft stock stays craft on a doll bed", () => {
    assert.match(generateFromPrompt("doll bed").primaryMaterialId, /popsicle|craft/);
    assert.match(generateFromPrompt("popsicle stick doll bed").primaryMaterialId, /popsicle/);
  });
});
