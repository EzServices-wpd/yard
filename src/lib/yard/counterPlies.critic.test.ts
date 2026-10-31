// Critic probe for PR #216 (row 626): a step that names the laminate plies must match the cut list's layers.
// Red on head dbb5b0e1 (73+ builds: 1/2" sink bases, vanities, islands, desks say "two ¾" plies" while the
// cut list has 3 × ½" rows); green on release 348fa2aa (cut list and step both said 2 × ¾").
import { it } from "node:test";
import assert from "node:assert/strict";
import { generateFromPrompt } from "./promptMain.ts";
import { buildPlan } from "./report.ts";
import { offline } from "../../../scripts/eval-lib.ts";

const CASES: [string, string?][] = [
  ["sink base cabinet 48 wide in 1/2 inch plywood"],
  ["sink base cabinet 36 wide in 1/2 inch plywood"],
  ["sink base cabinet 48 wide", "plywood-1-2-4x8"],
  ["vanity 40 wide", "plywood-1-2-4x8"],
  ["kitchen island", "plywood-1-2-4x8"],
  ["desk 48x30x24 with 2 drawers", "plywood-1-2-4x8"], // one of the PR's own repro cases
  ["desk 60 wide", "plywood-1-2-4x8"],
  // controls (¾" default): must stay green
  ["sink base cabinet 48 wide"],
  ["desk 60 wide"],
];
const WORD: Record<string, number> = { two: 2, three: 3, four: 4, "2": 2, "3": 3, "4": 4 };
const FR: Record<string, number> = { "¾": 0.75, "½": 0.5, "3/4": 0.75, "1/2": 0.5 };
const PLIES = /\b(two|three|four|2|3|4) (¾|½|3\/4|1\/2)"? ?(?:[A-Z][a-z]+ )?(?:plies|ply|layers)\b/g;

it("PR #216 probe: a step's ply count and ply thickness match the cut list's laminate rows", () =>
  offline(() => {
    const bad: string[] = [];
    for (const [q, s] of CASES) {
      const p = s ? generateFromPrompt(q, s) : generateFromPrompt(q);
      const plan = buildPlan(p);
      const layered = plan.cutList.filter((c) => /Glue up (\d+) layers/.test(c.notes ?? ""));
      for (const st of plan.instructions) for (const m of st.description.matchAll(PLIES)) {
        const n = WORD[m[1]], t = FR[m[2]];
        const ok = layered.some((c) => Number((c.notes ?? "").match(/Glue up (\d+) layers/)![1]) === n && Math.abs(c.thicknessIn - t) < 0.02);
        if (!ok) bad.push(`${q}${s ? ` [${s}]` : ""} · "${st.title}": says "${m[0]}" but the cut list lays up ${layered.map((c) => `${c.name} ${c.quantity} × ${c.thicknessIn}"`).join(", ") || "nothing"}`);
      }
    }
    assert.deepEqual(bad, []);
  }));
