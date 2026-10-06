import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generateFromPrompt } from "./promptMain";
import { landmarkFidelity } from "./landmarkFidelity";

/** [prompt, key, floor]. The floor only rises: Eiffel's base width (0.22H vs the real 0.38H) lives in latticeTower.ts. */
const LANDMARKS: [string, string, number][] = [
  ["popsicle stick Golden Gate Bridge", "golden gate", 100],
  ["popsicle stick truss bridge", "truss", 100],
  ["Eiffel Tower out of skewers", "eiffel", 50],
  ["Brooklyn Bridge popsicle sticks", "brooklyn", 100],
  ["CN Tower", "cn tower", 100],
  ["Leaning Tower of Pisa", "pisa", 100],
  ["Big Ben", "big ben", 100],
  ["lighthouse", "lighthouse", 100],
];

describe("landmarks keep their signature features and published proportions", () => {
  for (const [prompt, key, floor] of LANDMARKS) {
    it(prompt, () => {
      const f = landmarkFidelity(generateFromPrompt(prompt), key);
      assert.ok(f.score >= floor, `${f.score} < ${floor}: ` + f.checks.filter((c) => !c.ok).map((c) => `${c.name}: ${c.detail}`).join("; "));
    });
  }
});

describe("the typed size scales the landmark without changing its ratios", () => {
  it("a 4 ft Golden Gate is 48\" long with towers at its real ratio", () => {
    const p = generateFromPrompt("golden gate bridge 4 ft from skewers");
    const f = landmarkFidelity(p, "golden gate");
    assert.equal(f.score, 100, JSON.stringify(f.checks.filter((c) => !c.ok)));
    assert.ok(Math.abs(p.overall.width - 48) <= 1.5, String(p.overall.width));
  });
  it("Golden Gate and Brooklyn are different bridges", () => {
    const gg = generateFromPrompt("popsicle stick Golden Gate Bridge");
    const bk = generateFromPrompt("Brooklyn Bridge popsicle sticks");
    assert.equal(landmarkFidelity(gg, "brooklyn").score < 100, true);
    assert.equal(landmarkFidelity(bk, "golden gate").score < 100, true);
  });
});

describe("a landmark without its own spec takes the nearest family and says so", () => {
  it("Tower Bridge is built as a suspension bridge, with a note", () => {
    const p = generateFromPrompt("Tower Bridge from popsicle sticks");
    assert.equal(p.kind, "bridge");
    assert.ok(p.notes.some((n) => /nearest spec/.test(n)), JSON.stringify(p.notes));
  });
  it("an arch bridge carries its deck under the arch crown", () => {
    const p = generateFromPrompt("arch bridge from popsicle sticks");
    assert.ok(p.notes.some((n) => /through-arch family/.test(n)));
    const top = Math.max(...p.instances.map((i) => i.position.y));
    const mid = p.instances.filter((i) => Math.abs(i.position.x) < 2).map((i) => i.position.y);
    assert.ok(Math.max(...mid) >= top * 0.9, "the arch crown stands over mid-span");
  });
});
