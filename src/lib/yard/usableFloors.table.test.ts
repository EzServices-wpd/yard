/**
 * The shared usable-floor table (Critic #103 r2 P1): every family names a size on every axis, from a source, in
 * fractions; carcass families (storage) are floored on a hand's room inside two panels; the measures read builds.
 */
import { it } from "node:test";
import assert from "node:assert/strict";
import { generateFromPrompt } from "./promptMain";
import { checkBuild } from "./invariants";
import { ungroundedParts } from "./grounded";
import { USABLE_FLOORS, HAND_ROLLED_IN, floorFamily, floorOn, isCarcass, leastBay, shelvesWithHandRoom, cleanness } from "./usableFloors";

it("the floor table: every family, every axis, a number and a source", () => {
  for (const f of Object.values(USABLE_FLOORS)) {
    for (const a of ["width", "depth", "height"] as const) {
      assert.ok(f[a].inches > 0 && f[a].why.length > 8 && f[a].source.length > 12, `${f.family} ${a}`);
      assert.ok(!/\d\.\d/.test(f[a].why), `${f.family} ${a}: fractions, never decimals, in what the person reads`);
    }
  }
});

it("carcass families first: a bookcase is storage, floored at a hand's room between two 3/4\" panels", () => {
  const p = generateFromPrompt("bookcase");
  assert.ok(isCarcass(p));
  assert.equal(floorFamily(p), "storage");
  assert.equal(floorOn(p, "width")!.inches, 5.25);
  assert.equal(floorOn(p, "height")!.inches, 5.25);
  assert.equal(floorOn(p, "depth")!.inches, 3.5);
  assert.ok(leastBay(p) >= HAND_ROLLED_IN, "a default bookcase leaves a hand's room in every bay");
  assert.deepEqual(cleanness(p).overlaps, 0);
});

it("the other families read from the same table", () => {
  assert.equal(floorFamily(generateFromPrompt("table")), "table");
  assert.equal(floorFamily(generateFromPrompt("stool")), "seat");
  assert.equal(floorFamily(generateFromPrompt("desk")), "desk");
  assert.equal(floorFamily(generateFromPrompt("abacus")), "measured");
});

it("shelves that fit: a hand's room over each", () => {
  assert.deepEqual(shelvesWithHandRoom(5, 10.5, 0.75), { fit: 1, zoneFor: 27 });
  assert.deepEqual(shelvesWithHandRoom(3, 60, 0.75), { fit: 3, zoneFor: 18 });
  assert.equal(shelvesWithHandRoom(2, 4, 0.75).fit, 0);
});

it("grounded.ts and I1 agree: the same parts reach neither the floor nor a wall, on every build probed", () => {
  const prompts = ["bookcase", "bookcase 30 wide 48 tall", "wall shelf", "floating shelf", "wardrobe", "desk 60 x 30 x 29", "linen closet 31.5 wide 78 tall 16 deep", "toy airplane", "birdhouse", "coat rack 36 wide 12 high 4 deep", "wall cabinet", "cat tree", "step stool", "water wheel", "jewelry box"];
  for (const q of prompts) {
    const p = generateFromPrompt(q);
    const mine = ungroundedParts(p).map((x) => `${x.name} reaches neither the floor nor a wall`).sort();
    const i1 = checkBuild(p, q).filter((v) => v.id === "I1").map((v) => v.msg).sort();
    assert.deepEqual(mine, i1, q);
  }
});
