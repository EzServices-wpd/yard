import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generateFromPrompt } from "./promptMain";

/**
 * Form follows the noun and the size. Stock changes cross-sections, joinery and the Buy list —
 * the kind of thing and its envelope stay put.
 */
const STOCKS = ["from popsicle sticks", "from dowels", "from 1x4 boards", "from 2x4", "from plywood", "from cardboard"];
/** Furniture envelopes match exactly across stocks. */
const FURNITURE = ["bunk bed", "loft bed", "bookshelf", "bench", "raised bed"];
/** Open frames keep their kind; the envelope moves by member size only. */
const FRAMES = ["truss bridge", "lattice tower", "arch", "ladder", "golden gate bridge", "eiffel tower"];
const STOCK_IDS = ["popsicle-standard", "dowel-1-4-36", "lumber-1x4-8", "lumber-2x4-8", "plywood-3-4-4x8", "cardboard-corrugated-sheet"];
/** Board and sheet birdhouses share one cavity; the outside grows by the wall thickness. */
const BOARD_STOCKS = ["from 1x4 boards", "from 2x4", "from plywood", "from cardboard"];

const env = (pr: string, stockId?: string) => {
  const p = generateFromPrompt(pr, stockId);
  return { kind: p.kind, o: [p.overall.width, p.overall.height, p.overall.depth] };
};

describe("stock switch keeps the form", () => {
  for (const item of FURNITURE) {
    it(`${item}: same envelope from every stock`, () => {
      const base = env(`${item} ${STOCKS[3]}`);
      for (const st of STOCKS) {
        const got = env(`${item} ${st}`);
        assert.equal(got.kind, base.kind, `${item} ${st} kind`);
        got.o.forEach((v, i) => assert.ok(Math.abs(v - base.o[i]) < 0.01, `${item} ${st} axis ${i}: ${v} vs ${base.o[i]}`));
      }
    });
  }
  for (const item of FRAMES) {
    it(`${item}: a stock switch keeps the kind and the envelope within member size`, () => {
      for (const start of [" from popsicle sticks", " from 2x4"]) {
        const base = env(`${item}${start}`);
        for (const id of STOCK_IDS) {
          const got = env(`${item}${start}`, id);
          assert.equal(got.kind, base.kind, `${item}${start} -> ${id} kind ${got.kind} vs ${base.kind}`);
          got.o.forEach((v, i) => {
            const tol = Math.max(4, base.o[i] * 0.06);
            assert.ok(Math.abs(v - base.o[i]) <= tol, `${item}${start} -> ${id} axis ${i}: ${v} vs ${base.o[i]}`);
          });
        }
      }
    });
    it(`${item}: a typed size never moves with the typed stock`, () => {
      const base = env(`${item} 30 tall from popsicle sticks`);
      for (const st of STOCKS) {
        const got = env(`${item} 30 tall ${st}`);
        assert.equal(got.kind, base.kind);
        assert.ok(Math.abs(got.o[1] - 30) <= Math.max(4, 30 * 0.06), `${item} 30 tall ${st} height ${got.o[1]}`);
      }
    });
  }
  it("a fresh prompt with no size takes a stock-scaled default: a 2x4 Eiffel stands taller than a popsicle one", () => {
    const pop = env("eiffel tower from popsicle sticks").o[1];
    const lum = env("eiffel tower from 2x4").o[1];
    assert.ok(lum >= pop * 2, `2x4 ${lum} vs popsicle ${pop}`);
  });
  it("birdhouse: board and sheet stocks share the cavity", () => {
    const base = env(`birdhouse ${BOARD_STOCKS[0]}`);
    for (const st of BOARD_STOCKS) {
      const got = env(`birdhouse ${st}`);
      assert.equal(got.kind, base.kind);
      got.o.forEach((v, i) => assert.ok(Math.abs(v - base.o[i]) <= 1.5, `birdhouse ${st} axis ${i}: ${v} vs ${base.o[i]}`));
    }
  });
});

describe("stock switch on real-scale builds keeps form and exact size", () => {
  it("picnic table: every switch keeps 63x29x72; a board stock rebuilds, a stock it can't use is refused in words", () => {
    for (const id of ["lumber-2x4-8", "lumber-2x8-8", "plywood-3-4-4x8", "pvc-3-4-sch40"]) {
      const p = generateFromPrompt("picnic table", id);
      assert.equal(p.kind, generateFromPrompt("picnic table").kind, id);
      assert.deepEqual([p.overall.width, p.overall.height, p.overall.depth], [63, 29, 72], id);
      if (/^lumber-/.test(id)) assert.equal(p.primaryMaterialId, id);
      else assert.ok(p.notes.some((n) => /can't build this picnic table/.test(n)), id);
    }
  });
  it("plywood giraffe switched to 2x4 stays the cutout and says so", () => {
    const base = generateFromPrompt("plywood giraffe 36 inches tall");
    const got = generateFromPrompt("plywood giraffe 36 inches tall", "lumber-2x4-8");
    assert.ok(got.panels.length > 0);
    assert.deepEqual([got.overall.width, got.overall.height, got.overall.depth], [base.overall.width, base.overall.height, base.overall.depth]);
    assert.ok(got.notes.some((n) => /can't build this giraffe/.test(n)));
  });
  it("cardboard bookshelf: inside parts refit to the thin sides", () => {
    const p = generateFromPrompt("bookshelf 36 wide 72 tall", "cardboard-corrugated-sheet");
    const shelf = p.panels.find((x) => /^Shelf 1/.test(x.name))!;
    assert.ok(shelf.size.width > 35.5, `${shelf.size.width}`);
    assert.equal(p.overall.width, 36);
  });
});
