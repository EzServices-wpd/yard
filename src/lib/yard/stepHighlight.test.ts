import assert from "node:assert/strict";
import test from "node:test";
import { generateFromPrompt } from "./promptMain.ts";
import { buildPlan } from "./report.ts";
import { partLetters } from "./pdfDraw.ts";
import { stepTones } from "./planStepPicture.ts";

// F12: each step's picture lights only the parts that step adds, never a part merely named in its "Where" line.
const hotNames = (q: string, title: RegExp) => {
  const p = generateFromPrompt(q);
  const plan = buildPlan(p);
  const i = plan.instructions.findIndex((s) => title.test(s.title));
  assert.ok(i >= 0, `${q}: no step ${title}`);
  const t = stepTones(p, plan, i, partLetters(p, plan.cutList)).tones;
  return [...t].filter(([, v]) => v === "hot").map(([id]) => p.panels.find((x) => x.id === id)!.name).sort();
};

test("F12 coop: frame step lights the legs and frame only; floor, walls, cleats and roost each light in their own step", () => {
  const frame = hotNames("chicken coop", /floor frame/);
  assert.ok(frame.includes("Leg 1") && frame.includes("Floor joist"));
  assert.ok(!frame.includes("Floor"), "the floor is lit in its own step");
  assert.deepEqual(hotNames("chicken coop", /^Lay the floor/), ["Floor"]);
  assert.deepEqual(hotNames("chicken coop", /^Stand the sides/), ["Back", "Left side", "Right side"]);
  assert.ok(!hotNames("chicken coop", /^Screw the cleats/).includes("Roost"));
  assert.deepEqual(hotNames("chicken coop", /^Set the roost/), ["Roost"]);
  assert.ok(!hotNames("chicken coop", /nest box/).includes("Left side"));
});

test("F12 bookshelf: cumulative part lists still light only what each step adds", () => {
  assert.deepEqual(hotNames("bookshelf", /^Attach .* Top/), ["Top"]);
  assert.deepEqual(hotNames("bookshelf", /^Attach .* Back/), ["Back"]);
});
