/**
 * I35 (F21 typed size): every number typed is the dimension built, to 1/16", whichever way it is written. Live 10-19:
 * 'shelf 24 1/2" wide' built a 2" shelf (each parser read the fraction's last number). Seams: the reader
 * (measureText), the engine (generateFromPrompt), the bar (runYardPrompt) and the invariant itself.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { canonicalMeasures, readNumber, typedMeasures } from "./measureText";
import { generateFromPrompt } from "./promptMain";
import { checkBuild, i35 } from "./invariants";
import { headerTitle } from "./pdf";
import { buildPlan } from "./report";

(globalThis as { window?: unknown }).window = { setTimeout, clearTimeout, location: { search: "" } };
const { runYardPrompt } = await import("../../components/workspace/run-prompt");
const { useYard } = await import("./store");

const quiet = (calls: string[]) => ({
  lookupRecipe: (async () => (calls.push("lookup"), { ok: false, error: "bad" })) as never,
  hintSubject: (async () => (calls.push("hint"), { summary: "", subject: "" })) as never,
  interpretPrompt: (async () => (calls.push("interp"), { ok: false })) as never,
  briefHousePrompt: (async () => (calls.push("house"), { ok: false })) as never,
  proposeRecipeFn: (async () => ({ status: "quiet" })) as never,
});

/** Every shop way of writing a length, and its inches. */
const FORMS: [string, number][] = [["24 1/2", 24.5], ["24½", 24.5], ["24-1/2", 24.5], ["24.5", 24.5], [`24 1/2"`, 24.5], [`2' 1/2"`, 24.5], ["2 ft 6 in", 30], [`2'6"`, 30], ["2 feet 6 inches", 30], [`2' 6 1/2"`, 30.5]];
const AXES = [["wide", "width"], ["deep", "depth"], ["tall", "height"]] as const;

describe("I35: one reader for a typed size", () => {
  it("reads each form as inches", () => {
    for (const [f, n] of FORMS) assert.equal(typedMeasures(`shelf ${f} wide`).width, n, f);
    assert.equal(readNumber("8 1/4"), 8.25);
    assert.equal(readNumber("8-1/4"), 8.25);
    assert.equal(readNumber("3/4"), 0.75);
    assert.equal(readNumber("24½"), 24.5);
  });

  it("leaves stock names alone: a sheet's fraction and a fastener's size are not sizes", () => {
    for (const q of ["1/2 plywood shelf 30 wide", `3/4" ply box`, "3/4 x 4 x 8 plywood box", "1 1/2 inch dowel rack", "2x4 bench 4 ft long"]) assert.equal(canonicalMeasures(q), q);
  });

  for (const noun of ["shelf", "bookcase", "cabinet", "table", "bench"]) {
    it(`${noun}: every form on every axis is the size built, to 1/16"`, () => {
      for (const [f, n] of FORMS) {
        for (const [word, axis] of AXES) {
          const q = `${noun} ${f} ${word}`;
          const p = generateFromPrompt(q);
          assert.ok(Math.abs(p.overall[axis] - n) <= 1 / 16, `${q}: built ${p.overall[axis]}`);
          assert.deepEqual(i35(p, q).map((x) => x.msg), [], q);
        }
        for (const q of [`${noun} ${f} x 14 x 36`, `${noun} 40 x 16 x ${f}`]) {
          const p = generateFromPrompt(q);
          assert.ok([p.overall.width, p.overall.depth, p.overall.height].some((x) => Math.abs(x - n) <= 1 / 16), `${q}: built ${JSON.stringify(p.overall)}`);
          assert.deepEqual(i35(p, q).map((x) => x.msg), [], q);
        }
      }
    });
  }

  it("the answer-key forms build the typed number exactly (main read 2, 2, 2, 2 and 8)", () => {
    const rows: [string, "width" | "height", number][] = [
      ["nightstand 22 1/2 wide", "width", 22.5], ["nightstand 22-1/2 wide", "width", 22.5], [`nightstand 22 1/2" wide`, "width", 22.5],
      ["bookshelf 75 1/2 tall", "height", 75.5], ["farm table 92 5/8 long", "width", 92.625], ["bench 92 5/8 long", "width", 92.625],
    ];
    for (const [q, axis, n] of rows) {
      const p = generateFromPrompt(q);
      assert.equal(p.overall[axis], n, `${q}: built ${p.overall[axis]}`);
      assert.deepEqual(i35(p, q).map((x) => x.msg), [], q);
    }
    assert.equal(canonicalMeasures("farm table 92 5/8 long"), "farm table 92.625 long");
  });

  it('the live repro: shelf 24 1/2" wide builds 24 1/2 on the bar, no learner, cut list sized from it', async () => {
    const calls: string[] = [];
    await runYardPrompt('shelf 24 1/2" wide', { fresh: true, ai: quiet(calls) });
    const p = useYard.getState().project;
    assert.ok(!calls.includes("lookup"), calls.join());
    assert.equal(p.overall.width, 24.5);
    assert.match(headerTitle(p), /24 1\/2" W/);
    const plan = buildPlan(p);
    assert.ok(plan.cutList.some((c) => Math.abs(Math.max(c.lengthIn, c.widthIn) - 24.5) < 1 / 16 || Math.abs(Math.max(c.lengthIn, c.widthIn) - 23) < 1 / 16), plan.cutList.map((c) => `${c.name} ${c.lengthIn}`).join(", "));
  });

  it("linen canary at 31 1/2 x 78 x 16 keeps its header", () => {
    const p = generateFromPrompt("linen closet 31 1/2 wide 78 tall 16 deep");
    assert.equal(headerTitle(p), 'Linen · 31 1/2" W × 16" D × 78" H');
    assert.deepEqual(checkBuild(p, "linen closet 31 1/2 wide 78 tall 16 deep").filter((x) => x.id === "I35" || x.id === "I8"), []);
  });

  it("I35 catches a fraction dropped on the floor", () => {
    const p = generateFromPrompt("shelf 2 wide");
    assert.match(i35(p, "shelf 24 1/2 wide").map((x) => x.msg).join(), /typed 24 1\/2" width, built 2"/);
  });
});
