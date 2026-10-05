import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generateFromPrompt } from "./promptMain.ts";
import { buildPlan } from "./report.ts";

const plan = (p: string) => buildPlan(generateFromPrompt(p));
const all = (pl: ReturnType<typeof buildPlan>) => pl.instructions.map((s) => `${s.title} ${s.description}`).join("\n");

describe("placement follows the model's real supports", () => {
  it("cat tree: the base is set before the posts that screw to it", () => {
    const t = plan("cat tree 5 feet").instructions.map((s) => s.title);
    const base = t.findIndex((x) => /\bbase\b/i.test(x) && !/^Cut/i.test(x));
    const posts = t.findIndex((x) => /posts/i.test(x) && !/^Cut/i.test(x));
    assert.ok(base >= 0 && base < posts, t.join(" | "));
  });
  it("step stool 2 steps: rails go on the legs, then the treads go on the rails", () => {
    const pl = plan("step stool 2 steps");
    const t = pl.instructions.map((s) => s.title);
    const treads = t.findIndex((x) => /tread/i.test(x) && !/^Cut/i.test(x) && !/^Stand/i.test(x));
    const rails = t.findIndex((x) => /brace|rail/i.test(x) && !/^Cut/i.test(x));
    assert.ok(rails >= 0 && treads > rails, t.join(" | "));
    assert.doesNotMatch(all(pl), /legs and aprons/);
  });
  it("vanity: drawer fronts go on after the drawers are built and hung, once", () => {
    const pl = plan("pocket vanity");
    const t = pl.instructions.map((s) => s.title);
    const build = t.findIndex((x) => /^Build \d+ drawers/i.test(x));
    const fronts = t.findIndex((x) => /drawer fronts?/i.test(x));
    assert.ok(build >= 0 && fronts > build, t.join(" | "));
    assert.equal(t.filter((x) => /^Set the (Left|Right) drawer front/i.test(x)).length, 0);
  });
  it("linen: pinned shelves and hinged doors are never told to screw onto the uprights", () => {
    const text = all(plan("linen closet 31.5 wide 78 tall 16 deep"));
    assert.doesNotMatch(text, /Set the E Shelf 1 on the uprights|Set the Left door on/);
  });
  for (const p of ["cardboard robot", "dog bed from a pallet", "step stool 2 steps", "cat tree 5 feet"]) {
    it(`${p}: no "legs and aprons" on a build that has none`, () => {
      assert.doesNotMatch(all(plan(p)), /legs and aprons/);
    });
  }
});

describe("working parts exist before the plan claims the use", () => {
  it("kitchen chair from 1x4: seat boards cover the seat, then it sits", () => {
    const project = generateFromPrompt("kitchen chair from 1x4");
    const seat = project.panels.filter((p) => /^seat board/i.test(p.name));
    assert.ok(seat.length >= 3, `seat boards ${seat.length}`);
    const cover = seat.reduce((s, p) => s + p.size.depth, 0);
    assert.ok(cover >= (project.overall.depth - 3.5) * 0.85, `cover ${cover}`);
    assert.ok(project.panels.every((p) => p.materialId === "lumber-1x4-8"));
    const pl = buildPlan(project);
    const t = pl.instructions.map((s) => s.title);
    const seatAt = t.findIndex((x) => /seat boards/i.test(x));
    const sit = t.findIndex((x) => /sit on it/i.test(x));
    assert.ok(seatAt >= 0 && sit > seatAt, t.join(" | "));
    assert.doesNotMatch(all(pl), /lies? flat on the floor/);
  });
});

describe("Step titles use plain plurals", () => {
  it("coat rack: hat shelves, never 'shelfs'", () => {
    const plan = buildPlan(generateFromPrompt("coat rack 36 wide five hooks"));
    assert.ok(!plan.instructions.some((s) => /shelfs\b/i.test(`${s.title} ${s.description}`)), plan.instructions.map((s) => s.title).join(" | "));
  });
});
