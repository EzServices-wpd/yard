import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { generateFromPrompt } from "./promptMain.ts";
import { buildPlan } from "./report.ts";
import { placementIndex } from "./placeEveryPart.ts";
import { supportsOf } from "./supportGraph.ts";
import { STRESS_PROMPTS } from "./stressPrompts.ts";

const here = dirname(fileURLToPath(import.meta.url));
const goldens = (JSON.parse(readFileSync(join(here, "promptSnapshots.goldens.json"), "utf8")) as { prompt: string }[]).map((g) => g.prompt);
/** Goldens, stress prompts, and the three builds the morning walk caught. */
const PROMPTS = [...new Set([...goldens, ...STRESS_PROMPTS, "picnic table", "chicken coop", "bunk bed"])];

const isLeg = (name: string) => /\blegs?\b/i.test(name) && !/\bboard\b|\(/i.test(name);

describe("plan steps: one title each, every part after all its supports, leg counts agree", () => {
  for (const prompt of PROMPTS) {
    it(prompt, () => {
      const project = generateFromPrompt(prompt);
      const steps = buildPlan(project).instructions;
      const titles = steps.map((s) => s.title.trim().toLowerCase());
      const dup = titles.filter((t, i) => titles.indexOf(t) !== i);
      assert.deepEqual(dup, [], `duplicate step titles: ${dup.join(" / ")}`);

      if (project.panels.length) {
        const plan = buildPlan(project);
        const legs = project.panels.filter((p) => isLeg(p.name)).length;
        for (const s of steps) {
          const m = s.title.match(/^Cut (\d+) legs?\b/i);
          if (m) assert.equal(Number(m[1]), legs, `"${s.title}" but the model has ${legs} legs`);
        }
        const cutLegs = plan.cutList.filter((c) => /\blegs?$/i.test(c.name)).reduce((n, c) => n + c.quantity, 0);
        if (cutLegs) assert.equal(cutLegs, legs, `cut list has ${cutLegs} legs, the model ${legs}`);

        const supports = supportsOf(project);
        const at = placementIndex(project, steps);
        for (const d of project.panels.filter((p) => p.type === "drawer")) {
          const i = steps.findIndex((s) => (s.partsUsed ?? []).includes(d.name));
          if (i >= 0 && !at.has(d.id)) at.set(d.id, i);
        }
        const name = new Map(project.panels.map((p) => [p.id, p.name]));
        const late: string[] = [];
        for (const [key, info] of supports) {
          const i = at.get(key);
          if (i == null) continue;
          for (const s of info.on) {
            const j = at.get(s);
            if (j != null && j > i) late.push(`${name.get(key)} (step ${i + 1}) before ${name.get(s)} (step ${j + 1})`);
          }
        }
        assert.deepEqual(late, [], late.slice(0, 3).join("; "));
      }
    });
  }
});

describe("picnic table: 2× top and seat boards on A-frames of splayed 2×6 legs", () => {
  it("real stock, splayed legs, seat supports, a center brace; no plywood", () => {
    const p = generateFromPrompt("picnic table");
    const plan = buildPlan(p);
    assert.ok(!p.panels.some((x) => /plywood/.test(x.materialId)), "no plywood part");
    const legs = p.panels.filter((x) => /^Leg\b/.test(x.name));
    assert.ok(legs.length >= 4 && legs.length % 2 === 0 && legs.every((x) => x.materialId === "lumber-2x6-8" && x.polygon), "splayed 2×6 legs");
    const boards = p.panels.filter((x) => /board/i.test(x.name));
    assert.ok(boards.length >= 9 && boards.every((x) => x.materialId === "lumber-2x6-8"), "2×6 top and seat boards");
    assert.equal(p.panels.filter((x) => /^Seat support/.test(x.name)).length, legs.length / 2);
    assert.ok(p.panels.some((x) => /^Center brace/.test(x.name)));
    assert.ok(plan.bom.some((b) => /carriage bolts/.test(b.name) && b.quantity === legs.length * 3));
    assert.ok(!plan.bom.some((b) => /plywood/i.test(b.name)));
  });
  it("typed 2×4 drives the boards; the frames stay 2×6 and say so; a typed length is used", () => {
    const p = generateFromPrompt("picnic table 8 ft from 2x4");
    assert.equal(p.overall.depth, 96);
    assert.ok(p.panels.filter((x) => /board/i.test(x.name)).every((x) => x.materialId === "lumber-2x4-8"));
    assert.match((p.notes ?? []).join(" "), /Not 2×4: the A-frame legs and seat supports stay 2×6/);
  });
});
