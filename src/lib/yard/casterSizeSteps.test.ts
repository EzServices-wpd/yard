/**
 * Critic #79 block: a size step rebuilt caster builds without their casters (4 → 0), so the step was refused and Wider
 * and Taller vanished ("rolling kitchen island", "kitchen island on casters", "mobile workbench", "rolling kitchen
 * cart"; "make it 48 wide" refused as "cleats (4 → 0)"). C19: a size step re-derives what follows from size and keeps
 * everything else, so the casters stay; a size override still carries the rolling ask; a refusal names the real part.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { generateFromPrompt } from "./promptMain";
import * as refine from "./refine";
const { refineChips, refineProject } = refine;

const ROLLING = ["rolling kitchen island", "kitchen island on casters", "mobile workbench", "rolling kitchen cart"];
const casters = (p: { panels: { name: string }[] }) => p.panels.filter((x) => /^Caster \d+$/.test(x.name)).length;

describe("C19 + C13: size steps keep the casters", () => {
  for (const q of ROLLING) {
    it(`${q}: on casters, offers Wider and Taller, keeps 4 casters after each and after 'make it 48 wide' (60 when already 48)`, () => {
      const p = generateFromPrompt(q);
      assert.equal(casters(p), 4, `${q}: built on 4 casters (${p.name})`);
      const chips = refineChips(p).map((c) => c.label);
      assert.ok(chips.includes("Wider") && chips.includes("Taller"), `${q}: chips ${chips.join(", ")}`);
      const w = p.overall.width === 48 ? 60 : 48;
      for (const [phrase, axis, want] of [["2 inches wider", "width", p.overall.width + 2], ["2 inches taller", "height", p.overall.height + 2], [`make it ${w} wide`, "width", w]] as const) {
        const r = refineProject(p, phrase);
        assert.ok(r.project, `${q} · ${phrase}: refused (${r.refused.join("; ")})`);
        assert.equal(casters(r.project!), 4, `${q} · ${phrase}: casters ${casters(r.project!)}`);
        assert.equal(r.project!.overall[axis], want, `${q} · ${phrase}: ${axis}`);
      }
    });
  }
  it("a size override (the bar's follow-on size) still carries the rolling ask", () => {
    const p = generateFromPrompt("rolling kitchen island", undefined, undefined, { sizeOverride: { width: 48, height: 39, depth: 16 } });
    assert.equal(casters(p), 4);
    // The override is the size on the casters: never 3" added twice.
    assert.ok(p.overall.height <= 39, `height ${p.overall.height}`);
  });
  it("a refusal names the real part: casters, never 'cleats'", () => {
    const p = generateFromPrompt("rolling kitchen island");
    const { partCountLabel } = refine as typeof refine & { partCountLabel: (t: string, a: typeof p, b: typeof p) => string };
    assert.equal(typeof partCountLabel, "function", "refine exports partCountLabel");
    assert.equal(partCountLabel("cleat", p, { ...p, panels: p.panels.filter((x) => !/^Caster/.test(x.name)) }), "casters");
    assert.equal(partCountLabel("shelf", p, p), "shelves");
  });
});
