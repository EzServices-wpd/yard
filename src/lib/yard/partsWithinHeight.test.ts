/**
 * No part rises above the build's stated height (SWE, option (a) for the jar rack and spice rack): a jar lip on the
 * top shelf stood 1 1/4" over the uprights, so the header (the drawn 19 1/4") and the title (18") disagreed. Doors and
 * fronts with a proud-part note may pass it. Over the sizeLabels corpus; KNOWN is reported, not fixed, and may only shrink.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { generateFromPrompt } from "./promptMain";
import { headerTitle } from "./pdf";
import { buildPlan } from "./report";
import { partsAboveStatedHeight } from "./partsWithinHeight";
import { lippedShelfYs } from "./shelfLips";

const { corpus, EVAL_PROMPTS } = await import("../../../scripts/invariants-corpus");
const { SWEEPS } = await import("../../../scripts/class-sweep-prompts");
const ROLLING = ["rolling kitchen island", "kitchen island on casters", "mobile workbench", "rolling kitchen cart", "rolling bookshelf", "dresser on casters", "rolling toy chest", "rolling shoe rack", "rolling desk", "rolling tv stand"];

/** Reported to SWE (16:30 EDT), not fixed here: prompt → the parts above its stated height. */
const KNOWN: Record<string, string> = {
  "chicken tractor": "popsicle-standard", // sticks 0.137" over the stated 5.2
  "cribbage board": "Peg", // pegs stand 3/4" over the 3/4" board (its stated height is the board)
  "catapult from popsicle sticks": "popsicle-standard", // a stick 0.122" over 4 5/8
  catapult: "popsicle-standard",
};

describe("no part rises above the stated height (doors and fronts with a proud note excepted)", () => {
  it("every corpus build and every rolling build", () => {
    const all = [...new Set([...corpus(), ...EVAL_PROMPTS, ...Object.values(SWEEPS).flatMap((x) => x.prompts), ...ROLLING, "wall shelf for jars 24 wide", "spice rack"])];
    const bad: string[] = [];
    const stillKnown = new Set<string>();
    let checked = 0;
    for (const q of all) {
      const p = generateFromPrompt(q);
      if (!p.panels.length && !(p.instances ?? []).length) continue;
      checked++;
      const over = partsAboveStatedHeight(p);
      if (!over.length) continue;
      if (KNOWN[q] && over.every((o) => o.name.startsWith(KNOWN[q]))) { stillKnown.add(q); continue; }
      bad.push(`${q}: ${over.map((o) => `${o.name} +${o.over}"`).join(", ")}`);
    }
    assert.ok(checked > 300, `only ${checked} builds checked`);
    assert.deepEqual(bad, [], `${bad.length} builds have parts above their stated height:\n${bad.join("\n")}`);
    // Fixed ones leave KNOWN (the list only shrinks).
    assert.deepEqual(Object.keys(KNOWN).filter((q) => !stillKnown.has(q)), [], "KNOWN lists a build that is now within its height");
  });

  it("jar rack and spice rack: the top lip is flush with the uprights, shelves evenly spaced, one size on every label", () => {
    for (const [q, H, size] of [["wall shelf for jars 24 wide", 18, '24" W × 4" D × 18" H'], ["spice rack", 24, '36" W × 4" D × 24" H']] as const) {
      const p = generateFromPrompt(q);
      const up = p.panels.filter((x) => x.type === "upright");
      const shelves = p.panels.filter((x) => x.type === "shelf").sort((a, b) => a.position.y - b.position.y);
      const lips = p.panels.filter((x) => /jar lip/i.test(x.name)).sort((a, b) => a.position.y - b.position.y);
      assert.equal(lips.length, shelves.length, `${q}: a lip on every shelf`);
      const lipTop = lips.at(-1)!.position.y + lips.at(-1)!.size.height;
      for (const u of up) assert.equal(u.position.y + u.size.height, H, `${q}: upright top`);
      assert.equal(lipTop, H, `${q}: top lip flush with the uprights`);
      // The lip sits on its shelf's top face (it keeps its 1 1/4" above the shelf).
      lips.forEach((l, i) => assert.equal(l.position.y, shelves[i].position.y + shelves[i].size.height, `${q}: lip ${i + 1} on its shelf`));
      const gaps = shelves.slice(1).map((s, i) => s.position.y - shelves[i].position.y);
      assert.ok(gaps.every((g) => Math.abs(g - gaps[0]) < 1e-9), `${q}: shelf pitch ${gaps.join(", ")}`);
      assert.deepEqual(partsAboveStatedHeight(p), []);
      assert.ok(headerTitle(p).includes(size), `${q}: header ${headerTitle(p)}`);
      assert.match(p.name, new RegExp(`${size.split(" × ")[0].replace(/ W$/, "")} × ${H}"`), `${q}: title ${p.name}`);
      const s1 = buildPlan(p).instructions[0]?.description ?? "";
      const m = s1.match(/(\d+(?: \d+\/\d+)?)" (?:high|tall)\b/);
      if (m) assert.equal(m[1], String(H), `${q}: step 01 ${s1}`);
    }
  });

  it("lippedShelfYs: top shelf drops by the lip, even pitch from the bottom", () => {
    assert.deepEqual(lippedShelfYs(18, 3, 0.75, 1.25), [0, 8, 16]);
    assert.deepEqual(lippedShelfYs(24, 3, 0.75, 1.25), [0, 11, 22]);
    assert.deepEqual(lippedShelfYs(24, 1, 0.75, 1.25), [0]);
    assert.deepEqual(lippedShelfYs(30, 2, 0.75, 1.5, 4), [4, 27.75]);
  });
});
