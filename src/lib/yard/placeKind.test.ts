/**
 * A size typed against a place binds by the kind of place, from one shared notion.
 * An opening is width × height. A surface is width × depth. A triple keeps release's order.
 * A lumber nominal is stock. A feet pair is inches.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { generateFromPrompt } from "./promptMain";
import { buildPlan } from "./report";
import { normalizeUserPrompt } from "./voiceHonesty";
import { bareSharesFeet, placeKind, placePair, pairInches } from "./sizePhrases";

globalThis.fetch = (() => Promise.reject(new Error("offline"))) as typeof fetch;

const near = (a: number, b: number) => Math.abs(a - b) < 0.05;

function box(prompt: string) {
  const project = generateFromPrompt(prompt);
  const plan = buildPlan(project);
  return {
    project,
    o: project.overall,
    price: plan.totals.estCostUsd,
    pieces: plan.totals.pieces,
    notes: (project.notes ?? []).join("\n"),
  };
}

test("place kind is one notion: openings across and up, surfaces across and back", () => {
  for (const noun of ["closet", "closets", "niche", "alcove", "cutout", "cut-out", "doorway", "nook", "recess"]) {
    assert.equal(placeKind(noun), "opening", noun);
  }
  for (const noun of ["spot", "corner", "floor", "garage", "yard", "backyard", "patio", "table", "garden"]) {
    assert.equal(placeKind(noun), "surface", noun);
  }
  assert.equal(placeKind("dog"), null);
  assert.equal(placeKind("vase"), null);
});

test("an opening pair is width × height, and the depth stays the class default", () => {
  const rows: [string, number, number][] = [
    ["shelves for a 30 by 80 closet", 30, 80],
    ["storage cabinet into a 30 by 60 closet", 30, 60],
    ["shelf that fits in a 24 by 36 niche", 24, 36],
    ["shelf that fits in a 12 by 30 nook", 12, 30],
    ["cabinet for a 14 by 30 cutout", 14, 30],
    ["shelf in a 16 by 48 alcove", 16, 48],
    ["cabinet for a 18 by 40 doorway", 18, 40],
    ["bookcase that fits in a 22 by 48 recess", 22, 48],
  ];
  for (const [q, w, h] of rows) {
    const pair = placePair(q);
    assert.equal(pair?.otherAxis, "height", q);
    assert.equal(pair?.kind, "opening", q);
    const b = box(q);
    assert.ok(near(b.o.width, w), `${q} width ${b.o.width}`);
    assert.ok(near(b.o.height, h), `${q} height ${b.o.height}`);
    assert.ok(!near(b.o.depth, h) || near(h, b.o.depth) && h < 20, `${q} depth ${b.o.depth} stole the height`);
    assert.ok(b.o.depth < h || b.o.depth <= 24, `${q} depth ${b.o.depth} is a footprint, not the opening height`);
  }
  const linen = box("shelves for a 30 by 80 closet");
  assert.equal(linen.price.toFixed(2), "193.68");
  assert.equal(linen.pieces, 11);
  assert.deepEqual([linen.o.width, linen.o.height, linen.o.depth], [30, 80, 16]);
});

test("a surface pair is width × depth, and the height stays the class default", () => {
  const night = box("nightstand for a 20 by 16 spot");
  assert.deepEqual([night.o.width, night.o.height, night.o.depth], [20, 24, 16]);
  assert.doesNotMatch(night.notes, /Assumed 20" tall/);
  assert.match(night.notes, /Assumed 24" tall/);

  const flipped = box("nightstand for a 16 by 20 spot");
  assert.deepEqual([flipped.o.width, flipped.o.height, flipped.o.depth], [16, 24, 20]);
  assert.match(flipped.notes, /Assumed 24" tall/);
  assert.doesNotMatch(flipped.notes, /Assumed 20" tall/);

  const corner = box("bench for a 40 by 22 corner");
  assert.ok(near(corner.o.width, 40), `corner width ${corner.o.width}`);
  assert.ok(near(corner.o.depth, 22), `corner depth ${corner.o.depth}`);
  assert.ok(!near(corner.o.height, 22), `corner height stole 22 (${corner.o.height})`);

  const dog = box("bed for my dog 30 x 40");
  assert.deepEqual([dog.o.width, dog.o.height, dog.o.depth], [30, 10, 40]);
  assert.doesNotMatch(dog.notes, /Assumed 48" deep/);
  assert.match(dog.notes, /Assumed 10" tall/);
});

test("a place triple keeps release's width × depth × height order", () => {
  const rows: [string, number, number, number][] = [
    ["nightstand for a 20 by 16 by 24 spot", 20, 24, 16],
    ["bookcase for a 30 by 12 by 72 nook", 30, 72, 12],
    ["shelf for a 30 by 12 by 48 nook", 30, 48, 12],
    ["cabinet for a 24 by 18 by 30 space", 24, 30, 18],
    ["bench for a 48 by 16 by 18 spot", 48, 18, 16],
  ];
  for (const [q, w, h, d] of rows) {
    assert.equal(placePair(q), null, q);
    const b = box(q);
    assert.deepEqual([b.o.width, b.o.height, b.o.depth], [w, h, d], q);
  }
});

test("a lumber nominal in front of a noun is still stock, not a place", () => {
  const tool = box("1x6x8 toolbox");
  assert.equal(placePair("1x6x8 toolbox"), null);
  assert.equal(tool.project.name, "Toolbox");
  assert.deepEqual([tool.o.width, tool.o.height, tool.o.depth], [40, 34, 22]);
  assert.equal(tool.price.toFixed(2), "13.45");
  assert.equal(tool.pieces, 6);

  const bird = box("1x6x6 birdhouse");
  assert.equal(placePair("1x6x6 birdhouse"), null);
  assert.equal(bird.project.name, "Birdhouse");
  assert.ok(near(bird.o.width, 6.875), `bird width ${bird.o.width}`);
  assert.ok(near(bird.o.height, 11.8125) || near(bird.o.height, 11.81), `bird height ${bird.o.height}`);
  assert.ok(near(bird.o.depth, 7.5), `bird depth ${bird.o.depth}`);
  assert.equal(bird.price.toFixed(2), "60.92");
  assert.equal(bird.pieces, 7);
});

test("feet in a place pair become inches, never a 6 inch footprint", () => {
  const play = box("playhouse for my kids backyard 6x6");
  assert.deepEqual(placePair("playhouse for my kids backyard 6x6"), {
    kind: "surface",
    width: 72,
    other: 72,
    otherAxis: "depth",
  });
  assert.ok(near(play.o.width, 72), `6x6 width ${play.o.width}`);
  assert.ok(near(play.o.depth, 72), `6x6 depth ${play.o.depth}`);
  assert.ok(play.o.width > 48, "6x6 must not stay the 48 inch stand-in");

  const eight = box("playhouse for my kids 8x6");
  assert.ok(near(eight.o.width, 96), `8x6 width ${eight.o.width}`);
  assert.ok(near(eight.o.depth, 72), `8x6 depth ${eight.o.depth}`);

  const green = box("greenhouse for my garden 6x8");
  assert.ok(near(green.o.width, 72), `greenhouse width ${green.o.width}`);
  assert.ok(near(green.o.depth, 96), `greenhouse depth ${green.o.depth}`);

  const spot = box("cabinet that fits in a 2 by 1.5 ft spot");
  assert.ok(near(spot.o.width, 24), `ft spot width ${spot.o.width}`);
  assert.ok(near(spot.o.depth, 18), `ft spot depth ${spot.o.depth}`);

  const books = box("bookshelf for a 3 ft by 1 ft spot");
  assert.ok(near(books.o.width, 36), `book width ${books.o.width}`);
  assert.ok(near(books.o.depth, 12), `book depth ${books.o.depth}`);
  assert.ok(!near(books.o.height, 12), `1 ft became the height (${books.o.height})`);

  // A small spot with no feet unit stays inches. A shed on a yard is feet, though neither sentence is a canary.
  const inches = placePair("nightstand for a 10 by 8 spot");
  assert.deepEqual([inches?.width, inches?.other], [10, 8]);
  const shed = placePair("shed for the yard 8x10");
  assert.deepEqual([shed?.width, shed?.other, shed?.otherAxis], [96, 120, "depth"]);
});

test("a bare partner next to feet stays inches unless it is under 7", () => {
  assert.equal(normalizeUserPrompt("table 6 ft by 30"), "table 72 inch by 30 inch");
  assert.equal(normalizeUserPrompt("desk 5 ft by 24"), "desk 60 inch by 24 inch");
  assert.equal(normalizeUserPrompt("desk 60 by 2 ft"), "desk 60 inch by 24 inch");
  assert.equal(normalizeUserPrompt("3 ft by 18 bench"), "36 inch by 18 inch bench");
  assert.match(normalizeUserPrompt("4 ft by 18.5 in bench"), /^48 inch by 18\.5 in bench$/);
  assert.match(normalizeUserPrompt("6' x 30.5\" table"), /^72 inch x 30\.5" table$/);
  assert.equal(normalizeUserPrompt("6' x 30\" table"), '72 inch x 30" table');
  // 2 is under 7, so an inch reading is implausible and it shares the feet unit.
  assert.equal(normalizeUserPrompt("cabinet that fits in a 2 by 1.5 ft spot"), "cabinet that fits in a 24 inch by 18 inch spot");

  const spot = placePair("bench for a 4 ft by 18 spot");
  assert.deepEqual([spot?.width, spot?.other, spot?.otherAxis], [48, 18, "depth"]);
  assert.equal(pairInches(18, "", " ft", true), 18);
  assert.equal(pairInches(12, "", " ft", true), 12);
  assert.equal(pairInches(2, "", " ft", true), 24);
  assert.equal(bareSharesFeet(2), true);
  assert.equal(bareSharesFeet(6), true);
  assert.equal(bareSharesFeet(7), false);

  const table = box("table 6 ft by 30");
  assert.deepEqual([table.o.width, table.o.depth, table.o.height], [72, 30, 30]);
  const desk = box("desk 5 ft by 24");
  assert.ok(near(desk.o.width, 60) && near(desk.o.depth, 24), `desk ${desk.o.width}x${desk.o.depth}x${desk.o.height}`);
  assert.ok(desk.o.depth < 100 && desk.o.height < 100, "desk blew up");
  const wide = box("desk 60 by 2 ft");
  assert.ok(near(wide.o.width, 60), `60 by 2 ft width ${wide.o.width}`);
  const bench = box("3 ft by 18 bench");
  assert.ok(near(bench.o.depth, 18) || near(bench.o.height, 18), `3 ft by 18 ${bench.o.width}x${bench.o.height}x${bench.o.depth}`);
  assert.ok(bench.o.depth < 100 && bench.o.height < 100);
});

test("a bare 7–12 next to feet stays inches", () => {
  const rows: [string, number, number, number][] = [
    ["bookcase 3 ft by 12 deep", 36, 12, 12],
    ["console table 4 ft by 12", 48, 30, 12],
    ["shelf 3 ft by 10 deep", 36, 10, 10],
    ["bench 6 ft by 11", 72, 11, 11],
    ["2x4 bench 4 ft by 12", 48, 12, 12],
    ["desk 4 ft by 10", 48, 29, 10],
    ["shelf 3 ft by 12", 36, 18, 12],
    ["bench 5 ft by 12", 60, 12, 12],
    ["bench 6 ft by 12", 72, 12, 12],
    ["table 3 ft by 12", 36, 30, 12],
    ["bookshelf 3 ft by 12", 36, 84, 12],
    ["raised bed 4 ft by 8", 48, 17.5, 8],
  ];
  for (const [q, w, h, d] of rows) {
    const b = box(q);
    assert.ok(near(b.o.width, w), `${q} width ${b.o.width}`);
    assert.ok(near(b.o.height, h), `${q} height ${b.o.height}`);
    assert.ok(near(b.o.depth, d), `${q} depth ${b.o.depth}`);
  }
  // A 2-inch depth is not a workbench or a desk, so that partner is feet.
  const bench = box("workbench 8 ft by 2");
  assert.ok(near(bench.o.width, 96) && near(bench.o.depth, 24), `workbench ${bench.o.width}x${bench.o.depth}`);
  const desk = box("desk 6 ft by 2");
  assert.ok(near(desk.o.width, 72) && near(desk.o.depth, 24), `desk ${desk.o.width}x${desk.o.depth}`);
});

test("novel prompts: inch partners, short openings, and one small feet partner", () => {
  // Five prompts that are not the critic's list. 7 and 9 stay inches. 16 and 15 are too short to be the height.
  const dresser = box("dresser 5 ft by 8");
  assert.ok(near(dresser.o.width, 60) && near(dresser.o.depth, 8), `dresser ${dresser.o.width}x${dresser.o.depth}x${dresser.o.height}`);
  const coffee = box("coffee table 4 ft by 7");
  assert.ok(near(coffee.o.width, 48) && near(coffee.o.depth, 7), `coffee ${coffee.o.width}x${coffee.o.depth}`);
  const night = box("nightstand 3 ft by 9");
  assert.ok(near(night.o.width, 36) && (near(night.o.depth, 9) || near(night.o.height, 9)), `night ${night.o.width}x${night.o.height}x${night.o.depth}`);
  const alcove = box("bookcase for a 24 by 15 alcove");
  assert.ok(near(alcove.o.width, 24) && near(alcove.o.depth, 15) && alcove.o.height >= 36, `alcove ${alcove.o.width}x${alcove.o.height}x${alcove.o.depth}`);
  const recess = box("shelf for a 18 by 40 recess");
  assert.ok(near(recess.o.width, 18) && near(recess.o.height, 40), `recess ${recess.o.width}x${recess.o.height}x${recess.o.depth}`);
  const pantry = box("pantry for a 28 by 16 nook");
  assert.ok(near(pantry.o.width, 28) && near(pantry.o.depth, 16) && pantry.o.height >= 48, `pantry ${pantry.o.width}x${pantry.o.height}x${pantry.o.depth}`);
});

test("a shallow opening is depth, and a tall opening is height", () => {
  const shallow = placePair("bookshelf for a 30 by 12 nook");
  assert.equal(shallow?.otherAxis, "depth");
  const book = box("bookshelf for a 30 by 12 nook");
  assert.deepEqual([book.o.width, book.o.height, book.o.depth], [30, 84, 12]);
  assert.doesNotMatch(book.notes, /Assumed 12" deep/);
  assert.match(book.notes, /Assumed 84" tall/);

  const fourteen = box("bookshelf for a 30 by 14 nook");
  assert.deepEqual([fourteen.o.width, fourteen.o.height, fourteen.o.depth], [30, 84, 14]);
  const twenty = box("bookshelf for a 30 by 20 nook");
  assert.deepEqual([twenty.o.width, twenty.o.height, twenty.o.depth], [30, 84, 20]);

  const tall = placePair("shelves for a 30 by 80 closet");
  assert.equal(tall?.otherAxis, "height");
  const closet = box("shelves for a 30 by 80 closet");
  assert.deepEqual([closet.o.width, closet.o.height, closet.o.depth], [30, 80, 16]);
  assert.equal(closet.price.toFixed(2), "193.68");
});

test("a bare medicine cabinet does not claim a typed depth", () => {
  const bare = box("medicine cabinet");
  assert.equal(bare.project.fitted?.typedAxes?.depth, false);
  assert.doesNotMatch(bare.notes, /you typed/i);
  assert.match(bare.notes, /Assumed 4" deep/);
  assert.equal(bare.price.toFixed(2), "141.79");

  const deep = box("medicine cabinet 4 deep");
  assert.equal(deep.project.fitted?.typedAxes?.depth, true);
  assert.match(deep.notes, /Finished depth is the 4" you typed/);
});
