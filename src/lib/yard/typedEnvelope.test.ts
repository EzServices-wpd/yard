import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generateFromPrompt } from "./promptMain";
import { buildPlan } from "./report";
import { headerTitle } from "./pdf";
import { coverAxesTalk } from "./headerSize";
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
    assert.doesNotMatch(headerTitle(project), /assumed/);
    assert.equal(project.spec?.size.height.typed, true);
    assert.equal(project.spec?.size.height.assumed, false);
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

function heightMarks(prompt: string) {
  const project = generateFromPrompt(prompt);
  return {
    project,
    ends: slopeEnds(project),
    hud: headerTitle(project),
    cover: coverAxesTalk(project).subtitle,
    spec: project.spec!.size.height,
    pieces: buildPlan(project).totals.pieces,
    step: buildPlan(project).instructions[0].description,
  };
}

describe("one typed slope end uses the high/low rules, not a 30 inch rise", () => {
  it("a sloped ceiling keeps a typed high side and a bare low side", () => {
    const mixed = heightMarks("bookshelf under a sloped ceiling 48 wide 12 deep high side 60 tall on the left low side 30");
    assert.deepEqual(mixed.ends, { left: 60, right: 30 });
    assert.equal(mixed.project.overall.height, 60);
    assert.equal(mixed.pieces, 11);
    assert.doesNotMatch(mixed.project.notes.join(" "), /Assumed 90|90" on the right/);
    assert.equal(mixed.spec.typed, true);
    assert.equal(mixed.spec.assumed, false);
    assert.doesNotMatch(mixed.hud, /H assumed/);
    assert.doesNotMatch(mixed.cover, /tall assumed|you typed/);
  });

  it("a sloped ceiling's one typed end is the high side", () => {
    const one = heightMarks("bookshelf under a sloped ceiling 48 wide 12 deep 60 tall on the left");
    assert.deepEqual(one.ends, { left: 60, right: 30 });
    assert.equal(one.project.overall.height, 60);
    assert.equal(one.pieces, 11);
    assert.match(one.project.notes.join(" "), /Your 60" is the high side\. Assumed 30" at the low side/);
    assert.equal(one.spec.typed, true);
    assert.doesNotMatch(one.hud, /H assumed/);
    assert.doesNotMatch(one.cover, /you typed/);
  });

  it("stairs rise to the right when only the right end is typed", () => {
    for (const prompt of [
      "under stairs shelves 72 wide 16 deep 60 tall on the right",
      "under stairs shelves 72 wide 16 deep right 60 tall",
    ]) {
      const stair = heightMarks(prompt);
      assert.deepEqual(stair.ends, { left: 12, right: 60 }, prompt);
      assert.equal(stair.project.overall.height, 60, prompt);
      assert.equal(stair.pieces, 14, prompt);
      assert.match(stair.step, /12" on the left and 60" on the right/, prompt);
      assert.match(stair.project.notes.join(" "), /Assumed 12" at the low side/, prompt);
      assert.equal(stair.spec.typed, true, prompt);
      assert.doesNotMatch(stair.hud, /H assumed/, prompt);
      assert.doesNotMatch(stair.cover, /you typed/, prompt);
    }
  });

  it("a knee wall's one typed end is the low side, so the taller end is assumed", () => {
    const knee = heightMarks("knee wall shelves 48 wide 32 tall on the left");
    assert.deepEqual(knee.ends, { left: 32, right: 56 });
    assert.equal(knee.project.overall.height, 56);
    assert.match(knee.project.notes.join(" "), /Your 32" is the knee-wall \(low\) side\. Assumed 56" at the high side/);
    assert.equal(knee.spec.typed, false);
    assert.equal(knee.spec.assumed, true);
    assert.match(knee.hud, /H assumed/);
    assert.match(knee.cover, /56" tall\b.*assumed/);
    assert.doesNotMatch(knee.cover, /you typed/);
  });
});

describe("a high or low word on the empty end ranks the typed end", () => {
  it("high side on the left makes a typed right end the low side", () => {
    for (const prompt of [
      "bookshelf under a sloped ceiling 48 wide 12 deep high side on the left 30 tall on the right",
      "bookshelf under a sloped ceiling 48 wide 12 deep left side is high 30 tall on the right",
    ]) {
      const built = heightMarks(prompt);
      assert.deepEqual(built.ends, { left: 60, right: 30 }, prompt);
      assert.equal(built.project.overall.height, 60, prompt);
      assert.equal(built.pieces, 11, prompt);
      assert.match(built.step, /60" on the left and 30" on the right/, prompt);
      assert.match(built.project.panels.find((p) => p.name === "Sloped back")?.cutNote ?? "", /60" tall on the left edge, 30" on the right/, prompt);
      assert.match(built.project.notes.join(" "), /Assumed 60" at the high side/, prompt);
      assert.doesNotMatch(built.project.notes.join(" "), /Your 30" is the high side/, prompt);
      assert.equal(built.spec.typed, false, prompt);
      assert.equal(built.spec.assumed, true, prompt);
      assert.match(built.hud, /H assumed/, prompt);
      assert.match(built.cover, /60" tall\b.*assumed/, prompt);
      assert.doesNotMatch(built.cover, /you typed/, prompt);
    }
  });

  it("low side on the right makes a typed left end the high side", () => {
    for (const prompt of [
      "under stairs shelves 72 wide 16 deep low side on the right 60 tall on the left",
      "under stairs shelves 72 wide 16 deep right side is low 60 tall on the left",
    ]) {
      const built = heightMarks(prompt);
      assert.deepEqual(built.ends, { left: 60, right: 12 }, prompt);
      assert.equal(built.project.overall.height, 60, prompt);
      assert.equal(built.pieces, 14, prompt);
      assert.match(built.step, /60" on the left and 12" on the right/, prompt);
      assert.match(built.project.notes.join(" "), /Your 60" is the high side\. Assumed 12" at the low side/, prompt);
      assert.doesNotMatch(built.project.notes.join(" "), /90/, prompt);
      assert.equal(built.spec.typed, true, prompt);
      assert.equal(built.spec.assumed, false, prompt);
      assert.doesNotMatch(built.hud, /H assumed/, prompt);
      assert.doesNotMatch(built.cover, /you typed/, prompt);
    }
  });

  it("low side on the left makes a typed right end the high side on a knee wall", () => {
    for (const prompt of [
      "knee wall shelves 48 wide 12 deep low side on the left 60 tall on the right",
      "knee wall shelves 48 wide 12 deep left side is low 60 tall on the right",
    ]) {
      const built = heightMarks(prompt);
      assert.deepEqual(built.ends, { left: 30, right: 60 }, prompt);
      assert.equal(built.project.overall.height, 60, prompt);
      assert.equal(built.pieces, 11, prompt);
      assert.match(built.step, /30" on the left and 60" on the right/, prompt);
      assert.match(built.project.notes.join(" "), /Your 60" is the high side\. Assumed 30" at the low side/, prompt);
      assert.doesNotMatch(built.project.notes.join(" "), /knee-wall \(low\) side|84/, prompt);
      assert.equal(built.spec.typed, true, prompt);
      assert.equal(built.spec.assumed, false, prompt);
      assert.doesNotMatch(built.hud, /H assumed/, prompt);
      assert.doesNotMatch(built.cover, /you typed/, prompt);
    }
  });
});

describe("a sloped HUD marks height from the ends that were built", () => {
  it("both ends typed without the word tall are not assumed", () => {
    for (const prompt of [
      "under stairs shelves 72 wide 16 deep 24 on the left 60 on the right",
      "sloped ceiling shelves 48 wide 12 deep 30 on the left 60 on the right",
    ]) {
      const built = heightMarks(prompt);
      assert.equal(built.project.overall.height, 60, prompt);
      assert.equal(built.spec.inches, 60, prompt);
      assert.equal(built.spec.typed, true, prompt);
      assert.equal(built.spec.assumed, false, prompt);
      assert.doesNotMatch(built.hud, /H assumed/, prompt);
      assert.doesNotMatch(built.cover, /tall assumed|you typed/, prompt);
    }
    assert.deepEqual(slopeEnds(generateFromPrompt("under stairs shelves 72 wide 16 deep 24 on the left 60 on the right")), { left: 24, right: 60 });
    assert.deepEqual(slopeEnds(generateFromPrompt("sloped ceiling shelves 48 wide 12 deep 30 on the left 60 on the right")), { left: 30, right: 60 });
  });
});
