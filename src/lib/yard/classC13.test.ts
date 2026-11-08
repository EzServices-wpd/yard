/** C13 · a typed modifier or purpose survives: the purpose noun builds as itself, "outdoor" keeps exterior stock, a raised bed is open to the soil, "rolling" draws casters (whole class). */
import test from "node:test";
import assert from "node:assert/strict";
import { SWEEPS } from "../../../scripts/class-sweep-prompts";
import { generateFromPrompt } from "./promptMain";
import { buildPlan } from "./report";
import { checkBuild } from "./invariants";
import { routesToLearner } from "./formOwnership";
import { ignoredTypedWords } from "./promptMain";

const corpus = [...new Set<string>(Object.values(SWEEPS).flatMap((s) => s.prompts))];

test("C13: no sweep build loses a typed modifier or purpose (whole class)", () => {
  for (const q of corpus) {
    const p = generateFromPrompt(q);
    assert.deepEqual(checkBuild(p, q, buildPlan(p)).filter((x) => x.id === "C13").map((x) => x.msg), [], q);
  }
});

test("C13: every class prompt is engine-owned and buildable, never the learner", () => {
  for (const q of SWEEPS.c13.prompts) {
    const p = generateFromPrompt(q);
    assert.ok(p.panels.length > 2 && !p.standIn, q);
    assert.equal(routesToLearner(q, p, ignoredTypedWords(p, q).length > 0), false, q);
  }
});

test("C13: a standing desk converter has a keyboard shelf and a monitor shelf; a guitar hanger a backplate and yoke", () => {
  const c = generateFromPrompt("standing desk converter");
  assert.match(c.name, /converter/i);
  assert.ok(c.panels.some((x) => /keyboard/i.test(x.name)) && c.panels.some((x) => /monitor/i.test(x.name)));
  const g = generateFromPrompt("guitar hanger");
  assert.ok(g.panels.some((x) => /backplate/i.test(x.name)) && g.panels.filter((x) => /prong/i.test(x.name)).length === 2);
  assert.equal(g.assumptions.installMode, "wall");
});

test("C13: an outdoor storage bench is exterior boards with a hinged board lid, butt hinges and a lid stay on Buy", () => {
  const p = generateFromPrompt("outdoor storage bench");
  const plan = buildPlan(p);
  assert.ok(!p.panels.some((x) => /^plywood/.test(x.materialId)));
  assert.ok(p.panels.find((x) => x.name === "Seat lid")?.turns);
  assert.ok(plan.bom.some((b) => /stainless butt hinges/.test(b.name)) && plan.bom.some((b) => /Lid stay/.test(b.name)));
  assert.ok(!plan.bom.some((b) => /wall stud/i.test(b.name)));
});

test("C13: a raised garden bed has no bottom, no glides, and no drainage holes; 4x8 is 48 by 96", () => {
  const p = generateFromPrompt("cedar raised garden bed 4x8");
  const plan = buildPlan(p);
  assert.deepEqual([p.overall.width, p.overall.depth], [48, 96]);
  assert.ok(!p.panels.some((x) => /bottom/i.test(x.name)));
  assert.ok(!plan.bom.some((b) => /glides/i.test(b.name)));
  assert.ok(!plan.instructions.some((s) => /drainage holes/i.test(s.title)));
  assert.deepEqual([generateFromPrompt("raised garden bed 48 wide 96 long").overall.width, generateFromPrompt("raised garden bed 48 wide 96 long").overall.depth], [48, 96]);
});

test("C13: rolling puts four casters under the build, lifts it 3\", buys them and installs them last", () => {
  for (const q of ["rolling bookshelf", "kitchen island on casters", "dresser on casters"]) {
    const p = generateFromPrompt(q);
    const plan = buildPlan(p);
    const casters = p.panels.filter((x) => /^Caster \d+$/.test(x.name));
    assert.equal(casters.length, 4, q);
    assert.ok(casters.every((c) => c.position.y === 0), q);
    assert.ok(plan.bom.some((b) => /locking swivel (plate )?casters/.test(b.name) && b.quantity === 4), q);
    assert.match(plan.instructions[plan.instructions.length - 1].title + plan.instructions.map((s) => s.title).join(" "), /casters/i, q);
  }
  assert.ok(!generateFromPrompt("rolling pin").panels.some((x) => /^Caster/.test(x.name)));
});
