import assert from "node:assert/strict";
import test from "node:test";
import { generateFromPrompt } from "./promptMain.ts";
import { buildPlan } from "./report.ts";
import { planOverviewSvg } from "./planStepPicture.ts";
import { hingeSpec, leavesOf } from "./hingedLeaf.ts";

// Block 1: one module owns every hinged door and lid.
test("hinge count follows door height, lids follow weight", () => {
  assert.equal(hingeSpec({ role: "door", w: 15, h: 30, t: 0.75 }).count, 2);
  assert.equal(hingeSpec({ role: "door", w: 15, h: 50, t: 0.75 }).count, 3);
  assert.equal(hingeSpec({ role: "door", w: 15, h: 78, t: 0.75 }).count, 4);
  assert.deepEqual(hingeSpec({ role: "lid", w: 36, h: 0.75, t: 16 }).kind, "piano");
  const roof = hingeSpec({ role: "lid", w: 48, h: 0.75, t: 36, outdoor: true });
  assert.equal(roof.kind, "t-hinge");
  assert.equal(roof.stay, true);
  assert.equal(hingeSpec({ role: "door", w: 12, h: 16, t: 0.75, crate: true }).latch, "barrel bolt");
});

test("Buy, steps and the hinge rule agree for a tall closet door", () => {
  const p = generateFromPrompt("linen closet 31.5 wide 78 tall 16 deep");
  const plan = buildPlan(p);
  const hinges = plan.bom.find((b) => /concealed cabinet hinges/i.test(b.name));
  assert.ok(hinges);
  const doors = p.panels.filter((x) => x.type === "door").length;
  assert.equal(hinges!.quantity, Math.ceil((doors * 4) / 2), "4 hinges per 78\" door, bought in pairs");
  const hang = plan.instructions.find((s) => /^Hang/.test(s.title) && /door/.test(s.title));
  if (hang) assert.match(hang.title, /4 concealed hinges/);
});

test("coop roof and pop door hardware comes from the hinged parts", () => {
  const plan = buildPlan(generateFromPrompt("outdoor chicken coop 48 wide"));
  const names = plan.bom.map((b) => b.name).join(" | ");
  assert.match(names, /T-hinges/);
  assert.match(names, /galvanized butt hinges/);
  assert.match(names, /Lid stay/);
  assert.match(names, /barrel bolt/i);
  const t = plan.bom.find((b) => /T-hinges/.test(b.name))!;
  assert.notEqual(t.catalogId, "cabinet-hinges", "exterior T-hinges never price as cabinet hinges");
});

test("overview SVG marks every leaf with data-role and a hinge axis", () => {
  for (const q of ["toy chest 36 wide", "kitchen cabinet 30 wide 2 doors", "outdoor chicken coop 48 wide"]) {
    const p = generateFromPrompt(q);
    const svg = planOverviewSvg(p).svg;
    for (const l of leavesOf(p)) {
      const re = new RegExp(`<g data-part="${l.part.id}" data-role="${l.role}" data-hinge-edge="\\w+" data-hinge-axis="[-\\d., ]+">`);
      assert.match(svg, re, `${q}: ${l.part.name}`);
    }
    assert.ok(leavesOf(p).length > 0, q);
  }
});

test("no screws through a hinged part", () => {
  const p = generateFromPrompt("outdoor chicken coop 48 wide");
  const plan = buildPlan(p);
  for (const l of leavesOf(p).filter((x) => x.part.hinged)) {
    const s = plan.instructions.find((st) => (st.partsUsed ?? []).includes(l.part.name));
    assert.ok(s, l.part.name);
    assert.match(s!.description, /No screws go through/);
  }
});
