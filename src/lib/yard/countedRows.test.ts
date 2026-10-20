/**
 * I36 (Critic #90 block d): one class rule for every counted row of rods, swept over widths and counts.
 * - A typed count is never reduced. The thinnest legal parts go first (1x4 posts, 1/2" beads on 1/4" rods, never
 *   under that floor). If the full count still doesn't fit the typed size, nothing is built and the refusal names
 *   the size the full count needs; typing that size builds it. "fit" / "max" never widen (mayWiden, the one place).
 * - Only an untyped count may shrink, and the card says so in plain words, naming the size the full count needs.
 * - Not even one fits: nothing is built, and the refusal names the smallest size that takes one.
 * - Fractional typed widths (Critic #90 block e) take the same fit check: below the minimum nothing is built, never
 *   rounded up; at or above it the build is the typed width, never wider, and its note names that width.
 * - The material pill names the stock that is cut and bought; a refused build names none.
 * Resized water wheels (24", 30") stand on their bases through the support graph (I1).
 */
import { it } from "node:test";
import assert from "node:assert/strict";
import { generateFromPrompt } from "./promptMain.ts";
import { buildPlan } from "./report.ts";
import { checkBuild, i36 } from "./invariants.ts";
import { hiddenOverlaps } from "./solids.ts";
import { rodArrays, rodArrayFailures } from "./rodArrays.ts";
import { AUTO_WIDEN, MAX_TYPED_COUNT, mayWiden, STRICT_SIZE } from "./recipeBuild.ts";
import { riderFloor } from "./rodArrays.ts";
import { NOTHING_BUILT_STOCK, stockPillLabel } from "./stockPill.ts";
import { getCatalogItem } from "./catalog.ts";
import { headerTitle, NOTHING_BUILT_HEADER } from "./pdf.ts";
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
      bad.push(...i36(p, q).map((v) => `${q}: ${v.msg}`));
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

