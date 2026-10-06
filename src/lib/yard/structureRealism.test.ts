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

/**
 * Known failures, all craft-stock stick or folded-card bodies. This list only shrinks: a build that
 * now passes must come off it.
 */
const KNOWN = new Set([
  "plant stand from dowel",
  "3 foot Eiffel Tower from popsicle sticks",
  "cardboard robot",
  "doll bed",
  "popsicle stick airplane",
  "popsicle stick coaster 4 inch",
  "craft stick bird feeder",
]);

const goldens: string[] = JSON.parse(readFileSync(new URL("./promptSnapshots.goldens.json", import.meta.url), "utf8")).map((g: { prompt: string }) => g.prompt);
const PROMPTS = [...new Set([...goldens, ...STRESS_PROMPTS, ...EVERYDAY])];

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
