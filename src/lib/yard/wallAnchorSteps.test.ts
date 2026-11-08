/**
 * Critic row 231: wall-anchor hardware on Buy is installed by a step. The Murphy bed bought 4 lag screws "into the
 * wall studs" and no step drove them; four record shelves and a kids bookcase bought an anti-tip kit no step fitted.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { generateFromPrompt } from "./promptMain";
import { buildPlan } from "./report";
import { i46 } from "./invariants";
import { anchorInstalled, anchorKind, fastenerId, fastenerText, STRUCTURAL_ID, tiedById } from "./wallAnchorSteps";
import type { BuildPlan } from "./types";

globalThis.fetch = (() => Promise.reject(new Error("offline"))) as typeof fetch;

test("row 231: the Murphy bed lags the cabinet to the wall studs after the back is on, before the bed is mounted", () => {
  const pl = buildPlan(generateFromPrompt("murphy bed"));
  const lag = pl.bom.find((b) => /\blag screws?\b/i.test(b.name));
  assert.ok(lag, "the Murphy bed buys lag screws");
  const at = pl.instructions.findIndex((s) => s.title === "Lag the cabinet to the wall studs");
  assert.ok(at >= 0, pl.instructions.map((s) => s.title).join(" | "));
  const st = pl.instructions[at];
  assert.ok(st.description.includes(`${lag!.quantity} × ${lag!.name}`), st.description);
  assert.match(st.description, /\bstuds?\b/);
  const backAt = pl.instructions.findIndex((s) => (s.partsUsed ?? []).includes("Back") && !/^(?:Cut|Confirm)\b/.test(s.title));
  const bedAt = pl.instructions.findIndex((s) => /fold bracket|bed frame|bed face/i.test(s.title));
  assert.ok(backAt >= 0 && backAt < at && at < bedAt, `back ${backAt} lag ${at} bed ${bedAt}`);
  assert.deepEqual(pl.instructions.map((s) => s.step), pl.instructions.map((_, i) => i + 1));
});

test("row 231 class: every wall-anchor Buy row (lags, anti-tip kits, wall anchors) has the step that installs it", () => {
  for (const q of ["murphy bed", "vinyl record shelf 36 wide", "record shelf 24 wide", "record storage shelf 30 wide", "simple bookshelf for my kids room", "medicine cabinet 16 wide", "kids bookcase"]) {
    const pl = buildPlan(generateFromPrompt(q));
    for (const b of pl.bom.filter((r) => anchorKind(r))) assert.ok(anchorInstalled(pl, b), `${q}: ${b.name} has no install step`);
  }
  // A note's other sentences stay in the notes: only the anchor sentence rides into the step.
  const kids = buildPlan(generateFromPrompt("simple bookshelf for my kids room"));
  const strap = kids.instructions.find((s) => /anti-tip/i.test(s.title));
  assert.ok(strap && !/Kids bookcase:/.test(strap.description), strap?.description);
});

/** Rows 291 and 311: the Buy fastener lines and the steps that drive them, by id both ways; never by a word. */
const carries = (s: BuildPlan["instructions"][number], id: string) => (s.fastenersUsed ?? []).some((f) => f.id === id);
function tiedBothWays(q: string) {
  const p = generateFromPrompt(q);
  const pl = buildPlan(p);
  const onBuy = new Set(pl.bom.map(fastenerId));
  for (const s of pl.instructions) for (const f of s.fastenersUsed ?? []) {
    assert.ok(onBuy.has(f.id), `${q}: step ${s.step} drives ${f.id}, not on Buy`);
    assert.ok(f.qty > 0, `${q}: step ${s.step} carries ${f.qty} × ${f.id}`);
  }
  for (const b of pl.bom.filter((r) => tiedById(r) || anchorKind(r))) assert.ok(pl.instructions.some((s) => carries(s, fastenerId(b))), `${q}: ${b.name} is tied to no step`);
  // The step names the wall fastener from its data: a structural step's words are its data's words.
  for (const s of pl.instructions) for (const f of (s.fastenersUsed ?? []).filter((x) => x.id === STRUCTURAL_ID)) assert.ok(s.description.includes(fastenerText(f)), `${q}: step ${s.step} carries ${f.id} but does not say it`);
  assert.deepEqual(i46(p, pl), [], q);
  return pl;
}

