import assert from "node:assert/strict";
import test from "node:test";
import { generateFromPrompt } from "../src/lib/yard/promptMain.ts";
import { buildPlan } from "../src/lib/yard/report.ts";
import { uniqueSteps } from "../src/lib/yard/steps.ts";
import { findInterference } from "../src/lib/yard/interference.ts";
import { structureIssues } from "../src/lib/yard/structureCheck.ts";
import type { Panel } from "../src/lib/yard/types.ts";

const top = (p: Panel) => p.position.y + p.size.height;
const overlaps = (a: Panel, b: Panel) =>
  a.position.x < b.position.x + b.size.width && b.position.x < a.position.x + a.size.width &&
  a.position.z < b.position.z + b.size.depth && b.position.z < a.position.z + a.size.depth;
const on = (upper: Panel, lower: Panel) => Math.abs(upper.position.y - top(lower)) < 0.05 && overlaps(upper, lower);

for (const prompt of ["twin bunk bed", "loft bed"]) {
  test(`${prompt}: deck on slats on ledgers on rails bolted to posts, guards, ladder`, () => {
    const project = generateFromPrompt(prompt);
    const ps = project.panels;
    const decks = ps.filter((p) => p.type === "deck");
    assert.equal(decks.length, prompt === "loft bed" ? 1 : 2);
    for (const deck of decks) {
      assert.ok(Math.max(deck.size.width, deck.size.depth) >= 75 && Math.min(deck.size.width, deck.size.depth) >= 38, `${deck.name} holds a 38 × 75 twin`);
      const level = deck.name.split(" ")[0];
      const slats = ps.filter((p) => p.name.startsWith(`${level} slat`));
      assert.ok(slats.length >= 6, `${level}: slats under the deck`);
      for (const s of slats) assert.ok(on(deck, s), `${deck.name} rests on ${s.name}`);
      const ledgers = ps.filter((p) => p.name.startsWith(`${level}`) && /ledger/.test(p.name));
      assert.equal(ledgers.length, 2);
      for (const s of slats) assert.ok(ledgers.every((l) => on(s, l)), `${s.name} rests on both ledgers`);
      const rails = ps.filter((p) => p.name.startsWith(level) && /side rail|head rail|foot rail/.test(p.name));
      assert.equal(rails.length, 4, `${level}: two side rails and two end rails`);
      for (const r of rails) assert.ok(r.size.height >= 5.5 && Math.min(r.size.width, r.size.depth) === 1.5, `${r.name} is a 2×6 on edge`);
      const raised = deck.position.y > 30;
      const guards = ps.filter((p) => p.name.startsWith(level) && /guard/.test(p.name));
      if (raised) {
        assert.ok(guards.length >= 3, `${level}: guard rails on a raised deck`);
        for (const g of guards) assert.ok(top(g) >= top(deck) + 11 - 0.05, `${g.name} stands 5" over a 6" mattress`);
      }
    }
    const stiles = ps.filter((p) => /ladder stile/i.test(p.name));
    assert.equal(stiles.length, 2);
    for (const s of stiles) assert.equal(s.position.y, 0, `${s.name} stands on the floor`);
    assert.deepEqual(structureIssues(project), [], "every part on a load path");
    assert.equal(findInterference(project).length, 0);
    const steps = uniqueSteps(project).map((s) => `${s.title} ${s.description}`).join(" ");
    assert.match(steps, /Stand the four posts/);
    assert.match(steps, /side and end rails/i);
    const buy = buildPlan(project).bom.map((b) => b.name).join(" | ");
    assert.match(buy, /bed-rail bolts/i);
    assert.match(buy, /2×6|2x6/);
    assert.match(buy, /1×4|1x4/);
  });
}
