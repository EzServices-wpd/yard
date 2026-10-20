import assert from "node:assert/strict";
import test from "node:test";
import { generateFromPrompt } from "./promptMain";
import { i41 } from "./invariants";
import { isCasterPart } from "./casterParts";
import { typedFeatures } from "./typedFeatures";

globalThis.fetch = (() => Promise.reject(new Error("offline"))) as typeof fetch;
const doors = (q: string) => generateFromPrompt(q).panels.filter((x) => x.type === "door").length;
const fronts = (q: string) => generateFromPrompt(q).panels.filter((x) => x.drawerPart === "front").length;
const casters = (q: string) => generateFromPrompt(q).panels.filter(isCasterPart).length;

test("C41: feature words are read after the head noun, never inside it or when taken away", () => {
  assert.deepEqual(typedFeatures("kitchen cart with doors on casters"), ["doors", "casters"]);
  assert.deepEqual(typedFeatures("bench with drawers"), ["drawers"]);
  assert.deepEqual(typedFeatures("chest with a lid"), ["lid"]);
  assert.deepEqual(typedFeatures("chest of drawers"), []);
  assert.deepEqual(typedFeatures("cabinet with no doors"), []);
  assert.deepEqual(typedFeatures("prehung door 36x80"), []);
});

test("C41: kitchen cart with doors on casters is a cart with doors and casters (was a prehung door)", () => {
  for (const q of ["kitchen cart with doors on casters", "kitchen cart with 2 doors on casters", "kitchen cart with doors and casters", "kitchen cart with doors and wheels"]) {
    const p = generateFromPrompt(q);
    assert.match(p.name, /\bcart\b/i, q);
    assert.notEqual(p.kind, "opening", q);
    assert.equal(doors(q), 2, q);
    assert.equal(casters(q), 4, q);
    assert.deepEqual(i41(p, q), [], q);
  }
});

test("C41: bench with drawers builds a bench with hollow drawers under the seat", () => {
  for (const [q, n] of [["bench with drawers", 2], ["bench with 3 drawers", 3], ["storage bench with drawers", 2]] as const) {
    const p = generateFromPrompt(q);
    assert.match(p.name, /\bbench\b/i, q);
    assert.equal(fronts(q), n, q);
    assert.ok(p.panels.some((x) => x.name === "Seat"), q);
    assert.ok(!p.panels.some((x) => /^Cubby divider/.test(x.name)), q);
    assert.deepEqual(i41(p, q), [], q);
  }
});

test("C41: chest with a lid is a chest with its lid", () => {
  const p = generateFromPrompt("chest with a lid");
  assert.match(p.name, /\bchest\b/i);
  assert.ok(p.panels.some((x) => /\blid\b/i.test(x.name)));
  assert.deepEqual(i41(p, "chest with a lid"), []);
});

test("C41: a door is the build only when it is the head noun", () => {
  for (const q of ["prehung door 36x80", "exterior door 36 x 80", "36in by 80in door", "pocket door 30 inch"]) assert.equal(generateFromPrompt(q).kind, "opening", q);
});

test("C41 sweep: every feature word on 12 head nouns is built or noted, and never picks the family", () => {
  const heads = ["kitchen cart", "bench", "chest", "bookcase", "cabinet", "nightstand", "tv stand", "toy box", "workbench", "desk", "dresser", "island"];
  const feats = ["with doors", "with drawers", "with a lid", "on wheels", "on casters", "with shelves", "with 2 doors on casters"];
  const bad: string[] = [];
  for (const h of heads) for (const f of feats) {
    const q = `${h} ${f}`;
    const vs = i41(generateFromPrompt(q), q);
    if (vs.length) bad.push(`${q}: ${vs.map((v) => v.msg).join("; ")}`);
  }
  assert.deepEqual(bad, []);
});

test("C41 after #103: a refused build (too small to hold its parts) drops no typed feature: it builds nothing and says why", () => {
  for (const q of ["bookcase 1/2 wide with doors", "cabinet 1/2 wide with 2 drawers"]) {
    const p = generateFromPrompt(q);
    assert.ok(p.refused, `${q} is refused`);
    assert.equal(p.panels.length, 0);
    assert.deepEqual(i41(p, q), [], q);
  }
});

test("C41 / row 176: every drawer and door the build carries has its steps, and every slide on Buy is hung", async () => {
  const { buildPlan } = await import("./report");
  const { drawerBoxes } = await import("./hollowDrawers");
  const heads = ["kitchen cart", "bench", "entry bench", "shoe bench", "storage bench", "chest", "bookcase", "cabinet", "nightstand", "tv stand", "toy box", "workbench", "desk", "dresser", "island"];
  const feats = ["with doors", "with drawers", "with 3 drawers", "with a drawer", "with 2 doors on casters", "with a drawer and a door"];
  const bad: string[] = [];
  for (const h of heads) for (const f of feats) {
    const q = `${h} ${f}`;
    const p = generateFromPrompt(q);
    if (p.refused || p.shape) continue;
    const plan = buildPlan(p);
    const titles = plan.instructions.map((s) => s.title);
    const slides = plan.bom.filter((b) => /drawer slides?/i.test(b.name));
    if (drawerBoxes(p.panels).length) {
      if (!titles.some((t) => /^Build\b.*\bdrawer/i.test(t))) bad.push(`${q}: no build-drawers step`);
      if (!titles.some((t) => /^Fit\b.*\bdrawer front/i.test(t))) bad.push(`${q}: no fit-fronts step`);
      if (slides.length && !titles.some((t) => /^Hang\b.*\bdrawers?\b.*slides/i.test(t))) bad.push(`${q}: slides on Buy never hung`);
    }
    if (p.panels.some((x) => x.type === "door") && !titles.some((t) => /\bdoors?\b/i.test(t))) bad.push(`${q}: no hang-doors step`);
  }
  assert.deepEqual(bad, []);
});
