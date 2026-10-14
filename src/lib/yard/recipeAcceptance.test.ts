/** Spec 001 acceptance: the 25 novel prompts of grade 2da150e. */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generateFromPrompt } from "./promptMain.ts";
import { buildRecipe, validateRecipe } from "./recipeBuild.ts";
import { findRecipe } from "./recipes.ts";
import { structureIssues } from "./structureCheck.ts";
import { buildPlan } from "./report.ts";

// prompt → recipe key, the roles that must be built, and typed checks.
const RECIPE: [string, string, Record<string, number>?][] = [
  ["popsicle stick ferris wheel", "ferris-wheel"],
  ["balsa glider", "glider"],
  ["2x4 scrap reindeer", "reindeer"],
  ["cardboard marble run", "marble-run"],
  ["dowel tipi for kids", "tipi"],
  ["popsicle stick treasure chest with lid", "treasure-chest"],
  ["pine toy airplane with spinning propeller", "toy-airplane"],
  ["pressure-treated deck stairs 3 steps", "deck-stairs", { Tread: 3 }],
  ["cedar compost bin 3 bays", "compost-bin", { "Back slats": 3 }],
  ["pergola 10x10", "pergola", { width: 120, depth: 120 }],
  ["kids sandbox with corner seats", "sandbox"],
  ["Taj Mahal cardboard", "taj-mahal"],
  ["Colosseum from cardboard", "colosseum"],
  ["floating desk 48 wide", "floating-desk", { width: 48 }],
  ["mudroom locker 3 bays", "mudroom-locker", { "Coat hook": 3 }],
  ["under-stairs shelf", "under-stairs-shelf"],
  ["murphy bed queen", "murphy-bed"],
];
// Prompts an engine family already builds (graded on their own fixes, Critic items 3, 6, 7).
const ENGINE = ["cedar garden arbor", "bat house", "Eiffel Tower from 2x4", "Brooklyn Bridge popsicle sticks", "Statue of Liberty from dowels", "Tower Bridge London popsicle", "broom closet 18 wide 84 tall 14 deep", "wall cabinet over toilet 24 wide"];

describe("recipe acceptance (grade 2da150e)", () => {
  for (const [q, key, want] of RECIPE) {
    it(q, () => {
      const r = findRecipe(q);
      assert.equal(r?.key, key);
      assert.deepEqual(validateRecipe(r!, buildRecipe(r!, q), q), []);
      const p = generateFromPrompt(q);
      assert.deepEqual(structureIssues(p).map((i) => `${i.code}:${i.part}`), []);
      for (const role of r!.defining ?? []) {
        const names = r!.parts.filter((x) => x.role === role).map((x) => x.name);
        assert.ok(p.panels.some((x) => names.includes(x.name.replace(/ \d+$/, "")) || names.includes(x.name)), `${role} built`);
      }
      for (const [k, v] of Object.entries(want ?? {})) {
        if (k === "width" || k === "depth" || k === "height") assert.equal(p.overall[k], v, k);
        // A slatted wall split into boards is still one part (its boards share the wall's id).
        else assert.equal(new Set(p.panels.filter((x) => x.name.replace(/ \d+$/, "") === k).map((x) => x.id.replace(/-s\d+$/, ""))).size, v, k);
      }
    });
  }
  for (const q of ENGINE) {
    it(`${q} keeps its engine build, not a closed shell`, () => {
      assert.equal(findRecipe(q), null);
      const p = generateFromPrompt(q);
      assert.ok(p.panels.length + p.instances.length >= 3);
    });
  }
  it("all 25 prompts are covered", () => assert.equal(RECIPE.length + ENGINE.length, 25));
});

describe("recipe stock switch (Critic item 3)", () => {
  const ids = (q: string, o?: string) => { const p = generateFromPrompt(q, o); return { p, m: (n: string) => p.panels.find((x) => x.name.replace(/ \d+$/, "") === n)?.materialId }; };
  it("keeps exact W×D×H and the form; skins switch, posts keep their section", () => {
    const a = ids("cedar compost bin 3 bays"), b = ids("cedar compost bin 3 bays", "plywood-3-4-4x8");
    assert.deepEqual(b.p.overall, a.p.overall);
    assert.equal(b.p.panels.length, a.p.panels.length);
    assert.equal(a.m("Back post"), "lumber-4x4-8");
    assert.equal(b.m("Back post"), "lumber-4x4-8");
    assert.equal(b.m("Back slats"), "plywood-3-4-4x8");
  });
  it("refuses craft stock on a full-size recipe, plainly", () => {
    const { p, m } = ids("pergola 10x10", "popsicle-standard");
    assert.equal(m("Post"), "lumber-4x4-8");
    assert.ok(p.notes.some((n) => /can't carry a pergola/.test(n)));
  });
});

describe("Buy carries every drawn and noted hardware item (Critic item 6)", () => {
  const cases: [string, RegExp[]][] = [
    ["popsicle stick treasure chest with lid", [/hinge/i, /latch/i, /popsicle/i]],
    ["mudroom locker 3 bays", [/coat hook/i]],
    ["murphy bed queen", [/folding leg bracket/i, /lag screw/i]],
    ["bat house", [/caulk/i, /paint/i]],
    ["kids sandbox with corner seats", [/landscape fabric/i]],
    ["dowel tipi for kids", [/canvas/i, /dowel/i]],
  ];
  for (const [q, want] of cases) it(q, () => {
    const names = buildPlan(generateFromPrompt(q)).bom.map((b) => b.name).join(" | ");
    for (const re of want) assert.match(names, re);
  });
});

describe("outdoor package (Critic item 7)", () => {
  const buy = (q: string) => buildPlan(generateFromPrompt(q)).bom.map((b) => b.name).join(" | ");
  it("anything outdoors gets exterior screws", () => {
    for (const q of ["bat house", "cedar compost bin 3 bays"]) assert.match(buy(q), /exterior-coated/);
  });
  it("posts over 48in outdoors are 4x4", () => {
    const p = generateFromPrompt("cedar garden arbor");
    assert.ok(p.instances.filter((i) => i.role === "leg").every((i) => i.catalogId === "lumber-4x4-8"));
  });
  it("glides only on things with feet", () => {
    assert.doesNotMatch(buy("sandbox cover"), /glides/);
    assert.match(buy("picnic table"), /glides/);
  });
});
