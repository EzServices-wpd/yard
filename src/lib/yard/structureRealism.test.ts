import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { generateFromPrompt } from "./promptMain";
import { structureIssues } from "./structureCheck";
import { STRESS_PROMPTS } from "./stressPrompts";

/** Everyday builds across the frame families: beds, tables and benches with aprons, carcases, seats, outdoor frames. */
const EVERYDAY = [
  "twin bunk bed", "bunk bed twin over twin", "loft bed", "loft bed with desk", "queen bed", "full bed", "king platform bed", "bed frame",
  "toddler bed", "daybed", "headboard", "crib",
  "dining table", "coffee table", "farmhouse table 2x4", "end table", "side table", "console table", "kitchen island", "desk", "workbench",
  "2x4 workbench 60 wide", "potting bench", "potting table", "picnic table", "picnic table 6 ft from 2x6",
  "bench", "garden bench 2x4", "outdoor bench", "pine porch bench", "deck bench", "storage bench", "entry bench 42 wide with shoe shelf", "oak 1x12 bench 40 wide",
  "step stool", "bar stool", "counter stool", "chair", "kitchen chair from 1x4", "adirondack chair", "rocking chair",
  "plywood bookshelf", "bookshelf from pine 1x10", "ladder shelf", "garage shelves", "mudroom cubbies", "tv stand", "media console", "dresser", "nightstand",
  "shoe rack", "coat rack", "hall tree", "wine rack", "toy box", "laundry hamper",
  "porch swing", "pergola", "arbor", "trellis", "raised garden bed", "cedar raised bed 4x8", "planter box", "compost bin", "sandbox", "dog house", "birdhouse", "shed",
  "playhouse", "sawhorse", "lemonade stand", "plant stand",
];

/** Known failures. Empty: every build stands on a load path. This list only shrinks. */
const KNOWN = new Set<string>([]);

/** Sticks and dowels standing in for boards, plus the real-scale outdoor frames. */
const STAND_INS = [
  "popsicle stick bunk bed", "dowel bunk bed", "popsicle stick picnic table", "dowel bed frame", "popsicle stick bench",
  "deck 10x12", "deck 16x20", "gate", "garden gate 42 wide 60 tall", "swing set",
];

const goldens: string[] = JSON.parse(readFileSync(new URL("./promptSnapshots.goldens.json", import.meta.url), "utf8")).map((g: { prompt: string }) => g.prompt);
const PROMPTS = [...new Set([...goldens, ...STRESS_PROMPTS, ...EVERYDAY, ...STAND_INS])];

describe("structural realism: every part on a load path, beams on edge, posts stout enough", () => {
  for (const prompt of PROMPTS) {
    it(prompt, () => {
      const issues = structureIssues(generateFromPrompt(prompt));
      if (KNOWN.has(prompt)) assert.ok(issues.length, `${prompt} passes now: take it off KNOWN`);
      else assert.deepEqual(issues, []);
    });
  }
});

describe("the check sees what is wrong", () => {
  const base = generateFromPrompt("twin bunk bed");
  const part = (name: string, type: string, x: number, y: number, z: number, w: number, h: number, d: number) =>
    ({ ...base.panels[0], id: name, name, type, position: { x, y, z }, size: { width: w, height: h, depth: d } }) as (typeof base.panels)[number];
  // Two 2×4 trestles 36" apart carrying a beam and a top.
  const frame = (beam: { h: number; d: number }, postW = 3.5) => [
    part("Left post", "upright", 0, 0, 0, 1.5, 30, postW),
    part("Right post", "upright", 37.5, 0, 0, 1.5, 30, postW),
    part("Beam", "rail", 1.5, 30 - beam.h, 0, 36, beam.h, beam.d),
    part("Top", "top", 0, 30, 0, 39, 0.75, 12),
  ];
  it("the sound frame passes", () => {
    assert.deepEqual(structureIssues({ ...base, panels: frame({ h: 3.5, d: 1.5 }) }), []);
  });
  it("a bearer that touches only the deck it should carry is caught (the old bunk bed)", () => {
    const panels = [...frame({ h: 3.5, d: 1.5 }), part("Bearer", "rail", 10, 26.5, 6, 20, 3.5, 1.5)];
    assert.ok(structureIssues({ ...base, panels }).some((i) => i.code === "hanging-support" && i.part === "Bearer"));
  });
  it("a part with no path to the floor is caught", () => {
    const panels = [...frame({ h: 3.5, d: 1.5 }), part("Shelf", "shelf", 5, 12, 0, 20, 0.75, 10)];
    assert.ok(structureIssues({ ...base, panels }).some((i) => i.code === "floating" && i.part === "Shelf"));
  });
  it("a beam laid flat under a load is caught", () => {
    assert.ok(structureIssues({ ...base, panels: frame({ h: 1.5, d: 3.5 }) }).some((i) => i.code === "flat-beam"));
  });
  it("a lone 2×2 post 65\" tall under people is caught", () => {
    const panels = [part("Post", "upright", 0, 0, 0, 1.5, 65, 1.5), part("Deck", "deck", 0, 65, 0, 20, 0.75, 20)];
    assert.ok(structureIssues({ ...base, panels }).some((i) => i.code === "slender-post"));
  });
});

