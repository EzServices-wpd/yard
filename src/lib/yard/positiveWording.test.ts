import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generateFromPrompt } from "./promptMain.ts";
import { buildPlan } from "./report.ts";
import { readFileSync } from "node:fs";
import { STRESS_PROMPTS } from "./stressPrompts.ts";

const PROMPTS = [
  "linen closet 31.5 wide 78 tall 16 deep", "bookcase 30 wide 48 tall", "coat rack 36 wide five hooks", "kitchen chair from 1x4",
  "cat tree 5 feet", "step stool 2 steps", "pocket vanity", "bathroom vanity with a pocket for the trash can", "dog bed from a pallet",
  "cardboard robot", "bamboo picture frame 8x10", "60\" desk", "toy box", "floating shelf 36 wide", "nightstand with drawer",
  "popsicle stick house", "shoe rack", "wine rack", "bunk bed", "kitchen island 48 wide", "tv stand 60 wide", "dresser 6 drawers",
  "spice rack", "dog house", "pallet coffee table", "closet organizer 72 wide", "eiffel tower from popsicle sticks",
];

const strings = (plan: ReturnType<typeof buildPlan>) => [
  ...plan.instructions.flatMap((s) => [s.title, s.description, s.tips ?? ""]),
  ...plan.bom.flatMap((b) => [b.name, b.notes ?? ""]),
  ...plan.cutList.flatMap((c) => [c.name, c.notes ?? "", c.material]),
  plan.feasibility?.summary ?? "",
];

describe("Build notes read positively too", () => {
  const golden = (JSON.parse(readFileSync(new URL("./promptSnapshots.goldens.json", import.meta.url), "utf8")) as { prompt: string }[]).map((g) => g.prompt);
  for (const prompt of [...new Set([...PROMPTS, ...golden, ...STRESS_PROMPTS])]) {
    it(`notes: ${prompt}`, () => {
      for (const n of generateFromPrompt(prompt).notes ?? []) {
        assert.doesNotMatch(n, /\b(?:cannot|can't|can not|do not|don't|never|must not)\b/i, `negative wording in a note of "${prompt}": ${n}`);
        assert.doesNotMatch(n, /^Topology(?:-lite)? ·/, `an engine-internal note in "${prompt}": ${n}`);
      }
    });
  }
});

describe("Plan text is positive and in fractions", () => {
  for (const prompt of PROMPTS) {
    it(prompt, () => {
      const plan = buildPlan(generateFromPrompt(prompt));
      for (const t of strings(plan)) {
        assert.doesNotMatch(t, /\b(?:cannot|can't|can not|do not|don't|never|must not)\b/i, `negative wording in "${prompt}": ${t}`);
        // Prices ($12.99) are money; every size is a fraction.
        assert.doesNotMatch(t.replace(/~?\$\s?[\d,]+\.\d+/g, ""), /(?<![\d.])\d+\.\d+/, `decimal in "${prompt}": ${t}`);
      }
    });
  }
});

describe("Working parts exist before the plan claims them", () => {
  it("bamboo picture frame 8x10: clear glazing in the model, the cut list and Buy, set in by a step", () => {
    const project = generateFromPrompt("bamboo picture frame 8x10");
    const plan = buildPlan(project);
    assert.ok(project.panels.some((p) => p.type === "glass_panel"), "glazing panel in the model");
    assert.ok(plan.cutList.some((c) => /acrylic|glass/i.test(c.name)), "glazing on the cut list");
    assert.ok(plan.bom.some((b) => /acrylic|glass/i.test(b.name)), "glazing on Buy");
    assert.ok(plan.instructions.some((s) => /acrylic|glass/i.test(s.title)), "a step sets the glazing");
    const backer = plan.bom.find((b) => /chipboard/i.test(b.name));
    assert.ok(backer && !/8 1\/2 × 11/.test(backer.name), "the backer sheet is big enough for the cut backer");
  });
  it("a frame typed with no glass stays open", () => {
    const project = generateFromPrompt("bamboo picture frame 8x10 no glass");
    assert.equal(project.panels.filter((p) => p.type === "glass_panel").length, 0);
  });
});
