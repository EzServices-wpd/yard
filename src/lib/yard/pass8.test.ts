import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generateFromPrompt } from "./promptMain";
import { inchFrac } from "./inchText";

const build = (prompt: string) => {
  const p = generateFromPrompt(prompt);
  return { p, notes: (p.notes ?? []).join(" ") };
};
const size = (o: { width: number; height: number; depth: number }) => `${inchFrac(o.width)}" × ${inchFrac(o.height)}" × ${inchFrac(o.depth)}"`;
/** The model's own depth: every panel's front face, back to front. */
const panelDepth = (p: ReturnType<typeof generateFromPrompt>) =>
  Math.max(...p.panels.map((x) => x.position.z + x.size.depth)) - Math.min(...p.panels.map((x) => x.position.z));

describe("floating / cleat shelves: long is the width, the shelf rests on its cleat, the title says it", () => {
  it("walnut 1x10 floating shelf 30 long", () => {
    const { p, notes } = build("walnut 1x10 floating shelf 30 long");
    assert.equal(p.overall.width, 30);
    assert.doesNotMatch(notes, /Assumed [^.]*wide/);
    assert.equal(p.overall.depth, 9.25, "the 9 1/4 board rests on the cleat under its back edge");
    assert.equal(panelDepth(p), p.overall.depth);
    assert.ok(p.name.endsWith(size(p.overall)), p.name);
    assert.doesNotMatch(notes, /hush|No box|Shelf backstop is/);
  });
  it("a typed depth is the whole depth, and a lip / backstop shelf stays inside it", () => {
    for (const prompt of ["floating shelf 30 wide 10 deep", "floating shelf with lip 24 wide 6 tall"]) {
      const { p } = build(prompt);
      assert.ok(Math.abs(panelDepth(p) - p.overall.depth) < 0.01, `${prompt}: model ${panelDepth(p)} vs ${p.overall.depth}`);
      assert.ok(p.name.endsWith(size(p.overall)), p.name);
    }
    assert.equal(build("floating shelf 30 wide 10 deep").p.overall.depth, 10);
  });
});

describe("popsicle picture frame: one photo, one outer size", () => {
  it("4x6 photo: the outer the notes say is the model's", () => {
    const { p, notes } = build("popsicle stick photo frame 4x6");
    assert.match(p.name, /4×6 photo/);
    const outer = notes.match(/outer ([\d /]+)" × ([\d /]+)" face/);
    assert.ok(outer, notes);
    assert.equal(inchFrac(p.overall.width), outer![1]);
    assert.match(p.notes?.[0] ?? "", new RegExp(size(p.overall).replace(/[/]/g, "\\/")));
    assert.doesNotMatch(notes, /Assumed/);
  });
  it("a typed frame size picks the photo the title names", () => {
    const { p, notes } = build("popsicle stick picture frame 6 inch");
    const photo = p.name.match(/· ([\d /]+)×([\d /]+) photo/);
    assert.ok(photo, p.name);
    assert.match(notes, new RegExp(`${photo![1]}" × ${photo![2]}" photo behind`));
    assert.ok(Math.abs(p.overall.height - 6) <= 0.125, `height ${p.overall.height}`);
  });
});

describe("door-front carcase: the door closes inside the typed depth", () => {
  it("medicine cabinet 20 x 26 x 5: carcase, door and mirror stack to exactly 5", () => {
    const { p, notes } = build("medicine cabinet 20 wide 26 tall 5 deep");
    const door = p.panels.find((x) => x.type === "door")!;
    const mirror = p.panels.find((x) => x.type === "mirror")!;
    const upright = p.panels.find((x) => x.type === "upright")!;
    assert.ok(Math.abs(upright.position.z + upright.size.depth - door.position.z) < 0.01);
    assert.ok(Math.abs(mirror.position.z - (door.position.z + door.size.depth)) < 0.01);
    assert.ok(Math.abs(panelDepth(p) - 5) < 0.01, `model ${panelDepth(p)}`);
    assert.doesNotMatch(notes, /stand proud/);
  });
});

describe("cheap leftovers", () => {
  it("a fallback title carries the model size", () => {
    const { p } = build("cat feeding station");
    assert.ok(p.name.endsWith(size(p.overall)), p.name);
  });
  it("a broom cabinet is about 24 wide", () => {
    assert.equal(build("broom cabinet").p.overall.width, 24);
  });
});
