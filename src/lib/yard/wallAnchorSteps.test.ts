/**
 * Critic row 231: wall-anchor hardware on Buy is installed by a step. The Murphy bed bought 4 lag screws "into the
 * wall studs" and no step drove them; four record shelves and a kids bookcase bought an anti-tip kit no step fitted.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { generateFromPrompt } from "./promptMain";
import { buildPlan } from "./report";
import { i46 } from "./invariants";
import { anchorInstalled, anchorKind, fastenerId, STRUCTURAL_ID } from "./wallAnchorSteps";

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

/** Row 291: the Buy fastener lines and the steps that drive them, by id both ways. */
function tiedBothWays(q: string) {
  const p = generateFromPrompt(q);
  const pl = buildPlan(p);
  const onBuy = new Set(pl.bom.map(fastenerId));
  for (const s of pl.instructions) for (const id of s.fastenersUsed ?? []) assert.ok(onBuy.has(id), `${q}: step ${s.step} drives ${id}, not on Buy`);
  for (const b of pl.bom.filter((r) => anchorKind(r))) assert.ok(anchorInstalled(pl, b), `${q}: ${b.name} is tied to no step`);
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

test("row 291: murphy bed with shelves buys the structural screws its cleat step drives, and its lags have their step", () => {
  const pl = tiedBothWays("murphy bed with shelves");
  const cleat = pl.instructions.find((s) => /wall cleat into studs/i.test(s.title));
  assert.ok(cleat && (cleat.fastenersUsed ?? []).includes(STRUCTURAL_ID), pl.instructions.map((s) => s.title).join(" | "));
  assert.ok(pl.bom.some((b) => b.catalogId === "structural-screws"), "structural screws on Buy");
  const lag = pl.bom.find((b) => /\blag screws?\b/i.test(b.name));
  if (lag) assert.ok(pl.instructions.some((s) => (s.fastenersUsed ?? []).includes(fastenerId(lag)) && s.description.includes(lag.name)));
});

test("row 291: over-toilet builds buy no lag screws; the stud step drives the structural screws Buy lists", () => {
  for (const q of ["over-toilet shelf", "over toilet cabinet", "over-toilet storage shelf", "over the toilet cabinet 27 wide 68 high 9 deep"]) {
    const pl = tiedBothWays(q);
    assert.ok(!pl.bom.some((b) => /\blag screws?\b/i.test(b.name)), `${q}: phantom lag line`);
    const st = pl.instructions.find((s) => /over the toilet/i.test(s.title));
    assert.ok(st && (st.fastenersUsed ?? []).includes(STRUCTURAL_ID), `${q}: ${pl.instructions.map((s) => s.title).join(" | ")}`);
    assert.ok(pl.bom.some((b) => b.catalogId === "structural-screws"), `${q}: structural screws on Buy`);
  }
});

test("row 291: medicine cabinets tie their hang step to the structural screws and, on a narrow back, the rated wall anchors", () => {
  for (const q of ["medicine cabinet", "medicine cabinet 16 wide", "medicine cabinet 14 wide"]) tiedBothWays(q);
});
