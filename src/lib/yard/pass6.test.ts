import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generateFromPrompt } from "./promptMain";
import { buildPlan } from "./report";
import { STRESS_PROMPTS } from "./stressPrompts";


const build = (prompt: string) => {
  const p = generateFromPrompt(prompt);
  return { p, plan: buildPlan(p), notes: (p.notes ?? []).join(" ") };
};

describe("cue agreement: notes, model and Buy say the same thing about doors, drawers and lids", () => {
  const NONE = {
    doors: { said: /You typed "no doors?"/i, part: (x: { type?: string; name: string }) => x.type === "door" || /\bdoor\b/i.test(x.name), buy: /hinge|pull|knob/i },
    drawers: { said: /You typed "no drawers?"/i, part: (x: { type?: string; name: string }) => x.type === "drawer" || /\bdrawer\b/i.test(x.name), buy: /slide/i },
    lid: { said: /You typed "no lids?"/i, part: (x: { type?: string; name: string }) => /^(?:lift-off )?lid\b/i.test(x.name), buy: /piano hinge|lid stay/i },
  } as const;
  const prompts = [
    ...STRESS_PROMPTS,
    "toy chest no lid 30 wide",
    "kitchen wall cabinet no doors 30 wide 30 tall 12 deep",
    "nightstand no drawers 18 wide",
    "blanket chest no lid 36 wide",
    "wardrobe with no doors 36 wide",
  ];
  it("whenever the notes say none, the model has none and Buy buys none", () => {
    const bad: string[] = [];
    let checked = 0;
    for (const prompt of prompts) {
      const { p, plan } = build(prompt);
      // Only the honesty sentence ("You typed \"no doors\"…") counts as the notes saying none.
      const said = (p.notes ?? []).filter((n) => /You typed "/.test(n)).join(" ");
      for (const [what, rule] of Object.entries(NONE)) {
        if (!rule.said.test(said)) continue;
        // The later cue can win ("no lid, with a hinged lid"): the note then says it has one.
        if (new RegExp(`it has ${what === "lid" ? "a lid" : what}`, "i").test(said)) continue;
        checked++;
        const parts = p.panels.filter(rule.part).map((x) => x.name);
        const buys = plan.bom.filter((b) => rule.buy.test(b.name)).map((b) => b.name);
        if (parts.length || buys.length) bad.push(`${prompt} [${what}]: parts ${parts.join(",")} buy ${buys.join(",")}`);
      }
    }
    assert.deepEqual(bad, []);
    assert.ok(checked >= 8, `only ${checked} none-cues checked`);
  });
  it("garage wall cabinet no doors: open front, no hinges or pulls", () => {
    const { p, plan, notes } = build("garage wall cabinet no doors 48 wide 30 tall 12 deep");
    assert.ok(!p.panels.some((x) => x.type === "door"));
    assert.ok(!plan.bom.some((b) => /hinge|pull/i.test(b.name)));
    assert.match(notes, /open front/);
    assert.doesNotMatch(notes, /doors stand proud/);
  });
  it("a wall cabinet with no cue keeps its doors", () => {
    const { p, plan } = build("garage wall cabinet 48 wide 30 tall 12 deep");
    assert.ok(p.panels.some((x) => x.type === "door"));
    assert.ok(plan.bom.some((b) => /hinge/i.test(b.name)));
  });
});

describe("the head noun is last: a figure word that modifies it is not a figure", () => {
  it("craft stick bird feeder is a feeder, not a bird", () => {
    const { p, plan } = build("craft stick bird feeder");
    assert.equal(p.name, "Bird Feeder");
    assert.ok(!p.panels.some((x) => /wing|beak|head|tail/i.test(x.name)));
    assert.ok(!plan.bom.some((b) => /liner|landscape/i.test(b.name)));
  });
  it("maple cat scratching post is a base and a 4×4 post, and Buy has the post", () => {
    const { p, plan } = build("maple cat scratching post 30 tall");
    assert.match(p.name, /^Scratching post/);
    assert.equal(p.overall.height, 30);
    assert.ok(p.panels.some((x) => x.name === "Base"));
    assert.ok(p.panels.some((x) => x.name === "Post" && x.materialId === "lumber-4x4-8"));
    assert.ok(plan.bom.some((b) => b.catalogId === "lumber-4x4-8"));
    assert.ok(plan.bom.some((b) => /sisal/i.test(b.name)));
  });
  it("pine dog ramp for the couch is a sloped deck at the typed height, not a launch ramp", () => {
    const { p } = build("pine dog ramp for the couch 18 high");
    assert.match(p.name, /^Dog ramp/);
    assert.equal(p.overall.height, 18);
    assert.ok(p.panels.some((x) => x.name === "Deck"));
    assert.ok(!p.panels.some((x) => /launch|marble|track/i.test(x.name)));
  });
  it("marble ramp, cat tree and popsicle dog keep their own recipes", () => {
    assert.doesNotMatch(build("marble ramp").p.name, /Dog ramp|Pet ramp/);
    assert.doesNotMatch(build("cat tree").p.name, /Scratching post/);
    assert.equal(build("popsicle stick dog").p.name, "Dog");
  });
});

describe("tier counts are honored and the title is the model", () => {
  it("walnut 1x8 wall shelf with 2 tiers: two shelves, title equals overall", () => {
    const { p } = build("walnut 1x8 wall shelf with 2 tiers 30 long");
    const shelves = p.panels.filter((x) => /^Shelf \d/.test(x.name));
    assert.equal(shelves.length, 2);
    const o = p.overall;
    assert.ok(p.name.includes(`30" × ${o.height}" × ${o.depth}"`), `${p.name} vs ${o.width}×${o.height}×${o.depth}`);
  });
});

describe("cheap leftovers", () => {
  it("2x4x8 bench reads the stock, not a 2 × 4 × 8 bench", () => {
    const { p } = build("2x4x8 bench");
    assert.equal(p.name, 'Bench 48" × 18" × 16"');
    assert.equal(p.overall.width, 48);
  });
  it("picnic table legs name the typed species", () => {
    assert.match(build("picnic table 6 ft cedar").notes, /Cedar 2×2 legs/);
  });
  it("bathroom shelf is a shelf unit, not a storage unit", () => {
    assert.match(build("bathroom shelf").p.name, /^Shelf unit/);
  });
});
