/** C14 · a named small object is its real form and engine-owned: bird feeder, jewelry box, hanging and wall-mounted birdhouses (whole class). */
import test from "node:test";
import assert from "node:assert/strict";
import { SWEEPS } from "../../../scripts/class-sweep-prompts";
import { generateFromPrompt, ignoredTypedWords } from "./promptMain";
import { buildPlan } from "./report";
import { checkBuild } from "./invariants";
import { routesToLearner } from "./formOwnership";

const corpus = [...new Set<string>(Object.values(SWEEPS).flatMap((s) => s.prompts))];

test("C14: no sweep build makes a named small object a plain box or sends it to the learner (whole class)", () => {
  for (const q of corpus) {
    const p = generateFromPrompt(q);
    assert.deepEqual(checkBuild(p, q, buildPlan(p)).filter((x) => x.id === "C14").map((x) => x.msg), [], q);
  }
});

test("C14: every class prompt is engine-owned", () => {
  for (const q of SWEEPS.c14.prompts) {
    const p = generateFromPrompt(q);
    assert.equal(routesToLearner(q, p, ignoredTypedWords(p, q).length > 0), false, q);
    assert.ok(!p.standIn, q);
  }
});

test("C14: a bird feeder has a tray, clear panes and a roof, and hangs on screw eyes and chain", () => {
  const p = generateFromPrompt("bird feeder");
  const plan = buildPlan(p);
  for (const r of [/tray/i, /pane/i, /roof/i]) assert.ok(p.panels.some((x) => r.test(x.name)), String(r));
  assert.ok(plan.bom.some((b) => /screw eyes/i.test(b.name)) && plan.bom.some((b) => /chain/i.test(b.name)));
});

test("C14: a jewelry box has walls, dividers and a flat hinged lid seated on the walls", () => {
  const p = generateFromPrompt("jewelry box");
  const lid = p.panels.find((x) => x.name === "Lid")!;
  const walls = p.panels.filter((x) => / wall$/.test(x.name));
  assert.equal(walls.length, 4);
  assert.ok(lid.turns && !lid.polygon);
  assert.ok(walls.every((w) => Math.abs(w.position.y + w.size.height - lid.position.y) < 0.01));
  assert.ok(p.panels.filter((x) => /divider/i.test(x.name)).length >= 2);
});

test("C14: a hanging birdhouse has screw eyes; a wall-mounted one a mounting board and installs on the wall", () => {
  const h = generateFromPrompt("hanging birdhouse");
  assert.equal(h.panels.filter((x) => /^Screw eye \d+$/.test(x.name)).length, 2);
  const w = generateFromPrompt("wall mounted birdhouse");
  assert.ok(w.panels.some((x) => x.name === "Mounting board"));
  assert.equal(w.assumptions.installMode, "wall");
});

test("C14: craft-stick models stay the engine's stick builds", () => {
  assert.match(generateFromPrompt("craft stick bird feeder").name, /^Bird Feeder \d/);
});