describe("craft stock standing in for boards", () => {
  for (const prompt of ["popsicle stick bunk bed", "dowel bunk bed", "popsicle stick picnic table", "popsicle stick bench"]) {
    it(`${prompt}: notes name the craft members, not lumber posts and bolts`, () => {
      const notes = generateFromPrompt(prompt).notes.join(" ");
      assert.doesNotMatch(notes, /\b[1-4]×\d+\s+(?:post|rail|leg|ledger|slat|stretcher|apron|beam|joist)/i, notes);
      assert.doesNotMatch(notes, /\b(?:bolts?|lag screws?|structural screws)\b/i, notes);
    });
  }
});

describe("real-scale outdoor frames in lumber", () => {
  const panels = (prompt: string) => generateFromPrompt(prompt).panels;
  it("deck 10x12 is 10' × 12' on posts and beams, joists at 16\" on centre, decking on top, every piece from an 8' board", () => {
    const p = generateFromPrompt("deck 10x12");
    assert.equal(p.overall.width, 120);
    assert.equal(p.overall.depth, 144);
    assert.ok(p.overall.height < 30, "ground level");
    const of = (re: RegExp) => p.panels.filter((q) => re.test(q.name));
    assert.ok(of(/^Post /).every((q) => q.materialId === "lumber-4x4-8" && q.position.y === 0));
    assert.ok(of(/^Beam /).length >= 4);
    const xs = [...new Set(of(/^Joist /).map((q) => q.position.x))].sort((a, b) => a - b);
    assert.ok(xs.slice(1).every((x, i) => x - xs[i] <= 16 + 1e-6), `joists ${xs.join(",")}`);
    assert.ok(of(/^Deck board /).length >= 24);
    assert.ok(p.panels.every((q) => Math.max(q.size.width, q.size.height, q.size.depth) <= 96 + 1e-6), "fits 8' stock");
    assert.match(p.notes.join(" "), /pier blocks/);
  });
  it("gate: frame with a brace from the bottom hinge corner up to the latch side", () => {
    const p = panels("gate");
    const brace = p.find((q) => q.name === "Diagonal brace");
    const hinge = p.find((q) => q.name === "Hinge stile");
    assert.ok(brace?.polygon && hinge && p.some((q) => q.name === "Latch stile"));
    const pts = brace.polygon.pts;
    // Starts at the bottom of the hinge side (local x 0, y 0) and climbs to the far top corner.
    assert.ok(pts.some(([x, y]) => x === 0 && y === 0) && pts.some(([x, y]) => x === brace.size.width && y === brace.size.height));
    assert.ok(hinge.position.x < brace.position.x);
  });
  it("swing set: A-frame legs under a doubled top beam", () => {
    const p = panels("swing set");
    assert.equal(p.filter((q) => /^A-frame \d leg/.test(q.name) && q.polygon).length, 4);
    assert.equal(p.filter((q) => /^Top beam/.test(q.name)).length, 2);
  });
  it("craft stock keeps the stick model", () => {
    for (const prompt of ["popsicle stick gate", "popsicle stick swing set", "dowel deck"]) {
      assert.equal(generateFromPrompt(prompt).panels.some((q) => /^(?:Diagonal brace|Top beam|Joist)/.test(q.name)), false, prompt);
    }
  });
  it("bed frame is the shared platform bed", () => {
    assert.match(generateFromPrompt("bed frame").name, /^Platform bed/);
  });
});
