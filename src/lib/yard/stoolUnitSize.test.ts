/**
 * A stool (and the chair on the same seat reader) keeps a width or depth typed with a unit mark.
 * "24\" wide" and "24 inches wide" build the same stool as "24 wide". The inches come from the one
 * length reader. A comma and a hyphenated "N-inch" stay release's read. A count of feet is not a size.
 */
import { it } from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import { generateFromPrompt } from "./promptMain";
import { buildPlan } from "./report";

const SEED = 20261106;

function grade(q: string) {
  const p = generateFromPrompt(q);
  const pl = buildPlan(p);
  return {
    name: p.name,
    o: [p.overall.width, p.overall.depth, p.overall.height] as const,
    steps: pl.instructions.map((s) => s.title),
    bom: pl.bom.map((b) => [b.name, b.quantity] as const),
  };
}

const same = (a: string, b: string) => assert.deepEqual(grade(a), grade(b), `${a} != ${b}`);

it("a stool keeps a unit-marked size beside a feature word", () => {
  same('stool 24" wide with two drawers', "stool 24 wide with two drawers");
  same("stool 24 inches wide with two drawers", "stool 24 wide with two drawers");
  same("stool 24 inch wide with two drawers", "stool 24 wide with two drawers");
  same("stool 24 in wide with two drawers", "stool 24 wide with two drawers");
  same('stool 18" deep with three shelves', "stool 18 deep with three shelves");
  same("stool 18 inches deep with three shelves", "stool 18 deep with three shelves");
  // The same drop happened with no feature word. The unit-marked stool matches the bare twin.
  same('stool 24" wide', "stool 24 wide");
  same("stool 24 inches wide", "stool 24 wide");
  same('stool 18" deep', "stool 18 deep");
  same('stool 24" wide 18" deep with two drawers', "stool 24 wide 18 deep with two drawers");
  same('stool with two drawers 24" wide', "stool with two drawers 24 wide");
  same('a 24" wide stool with two drawers', "a 24 wide stool with two drawers");
  same('stool 24 1/2" wide with two drawers', "stool 24 1/2 wide with two drawers");
  same("stool twenty-four inches wide with two drawers", "stool 24 wide with two drawers");
  same("stool 2 feet wide with two drawers", "stool 24 wide with two drawers");
  same("stool 2 ft wide with two drawers", "stool 24 wide with two drawers");
  same('chair 20" wide with a drawer', "chair 20 wide with a drawer");
  same('kitchen chair from 1x4 22" wide', "kitchen chair from 1x4 22 wide");
  same("chair 22 inches deep with a shelf", "chair 22 deep with a shelf");
  const held = grade('stool 24" wide with two drawers');
  assert.equal(held.o[0], 24);
  assert.equal(held.name, 'Stool 24" × 18" seat');
  const deep = grade('stool 18" deep with three shelves');
  assert.equal(deep.o[1], 18);
});

it("a unit mark on a stool or chair is the bare axis, on every seat and feature in the class", () => {
  const HOSTS = ["stool", "bar stool", "counter stool", "kitchen stool", "shop stool", "chair"];
  const FEATS = ["", " with two drawers", " with three shelves", " with a door", " with a lid"];
  const MARKS = ['"', " inches", " inch", " in", " in."];
  fc.assert(
    fc.property(
      fc.constantFrom(...HOSTS),
      fc.constantFrom(...FEATS),
      fc.constantFrom("wide", "deep"),
      fc.integer({ min: 14, max: 36 }),
      fc.constantFrom(...MARKS),
      (host, feat, axis, n, mark) => {
        same(`${host} ${n}${mark} ${axis}${feat}`, `${host} ${n} ${axis}${feat}`);
        return true;
      },
    ),
    { seed: SEED, numRuns: 80 },
  );
});

it("feet, a spelled inch, and a marked fraction on a stool match the inches the tip already builds", () => {
  const HOSTS = ["stool", "bar stool", "chair"];
  const FEATS = ["", " with two drawers", " with three shelves"];
  fc.assert(
    fc.property(fc.constantFrom(...HOSTS), fc.constantFrom(...FEATS), fc.integer({ min: 1, max: 4 }), (host, feat, feet) => {
      same(`${host} ${feet} feet wide${feat}`, `${host} ${feet * 12} wide${feat}`);
      same(`${host} ${feet} ft deep${feat}`, `${host} ${feet * 12} deep${feat}`);
      return true;
    }),
    { seed: SEED, numRuns: 24 },
  );
  same('kitchen stool 22" wide with drawers', "kitchen stool 22 wide with drawers");
  same('bar stool 20" deep with a door', "bar stool 20 deep with a door");
});

it("a count of feet, a typed height, and release's comma and hyphen stay as they were", () => {
  same("stool with 4 feet", "stool");
  same("stool with four feet", "stool");
  same("stool and 3 feet", "stool and three feet");
  same('stool 30" tall with two drawers', "stool 30 tall with two drawers");
  same("stool 30 inches tall", "stool 30 tall");
  same("stool 2 feet tall", "stool 24 tall");
  // A comma and a hyphenated "N-inch" stay release's read: the unit mark is still dropped there.
  const comma = grade('stool, 24" wide with two drawers');
  assert.equal(comma.o[0], 18);
  const hyphen = grade("stool 24-inch wide with two drawers");
  assert.equal(hyphen.o[0], 18);
  // Axis word before the number stays unread.
  assert.equal(grade("stool wide 24").o[0], 18);
  // Other hosts already honored a unit mark. They stay on that read.
  same('bench 48" wide with two drawers', "bench 48 wide with two drawers");
  same('desk 60" wide', "desk 60 wide");
  same('table 48" wide with two drawers', "table 48 wide with two drawers");
  same("desk 2 feet wide", "desk 24 wide");
  assert.equal(grade("6 foot shelf").o[2], 72);
  assert.equal(grade("coffee table with 4 feet").o.join("x"), "40x40x18");
  // Climb stools already honored a marked size. They stay that build.
  assert.deepEqual(grade("step stool 24 inches").o, [16, 33, 24]);
  assert.deepEqual(grade("step stool 16 wide").o, [16, 22, 18]);
  assert.deepEqual(grade('step stool 24" wide').o, [24, 22, 18]);
  assert.match(grade("step stool 16 wide").name, /^Step stool/);
});
