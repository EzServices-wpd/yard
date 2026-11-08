import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generateFromPrompt } from "./promptMain";
import { buildPlan } from "./report";
import { headerTitle } from "./pdf";
import type { Panel, YardProject } from "./types";

const notes = (p: { notes?: string[] }) => (p.notes ?? []).join(" ");

describe("typed size sets a craft's envelope; whole sticks say the real size", () => {
  it("toothpick dome 18 inches lands near 18, not the 25-inch module, and says the real size", () => {
    const p = generateFromPrompt("toothpick geodesic dome 18 inches");
    assert.ok(Math.abs(p.overall.width - 18) <= 1.5, JSON.stringify(p.overall));
    assert.match(notes(p), /You typed 18" wide\. Whole .* the closest the stick allows/);
  });
  it("popsicle birdhouse 6x6x8 never claims 'Sized to' a size the sticks did not build", () => {
    const p = generateFromPrompt("popsicle birdhouse 6x6x8");
    assert.doesNotMatch(notes(p), /Sized to 6/);
    assert.match(notes(p), /You typed 6" wide × 8" tall × 6" deep/);
  });
  it("craft stick bridge 30 long 4 wide: length runs along width, like every craft builder", () => {
    const p = generateFromPrompt("craft stick bridge 30 long 4 wide");
    assert.ok(p.overall.width >= p.overall.depth && Math.abs(p.overall.width - 30) <= 1.5, JSON.stringify(p.overall));
  });
});

describe("an unknown noun keeps a clean title, the typed width, and claims no kind", () => {
  it("a zorgle 30 wide made of 2x4", () => {
    const p = generateFromPrompt("a zorgle 30 wide made of 2x4");
    assert.equal(p.name, "Zorgle");
    assert.equal(p.kind, "custom");
    assert.ok(Math.abs(p.overall.width - 30) < 0.1, JSON.stringify(p.overall));
  });
  it("a flumph out of cardboard is not furniture", () => {
    const p = generateFromPrompt("a flumph out of cardboard");
    assert.equal(p.name, "Flumph");
    assert.equal(p.kind, "custom");
  });
});

describe("a unit that goes into a nook, recess or hall opening keeps its doors inside the space", () => {
  for (const prompt of [
    "cabinet with doors for a 30 wide nook, 36 tall, 14 deep",
    "linen cabinet with doors in the hall opening 24 wide 80 tall 15 deep",
    "pantry with doors in a recess 30 wide 84 tall 16 deep",
  ]) {
    it(prompt, () => {
      const p = generateFromPrompt(prompt);
      const depth = Number(prompt.match(/(\d+) deep/)![1]);
      assert.equal(p.fitted?.opening.kind, "alcove");
      const doors = p.panels.filter((x) => /door/i.test(x.name));
      assert.ok(doors.length > 0);
      const back = Math.min(...p.panels.map((x) => x.position.z));
      const front = Math.max(...doors.map((d) => d.position.z + d.size.depth));
      assert.ok(front - back <= depth + 1e-6, `doors ${front - back} vs opening ${depth}`);
      assert.doesNotMatch(notes(p), /doors stand proud/);
    });
  }
  it("a freestanding linen closet stays 31 1/2 × 78 × 16", () => {
    const p = generateFromPrompt("linen closet 31.5 wide 78 tall 16 deep");
    assert.deepEqual([p.overall.width, p.overall.height, p.overall.depth], [31.5, 78, 16]);
  });
});

describe("a front feature typed both ways: the later cue wins and a note says so", () => {
  it("dresser no drawers, open front with doors, 36w builds doors and says why", () => {
    const p = generateFromPrompt("dresser no drawers, open front with doors, 36w");
    assert.ok(p.panels.some((x) => /door/i.test(x.name)));
    assert.match(notes(p), /The later cue \("with doors"\) won, so it has doors\. To build it the other way, take out "with doors"/);
  });
  it("bookcase with doors, open front stays open and says why", () => {
    const p = generateFromPrompt("bookcase with doors, open front");
    assert.ok(!p.panels.some((x) => /door/i.test(x.name)));
    assert.match(notes(p), /The later cue \("open front"\) won, so it has no doors/);
  });
  it("no conflict, no note", () => {
    const p = generateFromPrompt("media console with no doors");
    assert.doesNotMatch(notes(p), /later cue/);
  });
});

/** Top of the sloped back at each end: the height the cut list and the model share. */
function slopeEnds(project: YardProject): { left: number; right: number } {
  const back = project.panels.find((p) => p.name === "Sloped back") as Panel;
  const pts = back.polygon?.pts ?? [];
  const xs = pts.map((p) => p[0]);
  const at = (x: number) => Math.max(...pts.filter((p) => Math.abs(p[0] - x) < 1e-6).map((p) => p[1]));
  return { left: at(Math.min(...xs)), right: at(Math.max(...xs)) };
}

describe("typed slope ends win over a default low end", () => {
  it("under stairs shelves 72 wide 16 deep 60 tall left 24 tall right is 24 on the left and 60 on the right", () => {
    const prompt = "under stairs shelves 72 wide 16 deep 60 tall left 24 tall right";
    const project = generateFromPrompt(prompt);
    const plan = buildPlan(project);
    const ends = slopeEnds(project);
    const text = [project.name, headerTitle(project), ...(project.notes ?? []), ...plan.instructions.map((s) => `${s.title} ${s.description}`), ...project.panels.map((p) => p.cutNote ?? "")].join("\n");
    assert.deepEqual([project.overall.width, project.overall.depth, project.overall.height], [72, 16, 60]);
    assert.deepEqual(ends, { left: 24, right: 60 });
    assert.match(headerTitle(project), /72" wide/);
    assert.match(headerTitle(project), /24" on the left/);
    assert.match(headerTitle(project), /60" on the right/);
    assert.match(headerTitle(project), /72" W × 16" D × 60" H/);
    assert.match(plan.instructions[0].description, /24" on the left and 60" on the right/);
    assert.match(project.panels.find((p) => p.name === "Sloped back")?.cutNote ?? "", /24" tall on the left edge, 60" on the right/);
    assert.doesNotMatch(text, /Assumed 12"|12" at the low side|12" tall on the left|to 12"/);
    assert.equal(project.opening?.width, 72);
    assert.equal(project.opening?.height, 60);
    assert.equal(project.opening?.depth, 16);
  });

  it("the same end words on a sloped ceiling and a knee wall keep each typed end", () => {
    const ceiling = generateFromPrompt("bookshelf under a sloped ceiling 50 wide 10 deep 42 tall on the left 28 tall on the right");
    assert.deepEqual(slopeEnds(ceiling), { left: 42, right: 28 });
    assert.deepEqual([ceiling.overall.width, ceiling.overall.depth, ceiling.overall.height], [50, 10, 42]);
    const knee = generateFromPrompt("knee-wall shelves 36 wide left 20 tall right 44 tall");
    assert.deepEqual(slopeEnds(knee), { left: 20, right: 44 });
    assert.equal(knee.overall.width, 36);
    assert.equal(knee.overall.height, 44);
    const ordered = generateFromPrompt("under stairs shelves 40 wide 12 deep left 18 tall and right 36 tall");
    assert.deepEqual(slopeEnds(ordered), { left: 18, right: 36 });
  });

  it("high side and low side still place the ends, and an untyped low end is still announced", () => {
    const named = generateFromPrompt("under stairs shelves 72 wide 16 deep 60 tall at the high side 24 at the low side");
    assert.deepEqual(slopeEnds(named), { left: 24, right: 60 });
    assert.match(named.name, /60" to 24" tall/);
    const dream = generateFromPrompt("bookshelf under a sloped ceiling 48 wide 60 tall at the high side 30 at the low side");
    assert.equal(dream.name, 'Sloped-ceiling bookcase 48" wide · 60" to 30" tall');
    assert.deepEqual(slopeEnds(dream), { left: 60, right: 30 });
    const assumed = generateFromPrompt("under stairs shelves 72 wide 16 deep 60 tall");
    assert.match(assumed.notes.join(" "), /Your 60" is the high side\. Assumed 12" at the low side/);
    assert.deepEqual(slopeEnds(assumed), { left: 12, right: 60 });
    const knee = generateFromPrompt("knee wall shelves 48 wide 32 tall");
    assert.match(knee.notes.join(" "), /Your 32" is the knee-wall \(low\) side/);
    assert.equal((knee.fitted?.unit?.odd?.params as { loH?: number }).loH, 32);
  });
});
