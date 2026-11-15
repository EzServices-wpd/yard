/**
 * Class I7: a horizontal panel (shelf, bottom, top) may not ship past the house span limit.
 * A center support under it is a real part: model, cut list, Buy screws, and a step that
 * stands it on the floor before the panel it carries.
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, it } from "node:test";
import { generateFromPrompt } from "./promptMain.ts";
import { buildPlan } from "./report.ts";
import { spanFindings } from "./spanCheck.ts";
import { placementIndex } from "./placeEveryPart.ts";
import { stepScrewCount } from "./stepJointScrews.ts";

const FAMILIES: [string, string][] = [
  ["sideboard", "34 tall 18 deep"],
  ["credenza", "30 tall 18 deep"],
  ["TV stand", "24 tall 16 deep"],
  ["bookcase", "72 tall 12 deep"],
  ["cabinet", "36 tall 18 deep"],
  ["dresser", "36 tall 18 deep"],
  ["bench", "18 tall 16 deep"],
];
/** Under the limit, just over it, and well past it. 36" inside a 3/4" case still clears the 33" limit with the 1.1 tolerance. */
const WIDTHS = [30, 36, 42, 48, 54, 72, 96];

describe("house span: no shipped horizontal past its stock limit", () => {
  for (const [noun, rest] of FAMILIES) {
    for (const width of WIDTHS) {
      const prompt = `${noun} ${width} wide ${rest}`;
      it(prompt, () => {
        const project = generateFromPrompt(prompt);
        if (project.refused || !project.panels.length) {
          assert.equal(project.panels.length, 0, prompt);
          assert.deepEqual(spanFindings(project), []);
          return;
        }
        const plan = buildPlan(project);
        assert.deepEqual(
          spanFindings(project).map((f) => `${f.name} ${Math.round(f.span)}>${Math.round(f.allow)}`),
          [],
          prompt,
        );
        const screws = plan.bom.find((b) => /screws from the model's joints/.test(b.notes ?? ""));
        if (screws) {
          const bought = Number(screws.notes?.match(/(\d+) screws/)?.[1]);
          assert.equal(stepScrewCount(plan), bought, prompt);
        }
        const at = placementIndex(project, plan.instructions);
        const added = project.panels.filter((p) => p.type === "cleat" && p.name.startsWith("Center support"));
        const cuts = plan.cutList.filter((c) => /^Center support\b/i.test(c.name));
        if (added.length) {
          assert.equal(cuts.reduce((n, c) => n + c.quantity, 0), added.length, `${prompt}: cut list count`);
        }
        const dims = (w: number, h: number, d: number) => [w, h, d].map((n) => Math.round(n * 8) / 8).sort((a, b) => b - a);
        for (const support of added) {
          const want = dims(support.size.width, support.size.height, support.size.depth);
          const cut = cuts.find((c) => dims(c.lengthIn, c.widthIn, c.thicknessIn).every((n, i) => Math.abs(n - want[i]) < 0.02));
          assert.ok(cut, `${prompt}: ${support.name} missing from the cut list`);
          const step = at.get(support.id);
          assert.equal(typeof step, "number", `${prompt}: ${support.name} has no step`);
          const carried = project.panels.find(
            (p) => p !== support && Math.abs(p.position.y - (support.position.y + support.size.height)) <= 0.35 && p.size.height < 2,
          );
          if (carried) {
            const later = at.get(carried.id);
            assert.ok(later != null && step! < later, `${prompt}: ${support.name} is fastened before ${carried.name} is placed`);
          }
          const text = plan.instructions.map((s) => `${s.title} ${s.description}`).join("\n");
          assert.match(text, new RegExp(support.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
        }
      });
    }
  }
});

describe("span canaries stay the release build", () => {
  it("linen cabinet 31.5 × 78 × 16 is 11 parts, 8 Buy lines, 9 steps, $193.68", () => {
    for (const prompt of ["linen cabinet 31.5 wide 78 tall 16 deep", "linen closet 31.5 wide 78 tall 16 deep"]) {
      const project = generateFromPrompt(prompt);
      const plan = buildPlan(project);
      assert.deepEqual([project.overall.width, project.overall.height, project.overall.depth], [31.5, 78, 16], prompt);
      assert.equal(plan.totals.pieces, 11, prompt);
      assert.equal(plan.bom.length, 8, prompt);
      assert.equal(plan.instructions.length, 9, prompt);
      assert.equal(plan.totals.estCostUsd, 193.68, prompt);
      const hash = createHash("sha256").update(plan.instructions.map((s) => `${s.step}|${s.title}|${s.description}`).join("\n")).digest("hex").slice(0, 16);
      assert.equal(hash, "2bb9e7d5e3d43112", prompt);
    }
  });

  it("pocket vanity, Andersen 36×48, desk 60×30×29, and the popsicle Eiffel keep their counts", () => {
    const pin = (prompt: string, cost: number, pieces: number, bom: number, steps: number) => {
      const project = generateFromPrompt(prompt);
      const plan = buildPlan(project);
      assert.equal(plan.totals.estCostUsd, cost, prompt);
      assert.equal(plan.totals.pieces, pieces, prompt);
      assert.equal(plan.bom.length, bom, prompt);
      assert.equal(plan.instructions.length, steps, prompt);
    };
    pin("pocket vanity", 636.23, 50, 15, 17);
    pin("Andersen 36x48", 439.26, 14, 8, 10);
    pin("desk 60x30x29", 381.97, 41, 8, 12);
    pin("3 foot Eiffel Tower from popsicle sticks", 19.96, 784, 2, 10);
    const eiffel = buildPlan(generateFromPrompt("3 foot Eiffel Tower from popsicle sticks"));
    const andersen = buildPlan(generateFromPrompt("Andersen 36x48"));
    const hash = (plan: ReturnType<typeof buildPlan>) =>
      createHash("sha256").update(plan.instructions.map((s) => `${s.step}|${s.title}|${s.description}`).join("\n")).digest("hex").slice(0, 16);
    assert.equal(hash(andersen), "897052ca411715ec");
    assert.equal(hash(eiffel), "313e45c392b40b22");
  });
});
