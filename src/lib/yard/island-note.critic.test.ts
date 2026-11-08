// Critic probe for PR #216 r2 (row 683 class, notes): every ply/layer claim in the notes, steps, Buy notes and cut notes
// must match the cut list's laminate rows. Red on ed68eb8d: the kitchen island note still says
// 'counter is two ¾" plies laminated to 1½"' while the cut list lays up 3 × ½" Counter rows. Green on release 5d1c300e.
import { it } from "node:test";
import assert from "node:assert/strict";
import { generateFromPrompt } from "./promptMain.ts";
import { buildPlan } from "./report.ts";
import { offline } from "../../../scripts/eval-lib.ts";

const CASES: [string, string?][] = [
  ["kitchen island", "plywood-1-2-4x8"],
  ["kitchen island in 1/2 inch plywood"],
  ["kitchen island 72 wide", "plywood-1-2-4x8"],
  ["rolling kitchen island", "plywood-1-2-4x8"],
  ["kitchen island 60x36x36", "plywood-1-2-4x8"],
  ["kitchen island"], // control
];
const WORD: Record<string, number> = { two: 2, three: 3, four: 4, "2": 2, "3": 3, "4": 4 };
const FR: Record<string, number> = { "¾": 0.75, "½": 0.5, "3/4": 0.75, "1/2": 0.5 };
const PLIES = /\b(two|three|four|2|3|4) (¾|½|3\/4|1\/2)"? ?(?:[A-Z][a-z]+ )?(?:plies|ply|layers)\b/g;

it("PR #216 r2 probe: notes and steps name the counter layers the cut list lays up", () =>
  offline(() => {
    const bad: string[] = [];
    for (const [q, s] of CASES) {
      const p = s ? generateFromPrompt(q, s) : generateFromPrompt(q);
      const plan = buildPlan(p);
      const layered = plan.cutList.filter((c) => /Glue up (\d+) layers/.test(c.notes ?? ""));
      const texts = [...(p.notes ?? []).map((t) => ["note", t]), ...plan.instructions.map((st) => [`step "${st.title}"`, st.description]),
        ...plan.bom.map((b) => [`buy ${b.name}`, b.notes ?? ""]), ...plan.cutList.map((c) => [`cut ${c.name}`, c.notes ?? ""])];
      for (const [src, t] of texts) for (const m of t.matchAll(PLIES)) {
        const n = WORD[m[1]], th = FR[m[2]];
        const ok = layered.some((c) => Number((c.notes ?? "").match(/Glue up (\d+) layers/)![1]) === n && Math.abs(c.thicknessIn - th) < 0.02);
        if (!ok) bad.push(`${q}${s ? ` [${s}]` : ""} · ${src}: says "${m[0]}" but the cut list lays up ${layered.map((c) => `${c.name} ${c.quantity} × ${c.thicknessIn}"`).join(", ") || "nothing"}`);
      }
    }
    assert.deepEqual(bad, []);
  }));
