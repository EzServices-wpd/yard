/** #54 leftovers (I9 glides on hung builds, stud tie on Buy, I11 truss words) and I25 deterministic steps, whole class. */
import test from "node:test";
import assert from "node:assert/strict";
import { SWEEPS } from "../../../scripts/class-sweep-prompts";
import { generateFromPrompt } from "./promptMain";
import { buildPlan } from "./report";
import { buildFingerprint, checkBuild, i25, JARGON } from "./invariants";
import { hardwareSaidNotBought } from "./hardwareSaid";
import { hungBuild, takesGlides } from "./outdoor";
import { stableId, seedIds } from "../stableId";

const all = (q: string) => {
  const p = generateFromPrompt(q);
  const plan = buildPlan(p);
  return { p, plan, text: [...(p.notes ?? []), ...plan.instructions.map((s) => `${s.title} ${s.description} ${s.tips ?? ""}`), ...plan.bom.map((b) => `${b.name} ${b.notes ?? ""}`)].join("\n") };
};

test("glides: every hung build has no glide on Buy or in the notes; standing outdoor builds keep them", () => {
  for (const q of ["hanging birdhouse", "wall mounted birdhouse", "outdoor wall planter box", "outdoor hanging shelf", "hanging planter", "wall mounted outdoor planter"]) {
    const { p, text } = all(q);
    assert.ok(hungBuild(p), q);
    assert.equal(takesGlides(p), false, q);
    assert.doesNotMatch(text, /\bglides?\b/i, q);
  }
  for (const q of ["adirondack chair", "outdoor bench", "picnic table"]) assert.match(all(q).text, /\bglides?\b/i, q);
});

test("I11 glides + I9 + I11 hold over the g1 sweep (whole class)", () => {
  for (const q of SWEEPS.g1.prompts) {
    const { p, plan } = all(q);
    const v = checkBuild(p, q, plan).filter((x) => x.id === "I9" || (x.id === "I11" && /glide|truss/.test(x.msg)));
    assert.deepEqual(v.map((x) => x.msg), [], q);
  }
});

test("lighthouse and stick towers read plainly: no 'laced into a truss'", () => {
  assert.ok(JARGON.some(([re]) => re.test("Straw is thin — long members are laced into a truss.")));
  for (const q of ["model lighthouse", "popsicle stick bridge", "4 foot lattice tower from jumbo craft sticks"]) assert.doesNotMatch(all(q).text, /laced into a truss/i, q);
});

test("bunk and loft beds tie into a wall stud with corner braces that are on Buy", () => {
  for (const q of ["bunk bed", "loft bed", "bunk bed 80 long 42 wide 66 tall"]) {
    const { p, plan, text } = all(q);
    assert.match(text, /wall stud/, q);
    assert.ok(plan.bom.some((b) => /corner brace/i.test(b.name) && b.estimatedCost === 4.67), q);
    assert.deepEqual(hardwareSaidNotBought(p, plan), [], q);
  }
  const plan = (said: string, bought = "") => ({ instructions: [{ step: 1, title: "x", description: said }], bom: bought ? [{ name: bought, quantity: 1, unit: "pack" }] : [] }) as never;
  const p = { notes: [] } as never;
  assert.deepEqual(hardwareSaidNotBought(p, plan("Anchor the frame to a wall stud.")), ["stud tie"]);
  assert.deepEqual(hardwareSaidNotBought(p, plan("Anchor the frame to a wall stud.", "Furniture anti-tip kit")), []);
  assert.deepEqual(hardwareSaidNotBought(p, plan("Screw the cleat into a wall stud.")), []);
});

test("I25: every sweep prompt builds identically three times (whole class)", () => {
  const corpus = [...new Set<string>([...SWEEPS.d1.prompts, ...SWEEPS.g1.prompts, ...SWEEPS.j1.prompts, ...SWEEPS.h1.prompts])];
  for (const q of corpus) assert.deepEqual(i25(q).map((x) => x.msg), [], q);
});

test("I25 catches a random id stream, and the seeded stream is unique and repeatable", () => {
  const p = generateFromPrompt("eiffel tower");
  const shuffled = { ...p, instances: p.instances.map((x, i) => (i === 0 ? { ...x, id: `${x.id}x` } : x)) };
  assert.notEqual(buildFingerprint(shuffled), buildFingerprint(p));
  seedIds(["a"]); const a = Array.from({ length: 5000 }, () => stableId("e"));
  seedIds(["a"]); const b = Array.from({ length: 5000 }, () => stableId("e"));
  assert.deepEqual(a, b);
  assert.equal(new Set(a).size, a.length);
  // A project id stays fresh per build so the workspace sees each build as new.
  assert.notEqual(generateFromPrompt("bookcase 36 wide 72 tall 12 deep").id, generateFromPrompt("bookcase 36 wide 72 tall 12 deep").id);
});
