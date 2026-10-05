import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generateFromPrompt } from "./promptMain.ts";
import { buildPlan } from "./report.ts";
import { supportsOf } from "./supportGraph.ts";
import { placementIndex } from "./placeEveryPart.ts";
import { stepScrewCount } from "./stepJointScrews.ts";

const FITTED = [
  "pocket vanity", "60\" desk", "kitchen base cabinet 36 wide", "media console 60 wide", "shoe bench 36 wide",
  "wall cabinet 24 wide 30 tall", "coffee table 48 x 24", "planter box 36 long", "workbench 6 feet",
];

describe("Buy screws are the screws the steps drive", () => {
  for (const prompt of FITTED) {
    it(prompt, () => {
      const plan = buildPlan(generateFromPrompt(prompt));
      const line = plan.bom.find((b) => /screws from the model's joints/.test(b.notes ?? ""));
      assert.ok(line, "Buy lists the joint screws");
      const buy = Number(line!.notes!.match(/(\d+) screws from/)?.[1]);
      assert.equal(stepScrewCount(plan), buy, `steps drive ${stepScrewCount(plan)}, Buy ${buy}`);
    });
  }
});

describe("Every panel goes on after the parts it rests on", () => {
  for (const prompt of ["kitchen base cabinet 36 wide", "media console 60 wide", "shoe bench 36 wide", "workbench 6 feet", "linen closet 31.5 wide 78 tall 16 deep"]) {
    it(prompt, () => {
      const project = generateFromPrompt(prompt);
      const plan = buildPlan(project);
      const at = placementIndex(project, plan.instructions);
      for (const [key, info] of supportsOf(project)) {
        const i = at.get(key);
        if (i == null) continue;
        for (const s of info.on) {
          const j = at.get(s);
          assert.ok(j == null || j <= i, `${key} at step ${i + 1} before its support ${s} at step ${j! + 1}`);
        }
      }
    });
  }
});

describe("A leg frame names only the parts it has", () => {
  it("workbench: legs, then aprons, then the top in its own step", () => {
    const plan = buildPlan(generateFromPrompt("workbench 6 feet"));
    const titles = plan.instructions.map((s) => s.title);
    const top = titles.findIndex((t) => /^Set the Work top$/.test(t));
    const apron = titles.findIndex((t) => /apron/i.test(t));
    assert.ok(top > apron && apron > 0, titles.join(" | "));
    const text = plan.instructions.map((s) => s.description).join(" ");
    assert.ok(!/\bback into\b|The back is already on/i.test(text), "no ghost back");
    assert.ok(!/Lay the two uprights/.test(text), "four legs, not two uprights");
    assert.ok(!/^Level it$/.test(titles[top + 1] ?? "") || !/Drive \d+ ×/.test(plan.instructions[top + 1].description), "Level it places nothing");
  });
});

describe("Steps say what to do", () => {
  for (const prompt of ["wall cabinet 24 wide 30 tall", "garden arch from pvc"]) {
    it(prompt, () => {
      const plan = buildPlan(generateFromPrompt(prompt));
      for (const s of plan.instructions) {
        assert.ok(!/\b(do not|don't|never|cannot)\b[^.]*(footprint|walk-through)/i.test(`${s.description} ${s.tips ?? ""}`), s.description);
      }
    });
  }
});
