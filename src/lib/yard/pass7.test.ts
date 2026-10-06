import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { generateFromPrompt } from "./promptMain";
import { buildPlan } from "./report";
import { STRESS_PROMPTS } from "./stressPrompts";
import { CATALOG_LUMBER_BIND } from "./namedLumberSpecies";

const build = (prompt: string) => {
  const p = generateFromPrompt(prompt);
  return { p, plan: buildPlan(p), notes: (p.notes ?? []).join(" ") };
};

describe("an animal word before a furniture head builds the animal's enclosure", () => {
  it("cedar bunny hutch 48 wide: raised on legs, solid floor and roof, mesh front, no cabinet doors", () => {
    const { p, plan, notes } = build("cedar bunny hutch 48 wide");
    assert.match(p.name, /^Rabbit hutch 48" × /);
    assert.equal(p.overall.width, 48);
    assert.equal(p.panels.filter((x) => /^Leg \d/.test(x.name)).length, 4);
    const floor = p.panels.find((x) => x.name === "Floor");
    assert.ok(floor && floor.position.y >= 10, "floor stands up off the ground");
    assert.equal(floor.materialId, CATALOG_LUMBER_BIND, "floor is the typed cedar");
    assert.ok(p.panels.some((x) => x.name === "Roof"));
    assert.ok(!p.panels.some((x) => x.type === "door" || /shelf|support/i.test(x.name)));
    assert.match(notes, /hardware cloth/);
    assert.ok(plan.bom.some((b) => /^Cedar/.test(b.name)));
    assert.ok(plan.bom.some((b) => /hardware cloth/i.test(b.name)));
    assert.ok(plan.bom.some((b) => /butt hinges/i.test(b.name)));
    assert.ok(!plan.bom.some((b) => /concealed|pulls|shelf pins/i.test(b.name)));
  });
  it("guinea pig cage, chicken coop and a typed rabbit hutch are enclosures at their size", () => {
    assert.match(build("guinea pig cage").p.name, /^Guinea pig cage/);
    assert.match(build("chicken coop").p.name, /^Chicken coop/);
    const o = build("rabbit hutch 48x24x36").p.overall;
    assert.deepEqual([o.width, o.height, o.depth], [48, 36, 24]);
  });
  it("a china hutch and a dog house keep their own recipes", () => {
    assert.ok(build("china hutch").p.panels.some((x) => x.type === "door"));
    assert.match(build("dog house").p.name, /^Dog house/);
  });
});

describe("a pet's feeding surface stands at pet height when no height is typed", () => {
  it("plywood cat feeding station 24 wide is about 6 inches tall, not a 42 inch counter", () => {
    const { p, notes } = build("plywood cat feeding station 24 wide");
    assert.equal(p.overall.width, 24);
    assert.ok(p.overall.height >= 6 && p.overall.height <= 8, `${p.overall.height}`);
    assert.match(notes, /Assumed 6" tall/);
  });
  it("a large dog's station is 16–20 inches; a dog feeding table is dog height", () => {
    const big = build("large dog feeding station").p.overall.height;
    assert.ok(big >= 16 && big <= 20, `${big}`);
    assert.ok(build("dog feeding table").p.overall.height <= 14);
  });
  it("a typed height wins, and a dog crate end table stays an end table", () => {
    assert.equal(build("cat feeding station 10 tall").p.overall.height, 10);
    assert.match(build("dog crate end table").p.name, /^End table/);
  });
});

describe("every build's notes are tidy", () => {
  it("no skeleton argument, no doubled or edge spaces, on every golden and stress prompt", () => {
    const goldens = JSON.parse(readFileSync(new URL("./promptSnapshots.goldens.json", import.meta.url), "utf8")) as { prompt: string }[];
    const bad: string[] = [];
    for (const prompt of [...goldens.map((g) => g.prompt), ...STRESS_PROMPTS]) {
      for (const n of generateFromPrompt(prompt).notes ?? []) if (/skeleton|\s{2}|^\s|\s$/.test(n)) bad.push(`${prompt}: ${n}`);
    }
    assert.deepEqual(bad, []);
  });
  it("the raised bed keeps its guidance line, cleanly", () => {
    assert.ok((build("cedar 2x6 raised garden bed 48x24x11").p.notes ?? []).includes("Guidance only — set it level."));
  });
});

describe("a shelf cut from a typed board is one board deep unless a depth is typed", () => {
  it("walnut 1x8 wall shelf is 7 1/4 deep and says why", () => {
    const { p, notes } = build("walnut 1x8 wall shelf");
    assert.equal(p.overall.depth, 7.25);
    assert.match(notes, /7 1\/4" deep, worked out from the Walnut 1×8's real face/);
    assert.doesNotMatch(notes, /Assumed [^.]*deep/);
  });
  it("oak 1x10 tiers are 9 1/4 deep; a typed depth and plain plywood keep theirs", () => {
    assert.equal(build("oak 1x10 wall shelf with 3 tiers 36 long").p.overall.depth, 9.25);
    assert.equal(build("walnut 1x8 wall shelf 10 deep").p.overall.depth, 10);
    assert.equal(build("wall shelf 30 long").p.overall.depth, 8);
  });
});

describe("cabinet leftovers", () => {
  it("a broom cabinet stands full height", () => {
    assert.equal(build("broom cabinet").p.overall.height, 84);
  });
  it("garage wall cabinet: doors close on the carcase, shelves stop the hinge clearance short of them", () => {
    const { p } = build("garage wall cabinet 48 wide 30 tall 12 deep");
    const door = p.panels.find((x) => x.type === "door")!;
    const shelf = p.panels.find((x) => x.type === "shelf")!;
    assert.equal(door.position.z + door.size.depth, 12);
    assert.equal(door.position.z - (shelf.position.z + shelf.size.depth), 0.75);
    assert.equal(p.overall.depth, 12);
  });
  it("the linen closet is exactly 31.5 × 78 × 16", () => {
    const o = build("linen closet 31.5 wide 78 tall 16 deep").p.overall;
    assert.deepEqual([o.width, o.height, o.depth], [31.5, 78, 16]);
  });
});