it("I36 catches a bead under its floor, a dropped typed count and an unclear note", () =>
  offline(() => {
    const p = generateFromPrompt("abacus 10 wide 15 rods");
    const [arr] = rodArrays(p.panels);
    const b = arr.strung[0][0];
    const thin = { ...p, panels: p.panels.map((x) => (x === b ? { ...x, size: { ...x.size, width: 0.375, depth: 0.375 } } : x)) };
    assert.ok(i36(thin, "abacus 10 wide 15 rods").some((v) => /under the 1\/2"/.test(v.msg)));
    const dropped = { ...p, panels: p.panels.filter((x) => x !== arr.rods[14] && !arr.strung[14].includes(x)) };
    assert.ok(i36(dropped, "abacus 10 wide 15 rods").some((v) => /typed 15 rods, built 14/.test(v.msg)));
    assert.ok(i36({ ...p, cardNote: `Assumed 2 rods: 9 rods don't fit in 3"; built 3" with 2.` }, "abacus 10 wide 15 rods").some((v) => /unclearly/.test(v.msg)));
    assert.ok(i36({ ...p, refused: "No." }, "abacus").some((v) => /still built/.test(v.msg)));
  }));

it("resized water wheels stand: the cross rail rests on the bases at 24\" and 30\" (I1)", () =>
  offline(() => {
    for (const q of ["water wheel 24 wide", "water wheel 30 wide", "garden water wheel 24 wide", "water wheel"]) {
      const p = generateFromPrompt(q);
      assert.deepEqual(checkBuild(p, q).filter((v) => v.id === "I1").map((v) => v.msg), [], q);
    }
  }));

const NOTE1 = (w: string) => `Only 1 rod fits in ${w}" wide (each needs 9/16" for 1/2" beads). A full 9-rod abacus needs 6 9/16".`;
const NONE = (w: string) => `An abacus needs at least 2 1/16" wide for 1 rod (each needs 9/16" for 1/2" beads). A full 9-rod abacus needs 6 9/16". Nothing is built at ${w}".`;

it("fractional typed widths take the same fit check: built at the typed width, or refused below the minimum (Critic #90e)", () =>
  offline(() => {
    for (const w of ["2 1/8", "2 3/16", "2 1/4", "2 5/16", "2 3/8", "2 7/16"]) {
      const q = `abacus ${w} wide`;
      const p = generateFromPrompt(q);
      assert.equal(p.refused, undefined, q);
      assert.equal(rods(p), 1, q);
      assert.ok(Math.abs(extent(p) - shopIn(w)) < 1 / 64, `${q}: ${extent(p)}" wide, never rounded up`);
      assert.equal(p.cardNote, NOTE1(w), q);
      assert.ok(beads(p).every((b) => b.size.width >= 0.5 - 1e-6), `${q}: bead under 1/2"`);
      assert.deepEqual(i36(p, q).map((v) => v.msg), [], q);
      assert.deepEqual(hiddenOverlaps(p), [], q);
      assert.deepEqual(rodArrayFailures(p), [], q);
    }
    const refuse: [string, string][] = [
      ["abacus 1 1/2 wide", NONE("1 1/2")],
      ["abacus 1 9/16 wide", NONE("1 9/16")],
      ["abacus 1 wide 1 rod", `1 rod doesn't fit in 1" wide (each needs 9/16" for 1/2" beads). A 1-rod abacus needs 2 1/16" wide. Nothing is built: make it 2 1/16" wide.`],
      ["abacus 1 1/4 wide 2 rods", `2 rods don't fit in 1 1/4" wide (each needs 9/16" for 1/2" beads). A 2-rod abacus needs 2 5/8" wide. Nothing is built: make it 2 5/8" wide.`],
      ["abacus 1 3/8 wide 1 rod", `1 rod doesn't fit in 1 3/8" wide (each needs 9/16" for 1/2" beads). A 1-rod abacus needs 2 1/16" wide. Nothing is built: make it 2 1/16" wide.`],
    ];
    for (const [q, why] of refuse) {
      const p = generateFromPrompt(q);
      assert.equal(p.panels.length, 0, `${q}: nothing is built`);
      assert.equal(buildPlan(p).totals.estCostUsd, 0, q);
      assert.equal(p.refused, why, q);
      assert.deepEqual(i36(p, q).map((v) => v.msg), [], q);
    }
    for (const q of ["abacus 2 1/8 wide 1 rod", "abacus 2 3/8 wide 1 rod", "abacus 2 5/8 wide 2 rods"]) {
      const p = generateFromPrompt(q);
      assert.equal(rods(p), Number(q.match(/(\d+) rods?$/)![1]), q);
      assert.ok(Math.abs(extent(p) - shopIn(q.match(/abacus (.+) wide/)![1])) < 1 / 64, q);
      assert.equal(p.cardNote, undefined, q);
    }
  }));

it("1/16\" sweep 1 1/2-3 (default, 1, 2 rods) and 1 1/2 wide with more rods: the minimum is exact, never rounded up", () =>
  offline(() => {
    const bad: string[] = [];
    for (const n of [null, 1, 2]) {
      let firstBuilt: number | null = null, named: number | null = null;
      for (let k = 24; k <= 48; k++) {
        const w = k / 16;
        const ws = `${Math.floor(w)}${k % 16 ? ` ${[k % 16, 16].map((x, _, a) => x / gcd(a[0], a[1])).join("/")}` : ""}`;
        const q = n == null ? `abacus ${ws} wide` : `abacus ${ws} wide ${n} ${n === 1 ? "rod" : "rods"}`;
        const p = generateFromPrompt(q);
        bad.push(...i36(p, q).map((v) => `${q}: ${v.msg}`));
        if (p.refused) {
          if (p.panels.length) bad.push(`${q}: refused but built`);
          const m = p.refused.match(/needs (?:at least )?(\d+(?: \d+\/\d+)?)" wide/)?.[1];
          if (!m) bad.push(`${q}: refusal names no width`);
          else named = shopIn(m);
          if (firstBuilt != null) bad.push(`${q}: refused above ${firstBuilt}" that built`);
          continue;
        }
        firstBuilt ??= w;
        if (Math.abs(extent(p) - w) > 1 / 64) bad.push(`${q}: built ${extent(p).toFixed(3)}" wide, typed ${w}"`);
        if (n != null && rods(p) !== n) bad.push(`${q}: ${rods(p)} rods`);
        if (beads(p).some((b) => b.size.width < 0.5 - 1e-6)) bad.push(`${q}: bead under 1/2"`);
        bad.push(...rodArrayFailures(p).map((m) => `${q}: ${m}`), ...hiddenOverlaps(p).slice(0, 1).map(() => `${q}: overlap`));
      }
      // The width the refusal names is the first width that builds.
      if (named !== firstBuilt) bad.push(`${n ?? "default"} rods: refusal names ${named}", first build at ${firstBuilt}"`);
    }
    for (const n of [2, 3, 5, 9, 15, 20]) {
      const q = `abacus 1 1/2 wide ${n} rods`;
      const p = generateFromPrompt(q);
      if (p.panels.length || !p.refused) bad.push(`${q}: built ${rods(p)} rods with beads ${beads(p).map((b) => b.size.width.toFixed(2)).join(",")}`);
    }
    assert.deepEqual(bad, []);
  }));
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);

it("bead-size floor: a 1/4\" rod's bead is never under 1/2\" in any built row, and a width that would need one refuses", () =>
  offline(() => {
    assert.equal(riderFloor(0.25), 0.5);
    for (const q of ["abacus 2 1/16 wide", "abacus 3 wide", "abacus 3 3/16 wide 3 rods", "abacus 8 1/4 wide 12 rods", "abacus 10 wide 15 rods", "abacus 30 rods", "abacus 6 wide"]) {
      const p = generateFromPrompt(q);
      assert.ok(p.panels.length, q);
      assert.ok(beads(p).every((b) => Math.min(b.size.width, b.size.depth) >= 0.5 - 1e-6), q);
    }
    for (const q of ["abacus 3 wide 3 rods", "abacus 1 1/2 wide 20 rods", "abacus 3 1/8 wide 3 rods", "abacus 8 3/16 wide 12 rods"]) assert.equal(generateFromPrompt(q).panels.length, 0, q);
  }));

it("the material pill names the stock that is cut and bought; a refused build names none", () =>
  offline(() => {
    for (const q of ["abacus 2 wide", "abacus 1 1/2 wide", "abacus 8 wide 12 rods", "abacus 1 wide 1 rod"]) {
      const p = generateFromPrompt(q);
      assert.equal(stockPillLabel(p, null).label, NOTHING_BUILT_STOCK, q);
    }
    for (const q of ["abacus", "abacus 3 wide", "abacus 2 1/4 wide", "abacus 8 1/4 wide 12 rods", "abacus 10 wide 15 rods"]) {
      const p = generateFromPrompt(q);
      const plan = buildPlan(p);
      const label = stockPillLabel(p, plan).label;
      assert.equal(label, getCatalogItem(p.primaryMaterialId)?.name, q);
      assert.ok(p.panels.some((x) => x.materialId === p.primaryMaterialId), `${q}: the pill's ${label} is cut`);
      assert.ok(plan.bom.some((b) => b.catalogId === p.primaryMaterialId), `${q}: the pill's ${label} is bought`);
    }
  }));

it("I36 catches a row built under its minimum or past a typed width, and a note naming another width", () =>
  offline(() => {
    const p = generateFromPrompt("abacus");
    const msgs = i36(p, "abacus 1 1/2 wide").map((v) => v.msg);
    assert.ok(msgs.some((m) => /past the 1 1\/2" typed/.test(m)), msgs.join("; "));
    assert.ok(msgs.some((m) => /9 rods built at 1 1\/2", under the/.test(m)), msgs.join("; "));
    const q = generateFromPrompt("abacus 2 1/2 wide");
    assert.ok(i36(q, "abacus 2 1/4 wide").some((v) => /the card says "2 1\/2"" but 2 1\/4" was typed/.test(v.msg)));
  }));

it("a refused build's header names what was asked for and says nothing was built, never a fallback family or a size", () =>
  offline(() => {
    // Every refusal path #90 adds: no rod fits, a typed count that doesn't fit (plain and fit/max), a count past the cap.
    const asked: [string, string][] = [
      ["abacus 2 wide", "Abacus"], ["abacus 1 1/2 wide", "Abacus"], ["abacus 1 wide 1 rod", "Abacus"], ["abacus 1 1/4 wide 2 rods", "Abacus"],
      ["abacus 8 wide 12 rods", "Abacus"], ["abacus to fit 8 wide 12 rods", "Abacus"], ["abacus 8 wide max 12 rods", "Abacus"],
      [`abacus ${MAX_TYPED_COUNT + 12} rods`, "Abacus"], ["kids abacus 2 wide", "Abacus"], ["abacus 2 wide in oak", "Oak Abacus"],
    ];
    for (const [q, name] of asked) {
      const p = generateFromPrompt(q);
      assert.ok(p.refused && !p.panels.length, `${q}: refused`);
      const h = headerTitle(p);
      assert.equal(h, `${name} · ${NOTHING_BUILT_HEADER}`, q);
      assert.doesNotMatch(h, /workbench|"|\d/i, `${q}: no fallback family, no size`);
    }
    // The fit step's own refusals (behind the early check) go through the same header.
    const built = generateFromPrompt("abacus 3 wide");
    assert.equal(headerTitle({ ...built, panels: [], refused: "3 rods don't fit in 3\" wide." }), `Abacus · ${NOTHING_BUILT_HEADER}`);
    // A build that is not refused keeps its sized header.
    assert.match(headerTitle(built), /^Abacus · 3" W/);
  }));

it("2 1/16 wide: the full-width rails keep the typed width (a 2x4 laid across, never a centred 2x2), posts take the thinnest 1x4", () =>
  offline(() => {
    for (const w of ["2 1/16", "2 1/8", "2 1/4", "2 5/8"]) {
      const q = `abacus ${w} wide`;
      const p = generateFromPrompt(q);
      for (const r of p.panels.filter((x) => /rail$/.test(x.name))) {
        assert.ok(Math.abs(r.size.width - shopIn(w)) < 1 / 64, `${q}: ${r.name} spans ${r.size.width}", typed ${w}"`);
        assert.ok(Math.abs(r.position.x) < 1e-6, `${q}: ${r.name} flush with the frame`);
      }
      for (const post of p.panels.filter((x) => /post$/.test(x.name))) assert.equal(post.materialId, "lumber-1x4-8", `${q}: ${post.name}`);
    }
  }));
