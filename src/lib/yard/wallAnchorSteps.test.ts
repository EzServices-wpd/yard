/**
 * Critic row 231: wall-anchor hardware on Buy is installed by a step. The Murphy bed bought 4 lag screws "into the
 * wall studs" and no step drove them; four record shelves and a kids bookcase bought an anti-tip kit no step fitted.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { generateFromPrompt } from "./promptMain";
import { buildPlan } from "./report";
import { anchorInstalled, anchorKind } from "./wallAnchorSteps";

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
