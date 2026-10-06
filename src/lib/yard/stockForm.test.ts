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
/** Board and sheet birdhouses share one cavity; the outside grows by the wall thickness. */
const BOARD_STOCKS = ["from 1x4 boards", "from 2x4", "from plywood", "from cardboard"];

const env = (pr: string) => {
  const p = generateFromPrompt(pr);
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
    it(`${item}: same kind, envelope within member size, from every stock`, () => {
      const base = env(`${item} from popsicle sticks`);
      for (const st of STOCKS) {
        const got = env(`${item} ${st}`);
        assert.equal(got.kind, base.kind, `${item} ${st} kind ${got.kind} vs ${base.kind}`);
        got.o.forEach((v, i) => {
          const tol = Math.max(4, base.o[i] * 0.06);
          assert.ok(Math.abs(v - base.o[i]) <= tol, `${item} ${st} axis ${i}: ${v} vs ${base.o[i]}`);
        });
      }
    });
  }
  it("birdhouse: board and sheet stocks share the cavity", () => {
    const base = env(`birdhouse ${BOARD_STOCKS[0]}`);
    for (const st of BOARD_STOCKS) {
      const got = env(`birdhouse ${st}`);
      assert.equal(got.kind, base.kind);
      got.o.forEach((v, i) => assert.ok(Math.abs(v - base.o[i]) <= 1.5, `birdhouse ${st} axis ${i}: ${v} vs ${base.o[i]}`));
    }
  });
});
