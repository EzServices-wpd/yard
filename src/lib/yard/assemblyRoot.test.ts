/**
 * One root sentence per joined assembly. A part that meets the floor and is fastened to an
 * earlier part is placed against that neighbor, never told it is the base.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { panelWorldCorners } from "./geometry.ts";
import { familyWord, placementIndex } from "./placeEveryPart.ts";
import { generateFromPrompt } from "./promptMain.ts";
import { buildPlan } from "./report.ts";
import { supportsOf } from "./supportGraph.ts";
import type { Panel } from "./types.ts";

const ROOT = /it is the base the next parts fasten to|the base the rest fastens to/i;

/** Open boxes, crates, a planter, a bench, and carcasses whose floor parts all meet. */
const PROMPTS = [
  "pine 1x6 toolbox 18 long",
  "toolbox 18 wide 18 tall 16 deep",
  "garden tote",
  "tool caddy",
  "cedar 1x6 tote 18 long",
  "record crate",
  "lp crate",
  "sandbox with seat from 2x2",
  "toy airplane with propeller from pvc",
  "cedar planter box 24 long",
  "garden bench",
  "storage bench 48 wide",
  "blanket chest",
  "toy chest",
  "window box 36 long",
  "bookcase 36 wide 72 tall 12 deep",
  "nightstand 22 wide 24 tall 16 deep",
];

const minY = (p: Panel) => Math.min(...panelWorldCorners(p).map((q) => q.y));

describe("one root per joined assembly", () => {
  for (const prompt of PROMPTS) {
    it(prompt, () => {
      const project = generateFromPrompt(prompt);
      assert.equal(project.refused, undefined, project.refused);
      const plan = buildPlan(project);
      const text = plan.instructions.map((s) => `${s.title}. ${s.description}`).join("\n");
      const roots = text.match(new RegExp(ROOT.source, "gi")) ?? [];
      assert.ok(roots.length <= 1, `${roots.length} root sentences:\n${text}`);

      const sup = supportsOf(project);
      const at = placementIndex(project, plan.instructions);
      const name = new Map(project.panels.map((p) => [p.id, p.name]));
      for (const p of project.panels) {
        if (minY(p) > 0.1) continue;
        const info = sup.get(p.id);
        if (!info || info.how === "floor" || info.how === "hinges" || info.how === "slides" || info.how === "front") continue;
        const i = at.get(p.id);
        assert.ok(i != null, `${p.name} is not placed`);
        assert.ok(info.on.length > 0, `${p.name} fastens to nobody`);
        const placed = plan.instructions[i!];
        const step = `${placed.title} ${placed.description}`;
        assert.doesNotMatch(step, ROOT, `${p.name} is still called the base`);
        for (const id of info.on) {
          const j = at.get(id);
          assert.ok(j != null && j <= i!, `${p.name} (step ${i! + 1}) before ${name.get(id)} (step ${(j ?? -2) + 1})`);
        }
        // A step that places this part on its own names the neighbor. A shared carcase step
        // ("Stand the main box") already joins the parts it lists.
        const own = new RegExp(`\\b${p.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(placed.title);
        if (own) {
          const low = step.toLowerCase();
          const named = info.on.some((id) => {
            const n = name.get(id) ?? "";
            return n && (low.includes(n.toLowerCase()) || low.includes(familyWord(n)));
          });
          assert.ok(named, `${p.name} is not named against ${info.on.map((id) => name.get(id)).join(", ")}`);
        }
      }
    });
  }

  it("a carry crate names every wall against the bottom, once", () => {
    const plan = buildPlan(generateFromPrompt("pine 1x6 toolbox 18 long"));
    const steps = plan.instructions.map((s) => `${s.title}. ${s.description}`);
    assert.equal(steps.filter((s) => ROOT.test(s)).length, 1);
    for (const part of ["Left end", "Right end", "Back side", "Front side"]) {
      const step = steps.find((s) => new RegExp(`the (?:[A-Z] )?${part}`, "i").test(s));
      assert.ok(step, part);
      assert.match(step!, new RegExp(`Fasten the (?:[A-Z] )?${part} to the (?:[A-Z] )?Bottom`, "i"));
      assert.doesNotMatch(step!, ROOT);
    }
  });
});
