import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generateFromPrompt } from "./promptMain.ts";
import { buildPlan } from "./report.ts";

const parts = (q: string, re: RegExp) => generateFromPrompt(q).panels.filter((p) => re.test(p.name));

describe("asked-for features are real parts, on Buy, and in the notes", () => {
  it("key holder with 4 hooks draws 4 hooks", () => {
    const p = generateFromPrompt("key holder with 4 hooks");
    assert.equal(p.panels.filter((x) => /^Coat hook \d+$/.test(x.name)).length, 4);
    assert.ok(buildPlan(p).bom.some((b) => /hooks/i.test(b.name)));
  });
  it("coat rack with 5 hooks draws 5 hooks", () => assert.equal(parts("coat rack with 5 hooks", /^Coat hook \d+$/).length, 5));
  it("wardrobe with a rod: rod part, Buy and note", () => {
    const p = generateFromPrompt("wardrobe with a rod");
    assert.ok(p.panels.some((x) => /rod/i.test(x.name)));
    assert.ok(buildPlan(p).bom.some((b) => /closet rod/i.test(b.name)));
    assert.ok(p.notes.some((n) => /closet rod/i.test(n)));
  });
  for (const q of ["spice cabinet", "display cabinet", "utility cabinet"]) it(`${q} has shelves`, () => assert.ok(parts(q, /shelf/i).length >= 1));
  for (const q of ["window seat with cubbies", "mudroom bench with cubbies"]) it(`${q} has cubbies`, () => assert.ok(parts(q, /cubby/i).length >= 1));
  it("twin loft bed: 54-60 in clear under the frame, guards and a ladder", () => {
    const p = generateFromPrompt("twin loft bed");
    const under = Math.min(...p.panels.filter((x) => /^Loft/.test(x.name)).map((x) => x.position.y));
    assert.ok(under >= 54 && under <= 60, String(under));
    assert.ok(p.panels.some((x) => /guard/i.test(x.name)) && p.panels.some((x) => /ladder rung/i.test(x.name)));
  });
  for (const q of ["hall tree", "potting bench"]) it(`${q} names its assumed depth`, () => assert.ok(generateFromPrompt(q).notes.some((n) => /Assumed .* deep/.test(n))));
});
