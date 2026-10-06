import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generateFromPrompt } from "./promptMain.ts";
import { buildPlan } from "./report.ts";
import { supportsOf } from "./supportGraph.ts";
import { placementIndex } from "./placeEveryPart.ts";

const CRAFT = /popsicle|craft|cardboard|toothpick|skewer|balsa/;

describe("Furniture with no stock typed is real wood at real size", () => {
  for (const prompt of ["adirondack chair", "porch swing", "picnic table", "bunk bed", "potting bench", "bed frame"]) {
    it(prompt, () => {
      const project = generateFromPrompt(prompt);
      const plan = buildPlan(project);
      assert.ok(!CRAFT.test(project.primaryMaterialId), project.primaryMaterialId);
      assert.ok(!plan.cutList.some((c) => CRAFT.test(`${c.name} ${c.material}`.toLowerCase())), "no craft stock on the cut list");
      assert.ok(Math.max(project.overall.width, project.overall.height, project.overall.depth) >= 30, "real size");
    });
  }
  it("craft stock only when typed", () => {
    assert.equal(generateFromPrompt("popsicle stick adirondack chair").primaryMaterialId, "popsicle-standard");
    assert.equal(generateFromPrompt("doll bed").primaryMaterialId, "popsicle-standard");
  });
  it("a 2x frame buys screws long enough for 1 1/2 inch stock, and step 1 says the stock was picked", () => {
    const plan = buildPlan(generateFromPrompt("adirondack chair"));
    assert.ok(plan.bom.some((b) => /#8 × 2-1\/2" wood screws/.test(b.name)), plan.bom.map((b) => b.name).join(" | "));
    assert.match(plan.instructions[0].description, /No material typed/);
  });
});

describe("A wall-hung piece mounts to the wall, not the floor", () => {
  for (const prompt of ["coat rack 36 wide five hooks", "spice rack", "wall cabinet 24 wide 30 tall"]) {
    it(prompt, () => {
      const plan = buildPlan(generateFromPrompt(prompt));
      const text = plan.instructions.map((s) => `${s.title} ${s.description}`).join(" ");
      assert.ok(!/on the floor/i.test(text), text.match(/[^.]*on the floor[^.]*/i)?.[0]);
      assert.match(text, /\bstuds?\b/);
    });
  }
  it("bought hooks are not in the cut step", () => {
    const plan = buildPlan(generateFromPrompt("coat rack 36 wide five hooks"));
    assert.ok(!/Coat hook/.test(plan.instructions[0].description), plan.instructions[0].description);
  });
});

describe("Drawer boxes go in by the drawer steps, after their supports", () => {
  for (const prompt of ["pocket vanity", "60\" desk", "nightstand"]) {
    it(prompt, () => {
      const project = generateFromPrompt(prompt);
      const plan = buildPlan(project);
      const at = placementIndex(project, plan.instructions);
      const sup = supportsOf(project);
      for (const d of project.panels.filter((p) => p.type === "drawer")) {
        const i = plan.instructions.findIndex((s) => /drawer/i.test(s.title) && (s.partsUsed ?? []).includes(d.name));
        assert.ok(i >= 0, `${d.name} is in a drawer step`);
        for (const k of sup.get(d.id)?.on ?? []) assert.ok((at.get(k) ?? -1) <= i, `${d.name} after its support`);
      }
      assert.ok(!plan.instructions.some((s) => /^Set the (?:Left |Right )?Drawer front/.test(s.title)), "the drawer-front step places the drawer front");
    });
  }
});

describe("Stick groups build up from the frame, never in a loop", () => {
  for (const prompt of ["catapult", "birdhouse", "adirondack chair", "garden arch from pvc", "popsicle stick eiffel tower"]) {
    it(prompt, () => {
      const project = generateFromPrompt(prompt);
      const sup = supportsOf(project);
      const seen = new Set<string>();
      const visit = (k: string, path: string[]): void => {
        assert.ok(!path.includes(k), `loop ${[...path, k].join(" > ")}`);
        if (seen.has(k)) return;
        seen.add(k);
        for (const n of sup.get(k)?.on ?? []) visit(n, [...path, k]);
      };
      for (const k of sup.keys()) visit(k, []);
    });
  }
  it("a stick tower's own steps place its sticks (no trailing Set the N legs steps)", () => {
    const plan = buildPlan(generateFromPrompt("popsicle stick eiffel tower"));
    assert.ok(!plan.instructions.some((s) => /^Set the \d+ /.test(s.title)), plan.instructions.map((s) => s.title).join(" | "));
  });
  it("catapult: the arm goes on before the cup at its tip", () => {
    const titles = buildPlan(generateFromPrompt("catapult")).instructions.map((s) => s.title);
    assert.ok(titles.findIndex((t) => /arm/i.test(t)) < titles.findIndex((t) => /\bcup\b/i.test(t)), titles.join(" | "));
  });
});

describe("Outdoor seat family has seat and back, and Buy screw length matches the cart", () => {
  it("adirondack chair", () => {
    const project = generateFromPrompt("adirondack chair");
    const plan = buildPlan(project);
    const roles = (project.instances ?? []).map((i) => i.role ?? "");
    assert.ok(roles.includes("leg"), "legs");
    assert.ok(roles.includes("seat"), `seat in ${roles.join(",")}`);
    assert.ok(roles.includes("back"), `back in ${roles.join(",")}`);
    assert.ok(!roles.includes("ring"), "no rings");
    const screw = plan.bom.find((b) => /#8.*wood screws/i.test(b.name));
    assert.ok(screw, "Buy lists #8 screws");
    assert.match(screw!.name, /2-1\/2/);
    const offerTitles = (screw!.offers ?? []).map((o) => o.title).join(" | ");
    assert.match(offerTitles, /2-1\/2/, offerTitles);
    assert.doesNotMatch(offerTitles, /1-1\/4/, offerTitles);
    assert.ok(plan.instructions.some((s) => /seat/i.test(s.title)), plan.instructions.map((s) => s.title).join(" | "));
    assert.ok(plan.instructions.some((s) => /back/i.test(s.title)), plan.instructions.map((s) => s.title).join(" | "));
  });
});

describe("A birdhouse with no stock typed is real board at real size", () => {
  for (const prompt of ["birdhouse", "wood birdhouse", "bluebird house"]) {
    it(prompt, () => {
      const project = generateFromPrompt(prompt);
      assert.equal(project.primaryMaterialId, "lumber-1x6-8");
      assert.ok(project.overall.height >= 10, `real size, got ${project.overall.height}`);
      assert.ok(buildPlan(project).bom.some((b) => /1×6 Board/.test(b.name)), "Buy list buys the 1×6");
    });
  }
  it("typed craft stock or a toy stays a model", () => {
    assert.equal(generateFromPrompt("popsicle stick birdhouse").primaryMaterialId, "popsicle-standard");
    assert.ok(CRAFT.test(generateFromPrompt("toy birdhouse").primaryMaterialId));
  });
});
