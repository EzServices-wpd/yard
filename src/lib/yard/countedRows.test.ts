/**
 * I33 (Critic #90 block d): one class rule for every counted row of rods, swept over widths and counts.
 * - A typed count is never reduced. The thinnest legal parts go first (1x4 posts, 1/2" beads on 1/4" rods, never
 *   under that floor). If the full count still doesn't fit the typed size, nothing is built and the refusal names
 *   the size the full count needs; typing that size builds it. "fit" / "max" never widen (mayWiden, the one place).
 * - Only an untyped count may shrink, and the card says so in plain words, naming the size the full count needs.
 * - Not even one fits: nothing is built, and the refusal names the smallest size that takes one.
 * Resized water wheels (24", 30") stand on their bases through the support graph (I1).
 */
import { it } from "node:test";
import assert from "node:assert/strict";
import { generateFromPrompt } from "./promptMain.ts";
import { buildPlan } from "./report.ts";
import { checkBuild, i33 } from "./invariants.ts";
import { hiddenOverlaps } from "./solids.ts";
import { rodArrays, rodArrayFailures } from "./rodArrays.ts";
import { AUTO_WIDEN, MAX_TYPED_COUNT, mayWiden, STRICT_SIZE } from "./recipeBuild.ts";
import { offline } from "../../../scripts/eval-lib.ts";
import type { YardProject } from "./types.ts";

const rods = (p: YardProject) => p.panels.filter((x) => /^rod \d+$/.test(x.name)).length;
const beads = (p: YardProject) => p.panels.filter((x) => /^bead \d+$/.test(x.name));
const extent = (p: YardProject) => {
  const xs = p.panels.flatMap((x) => [x.position.x, x.position.x + x.size.width]);
  return Math.max(...xs) - Math.min(...xs);
};
const shopIn = (t: string) => { const m = t.match(/^(\d+)(?: (\d+)\/(\d+))?$/)!; return Number(m[1]) + (m[2] ? Number(m[2]) / Number(m[3]) : 0); };

