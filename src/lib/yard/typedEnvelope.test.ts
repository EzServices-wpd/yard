import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generateFromPrompt } from "./promptMain";

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
