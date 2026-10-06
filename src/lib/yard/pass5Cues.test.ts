import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { generateFromPrompt } from "./promptMain";
import { buildPlan } from "./report";

const build = (prompt: string) => {
  const p = generateFromPrompt(prompt);
  return { p, plan: buildPlan(p), notes: (p.notes ?? []).join(" ") };
};

describe("lid cues follow the same typed-last-wins rule as doors and drawers", () => {
  it("toy chest no lid builds open-topped and says so", () => {
    const { p, plan, notes } = build("toy chest no lid 30 wide");
    assert.ok(!p.panels.some((x) => /\blid\b/i.test(x.name)), "no Lid panel");
    assert.match(notes, /normally has a lid\. You typed "no lid", so this one is open-topped/);
    assert.ok(!plan.bom.some((b) => /piano hinge|lid stay/i.test(b.name)), "no lid hardware on Buy");
  });
  it("a hinged toy chest still has its lid and piano hinge", () => {
    const { p, plan } = build("toy chest 30 wide");
    assert.ok(p.panels.some((x) => /\blid\b/i.test(x.name)));
    assert.ok(plan.bom.some((b) => /piano hinge/i.test(b.name)));
  });
  it("both cues typed: the later one wins and the note says so", () => {
    const { p, notes } = build("toy chest no lid, with a hinged lid, 30 wide");
    assert.ok(p.panels.some((x) => /\blid\b/i.test(x.name)));
    assert.match(notes, /it has a lid/);
  });
});

describe("the item noun beats a room word", () => {
  it("pantry cabinet in the kitchen recess is a pantry, not a kitchen base", () => {
    const { p } = build("pantry cabinet with doors in the kitchen recess 24 wide 84 tall 14 deep");
    assert.match(p.name, /^Pantry/);
    assert.doesNotMatch(p.name, /Kitchen base/);
  });
  it("a bare kitchen cabinet is still a kitchen base", () => {
    assert.match(build("kitchen cabinet").p.name, /Kitchen base/);
  });
});

describe("the size line matches the model", () => {
  it("oak 1x12 bench keeps 2×4 legs and a 16 inch deep header", () => {
    const { p, notes } = build("oak 1x12 bench 40 wide");
    assert.equal(p.overall.depth, 16);
    assert.match(p.notes?.[0] ?? "", /^Bench 40" × 18" × 16"/);
    assert.match(notes, /four 2×4 legs/);
    assert.ok(p.panels.filter((x) => /\bleg\b/i.test(x.name)).every((x) => x.materialId === "lumber-2x4-8"));
  });
  it("every golden: the first W × H × D in the name and first note equals the overall", () => {
    const goldens = JSON.parse(readFileSync(new URL("./promptSnapshots.goldens.json", import.meta.url), "utf8")) as { prompt: string }[];
    const extra = ["oak 1x12 bench 40 wide", "toy chest no lid 30 wide", "cedar 1x8 planter box 24 long", "3 step stool", "workbench from 1x6"];
    const num = (s: string) => {
      const m = s.trim().match(/^(\d+)(?:\s+(\d+)\/(\d+))?$/);
      return m ? +m[1] + (m[2] ? +m[2] / +m[3] : 0) : NaN;
    };
    const TRI = /(\d+(?:\s+\d+\/\d+)?)"\s*×\s*(\d+(?:\s+\d+\/\d+)?)"\s*×\s*(\d+(?:\s+\d+\/\d+)?)"/;
    const bad: string[] = [];
    for (const prompt of [...goldens.map((g) => g.prompt), ...extra]) {
      const p = generateFromPrompt(prompt);
      for (const s of [p.name, p.notes?.[0] ?? ""]) {
        const m = s.match(TRI);
        if (!m) continue;
        const [w, h, d] = [num(m[1]), num(m[2]), num(m[3])];
        const o = p.overall;
        const proud = /stand proud/.test(s) && d > o.depth && d - o.depth <= 1;
        if (Math.abs(w - o.width) > 0.07 || Math.abs(h - o.height) > 0.07 || (Math.abs(d - o.depth) > 0.07 && !proud)) {
          bad.push(`${prompt}: "${s.slice(0, 60)}" vs ${o.width}×${o.height}×${o.depth}`);
        }
      }
    }
    assert.deepEqual(bad, []);
  });
});

describe("derived and read-order sizes say where they came from", () => {
  it("a step stool's depth is worked out from its steps, not Assumed", () => {
    const { notes } = build("3 step stool");
    assert.match(notes, /33" deep, worked out from 3 steps/);
    assert.doesNotMatch(notes, /Assumed [^.]*deep \(default size\)/);
  });
  it("a bare triple names the axis order it was read in", () => {
    assert.match(build("bookcase 30x12x72").notes, /Read 30x12x72 as width × depth × height\. Type wide \/ deep \/ tall to change it\./);
    assert.doesNotMatch(build("bookcase 30 wide 12 deep 72 tall").notes, /Read \d/);
  });
});