it("must-pass prompts: typed counts kept or refused plainly, 3 wide stays 3\" with 0 overlaps", () =>
  offline(() => {
    const ten = generateFromPrompt("abacus 10 wide 15 rods");
    assert.equal(rods(ten), 15, "10 wide 15 rods builds 15, never a silent 12");
    assert.ok(Math.abs(extent(ten) - 10) < 0.01);
    assert.deepEqual(hiddenOverlaps(ten), []);

    const two = generateFromPrompt("abacus 2 wide");
    assert.equal(two.panels.length, 0, "2 wide sells no empty frame");
    assert.equal(buildPlan(two).totals.estCostUsd, 0);
    assert.match(two.refused ?? "", /needs at least 2 1\/16" wide for 1 rod/);

    const three = generateFromPrompt("abacus 3 wide");
    assert.equal(three.cardNote, `Only 2 rods fit in 3" wide (each needs 9/16" for 1/2" beads). A full 9-rod abacus needs 6 9/16".`);
    assert.ok(Math.abs(extent(three) - 3) < 0.01);
    assert.deepEqual(hiddenOverlaps(three), []);
    const four = generateFromPrompt("abacus 4 wide");
    assert.equal(four.cardNote, `Only 4 rods fit in 4" wide (each needs 9/16" for 1/2" beads). A full 9-rod abacus needs 6 9/16".`);

    const t33 = generateFromPrompt("abacus 3 wide 3 rods");
    assert.ok(beads(t33).every((b) => b.size.width >= 0.5 - 1e-6), "never a 3/8\" bead under the 1/2\" floor");
    assert.equal(t33.panels.length, 0);
    assert.equal(t33.refused, `3 rods don't fit in 3" wide (each needs 9/16" for 1/2" beads). A 3-rod abacus needs 3 3/16" wide. Nothing is built: make it 3 3/16" wide, or ask for 2 rods.`);

    const eight = generateFromPrompt("abacus 8 wide 12 rods");
    assert.equal(eight.panels.length, 0, "12 typed rods never become 11");
    assert.equal(eight.refused, `12 rods don't fit in 8" wide (each needs 9/16" for 1/2" beads). A 12-rod abacus needs 8 1/4" wide. Nothing is built: make it 8 1/4" wide, or ask for 11 rods.`);
  }));

it("class sweep: every width 2-12 by every count 1-24, typed and untyped", () =>
  offline(() => {
    const bad: string[] = [];
    for (let w = 2; w <= 12; w += 0.5) for (const n of [null, 1, 2, 3, 5, 7, 9, 12, 15, 18, 24]) {
      const q = n == null ? `abacus ${w} wide` : `abacus ${w} wide ${n} rods`;
      const p = generateFromPrompt(q);
      bad.push(...i33(p, q).map((v) => `${q}: ${v.msg}`));
      if (p.refused) {
        // The size a refusal names really builds the full count.
        const named = p.refused.match(/needs (?:at least )?(\d+(?: \d+\/\d+)?)" wide/)?.[1];
        if (!named) { bad.push(`${q}: refusal names no width`); continue; }
        const at = shopIn(named);
        if (at <= w) bad.push(`${q}: refusal names ${named}", not wider than the ${w}" typed`);
        const again = generateFromPrompt(n == null ? `abacus ${named} wide ${/for 1 rod/.test(p.refused) ? 1 : 9} rods` : `abacus ${named} wide ${n} rods`);
        if (again.refused) bad.push(`${q}: the ${named}" it names refuses too`);
        else if (rodArrayFailures(again).length || hiddenOverlaps(again).length) bad.push(`${q}: the ${named}" it names doesn't fit`);
        continue;
      }
      if (Math.abs(extent(p) - w) > 1 / 32) bad.push(`${q}: ${extent(p).toFixed(3)}" wide, typed ${w}"`);
      if (n != null && rods(p) !== n) bad.push(`${q}: ${rods(p)} rods`);
      if (beads(p).some((b) => b.size.width < 0.5 - 1e-6)) bad.push(`${q}: bead under 1/2"`);
      bad.push(...rodArrayFailures(p).map((m) => `${q}: ${m}`), ...hiddenOverlaps(p).slice(0, 1).map(() => `${q}: overlap`));
    }
    assert.deepEqual(bad, []);
  }));

it("an untyped width grows to a typed count and says so; a count past the cap is refused, never cut back", () =>
  offline(() => {
    const p = generateFromPrompt("abacus 30 rods");
    assert.equal(rods(p), 30);
    assert.equal(p.cardNote, `30 rods need 18 3/8" wide; built 18 3/8" wide.`);
    assert.deepEqual(rodArrayFailures(p), []);
    assert.ok(beads(p).every((b) => b.size.width >= 0.5 - 1e-6));
    const many = generateFromPrompt(`abacus ${MAX_TYPED_COUNT + 12} rods`);
    assert.equal(many.panels.length, 0);
    assert.match(many.refused ?? "", new RegExp(`ask for ${MAX_TYPED_COUNT} or fewer`));
  }));

it("one auto-widen decision: off today; a typed size wins; fit/max never widens", () => {
  assert.equal(AUTO_WIDEN, 0);
  assert.equal(mayWiden(8.25, 8, false), false);
  assert.equal(mayWiden(8.25, undefined, false), true);
  assert.equal(mayWiden(8, 8, false), true);
  assert.equal(mayWiden(8.01, 8, true), false);
  for (const q of ["abacus to fit 8 wide 12 rods", "abacus 8 wide max 12 rods", "abacus at most 8 wide 12 rods"]) assert.ok(STRICT_SIZE.test(q), q);
  assert.ok(!STRICT_SIZE.test("abacus 8 wide 12 rods"));
  offline(() => {
    for (const q of ["abacus to fit 8 wide 12 rods", "abacus 8 wide max 12 rods"]) assert.equal(generateFromPrompt(q).panels.length, 0, q);
  });
});

it("I33 catches a bead under its floor, a dropped typed count and an unclear note", () =>
  offline(() => {
    const p = generateFromPrompt("abacus 10 wide 15 rods");
    const [arr] = rodArrays(p.panels);
    const b = arr.strung[0][0];
    const thin = { ...p, panels: p.panels.map((x) => (x === b ? { ...x, size: { ...x.size, width: 0.375, depth: 0.375 } } : x)) };
    assert.ok(i33(thin, "abacus 10 wide 15 rods").some((v) => /under the 1\/2"/.test(v.msg)));
    const dropped = { ...p, panels: p.panels.filter((x) => x !== arr.rods[14] && !arr.strung[14].includes(x)) };
    assert.ok(i33(dropped, "abacus 10 wide 15 rods").some((v) => /typed 15 rods, built 14/.test(v.msg)));
    assert.ok(i33({ ...p, cardNote: `Assumed 2 rods: 9 rods don't fit in 3"; built 3" with 2.` }, "abacus 10 wide 15 rods").some((v) => /unclearly/.test(v.msg)));
    assert.ok(i33({ ...p, refused: "No." }, "abacus").some((v) => /still built/.test(v.msg)));
  }));

it("resized water wheels stand: the cross rail rests on the bases at 24\" and 30\" (I1)", () =>
  offline(() => {
    for (const q of ["water wheel 24 wide", "water wheel 30 wide", "garden water wheel 24 wide", "water wheel"]) {
      const p = generateFromPrompt(q);
      assert.deepEqual(checkBuild(p, q).filter((v) => v.id === "I1").map((v) => v.msg), [], q);
    }
  }));