test("row 291: a step that only says 'lag' does not install a lag line; the tie is by id", () => {
  const pl = buildPlan(generateFromPrompt("murphy bed"));
  const lag = pl.bom.find((b) => /\blag screws?\b/i.test(b.name))!;
  const bare = { ...pl, instructions: pl.instructions.map((s) => ({ ...s, fastenersUsed: undefined })) };
  assert.equal(anchorInstalled(bare, lag), false, "a 'Lag …' title alone is not the install");
  assert.equal(anchorInstalled(pl, lag), true);
});

test("row 312: murphy bed with shelves has no phantom cleat step and no structural line no step drives; only the step that drives a fastener carries it", () => {
  const pl = tiedBothWays("murphy bed with shelves");
  assert.ok(!pl.instructions.some((s) => /wall cleat/i.test(s.title)), pl.instructions.map((s) => s.title).join(" | "));
  assert.ok(!pl.bom.some((b) => b.catalogId === "structural-screws"), "no structural line without a step that drives it");
  const lag = pl.bom.find((b) => /\blag screws?\b/i.test(b.name))!;
  const lagSteps = pl.instructions.filter((s) => carries(s, fastenerId(lag)));
  assert.equal(lagSteps.length, 1);
  assert.ok(lagSteps[0].description.includes(lag.name));
  for (const s of pl.instructions) if (/#8 × 1 1\/4" screws/.test(s.description)) assert.ok(!carries(s, STRUCTURAL_ID), `step ${s.step}: #8 text tied to structural screws`);
});

test("rows 291 and 313: over-toilet builds buy no lag screws, say no lag, and the stud step drives the structural screws Buy lists", () => {
  for (const q of ["over-toilet shelf", "over toilet cabinet", "over-toilet storage shelf", "over the toilet cabinet 27 wide 68 high 9 deep"]) {
    const pl = tiedBothWays(q);
    assert.ok(!pl.bom.some((b) => /\blag screws?\b/i.test(b.name)), `${q}: phantom lag line`);
    const st = pl.instructions.find((s) => /over the toilet/i.test(s.title));
    assert.ok(st && carries(st, STRUCTURAL_ID), `${q}: ${pl.instructions.map((s) => s.title).join(" | ")}`);
    assert.doesNotMatch(`${st!.title} ${st!.description}`, /\blag\b/i, q);
    assert.ok(pl.bom.some((b) => b.catalogId === "structural-screws"), `${q}: structural screws on Buy`);
  }
});

test("row 291: medicine cabinets tie their hang step to the structural screws and, on a narrow back, the rated wall anchors", () => {
  for (const q of ["medicine cabinet", "medicine cabinet 16 wide", "medicine cabinet 14 wide"]) tiedBothWays(q);
});

test("row 310: the fold-down bed buys the structural screws its hang step drives", () => {
  const pl = tiedBothWays("fold-down bed");
  const hang = pl.instructions.find((s) => carries(s, STRUCTURAL_ID));
  assert.ok(hang, pl.instructions.map((s) => s.title).join(" | "));
  assert.ok(pl.bom.some((b) => fastenerId(b) === STRUCTURAL_ID), "structural screws on Buy");
});

test("row 311: a wall-mounted drop-leaf table has the step that screws it to the studs, not a pointer to a missing one", () => {
  const pl = tiedBothWays("wall mounted drop leaf table");
  assert.ok(!pl.instructions.some((s) => /in the hang step/.test(s.description)));
  const st = pl.instructions.find((s) => carries(s, STRUCTURAL_ID));
  assert.ok(st && /\bstuds\b/.test(st.title), pl.instructions.map((s) => s.title).join(" | "));
});

test("row 311: the pegboard names no lag or masonry anchor it does not buy", () => {
  const p = generateFromPrompt("pegboard");
  const pl = tiedBothWays("pegboard");
  const words = [...(p.notes ?? []), ...pl.bom.map((b) => `${b.name} ${b.notes ?? ""}`), ...pl.instructions.map((s) => `${s.title} ${s.description}`)].join(" ");
  assert.doesNotMatch(words, /\blag\b|masonry anchors/i);
});

test("row 311: every wall-hung build ties its wall fasteners by id both ways", () => {
  for (const q of ["floating shelves", "wall shelf", "wall mounted desk 36 wide", "fold down desk", "wall mounted spice rack", "wall mounted wine rack", "corner shelf", "wall-hung bookshelf"]) tiedBothWays(q);
});
