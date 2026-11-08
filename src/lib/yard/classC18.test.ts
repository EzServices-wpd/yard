/** C18 · C19 (whole class): typed finish renders and is on Buy; size steps re-derive counts, never refused. */
import test from "node:test";
import assert from "node:assert/strict";
import { SWEEPS } from "../../../scripts/class-sweep-prompts";
import { generateFromPrompt } from "./promptMain";
import { buildPlan } from "./report";
import { checkBuild } from "./invariants";
import { typedFinish, paintedSqFt, finishQuarts } from "./typedFinish";
import { panelRenderLook } from "./partStock";
import { refineProject } from "./refine";

const build = (q: string) => { const p = generateFromPrompt(q); return { p, plan: buildPlan(p) }; };

for (const id of ["C18", "C19"] as const) {
  test(`${id}: no sweep build violates it (whole class)`, () => {
    const corpus = [...new Set<string>([...SWEEPS.c18.prompts, ...SWEEPS.c19.prompts])];
    for (const q of corpus) { const { p, plan } = build(q); assert.deepEqual(checkBuild(p, q, plan).filter((x) => x.id === id).map((x) => x.msg), [], q); }
  });
}

test("C18: black bookshelf renders black and buys black paint sized by area, with a link", () => {
  const { p, plan } = build("black bookshelf 36x12x72");
  const f = typedFinish(p.prompt)!;
  assert.equal(f.key, "black");
  for (const x of p.panels) assert.equal(panelRenderLook(p.prompt ?? "", x).tone, f.tone, x.name);
  const row = plan.bom.find((b) => b.name === f.product.name)!;
  assert.ok(row && row.offers!.some((o) => o.href.includes("homedepot.com/p/")));
  assert.equal(row.quantity, finishQuarts(f, paintedSqFt(plan)));
  assert.ok(plan.instructions.some((s) => s.title === "Paint it black"));
  const sum = Math.round(plan.bom.reduce((t, b) => t + (b.estimatedCost ?? 0), 0) * 100) / 100;
  assert.equal(plan.totals.estCostUsd, sum);
});

test("C18: species words are wood, not colours; untyped builds get no paint", () => {
  for (const q of ["black walnut bookshelf", "white oak bench", "red oak table", "red cedar planter", "bookshelf 36x12x72", "linen closet 31.5 wide 78 tall 16 deep"]) assert.equal(typedFinish(q), null, q);
  assert.equal(typedFinish("stained nightstand")!.kind, "stain");
  assert.equal(typedFinish("painted bench")!.key, "white");
});

test("C19: black bookshelf takes Wider twice (center supports re-derive), cut list and Buy stay in sync", () => {
  let p = generateFromPrompt("black bookshelf 36x12x72");
  for (const w of [38, 40]) {
    const r = refineProject(p, "2 inches wider");
    assert.deepEqual(r.refused, []);
    p = r.project!;
    assert.equal(p.overall.width, w);
  }
  assert.ok(p.panels.some((x) => x.type === "divider"));
  const plan = buildPlan(p);
  assert.deepEqual(checkBuild(p, p.prompt ?? "", plan).filter((x) => x.id === "I3" || x.id === "C15" || x.id === "C19").map((x) => x.msg), []);
});

test("C19: count steps still keep the form (a size step frees only derived counts)", () => {
  const p = generateFromPrompt("bookshelf 36x12x72");
  const r = refineProject(p, "2 inches taller");
  assert.ok(r.project && !r.refused.length);
  assert.equal(r.project.panels.filter((x) => x.type === "door").length, p.panels.filter((x) => x.type === "door").length);
});
