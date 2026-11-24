/**
 * A unitless "N by N" tied to a count noun is a grid count, not inches.
 * "3 by 3 cubbies" next to "12 inch cubes" is a 3×3 of 12" cells, not a 3" box.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generateFromPrompt } from "./promptMain.ts";
import { buildPlan } from "./report.ts";
import { headerTitle } from "./pdf.ts";
import { countGrid } from "./countGrid.ts";
import type { Panel } from "./types.ts";

const usd = (q: string) => {
  const p = generateFromPrompt(q);
  const pl = buildPlan(p);
  return { p, pl, price: p.refused ? 0 : Math.round(pl.totals.estCostUsd * 100) / 100 };
};

/** Clear gaps between vertical boards (sides and dividers), inches. */
function bayClears(panels: Panel[]): number[] {
  const verts = panels
    .filter((p) => p.type === "upright" || p.type === "divider")
    .map((p) => [p.position.x, p.position.x + p.size.width] as const)
    .sort((a, b) => a[0] - b[0]);
  const out: number[] = [];
  for (let i = 1; i < verts.length; i++) out.push(Math.round((verts[i][0] - verts[i - 1][1]) * 1000) / 1000);
  return out;
}

describe("a unitless N by N on a count noun is a grid, not inches", () => {
  it("cube storage cabinet 3 by 3 cubbies 12 inch cubes is a 3×3 of 12\" cells", () => {
    const { p, price } = usd("cube storage cabinet 3 by 3 cubbies 12 inch cubes");
    assert.equal(p.refused, undefined);
    assert.equal(p.overall.width, 39);
    assert.equal(p.overall.height, 39);
    assert.equal(p.overall.depth, 12.25);
    assert.match(p.notes?.[0] ?? "", /9 bays \(~12" wide\)/);
    assert.match(headerTitle(p), /9 cubbies/);
    assert.deepEqual(bayClears(p.panels), [12, 12, 12]);
    const shelves = p.panels.filter((x) => x.type === "shelf").map((s) => s.position.y);
    assert.deepEqual(shelves, [12.75, 25.5]);
    assert.equal(price, 142.73);
  });

  it("2 x 4 drawers is 2 columns of 4, at the drawer row size plus stock", () => {
    const { p } = usd("2 x 4 drawers");
    assert.equal(p.primaryMaterialId, "plywood-3-4-4x8");
    assert.equal(p.overall.width, 22.25);
    assert.equal(p.overall.height, 41.5);
    assert.equal(p.overall.depth, 16);
    const fronts = p.panels.filter((x) => /drawer front/i.test(x.name));
    assert.equal(fronts.length, 8);
    assert.equal(p.panels.filter((x) => /left drawer front/i.test(x.name)).length, 4);
    assert.equal(p.panels.filter((x) => /right drawer front/i.test(x.name)).length, 4);
  });

  it("4 by 2 cubes uses the cubby cell and builds 8 bays", () => {
    const { p } = usd("4 by 2 cubes");
    assert.equal(p.kind, "closet");
    assert.equal(p.overall.width, 51.75);
    assert.equal(p.overall.height, 26.25);
    assert.equal(p.overall.depth, 12.25);
    assert.match(p.notes?.[0] ?? "", /8 bays \(~12" wide\)/);
    assert.deepEqual(bayClears(p.panels), [12, 12, 12, 12]);
  });

  it("2 by 4 bench stays a size, and a unit on a shelf stays a size", () => {
    assert.equal(countGrid("2 by 4 bench"), null);
    assert.equal(countGrid("24 by 36 inch shelf"), null);
    assert.equal(countGrid("24 by 36\" shelf"), null);
    assert.equal(countGrid("1x4 shelf"), null);
    const bench = usd("2 by 4 bench");
    assert.equal(bench.p.name, 'Bench 2" × 4" × 4"');
    assert.deepEqual([bench.p.overall.width, bench.p.overall.height, bench.p.overall.depth], [2, 4, 4]);
    assert.equal(bench.price, 67.38);
    assert.equal(bench.pl.totals.pieces, 11);
    const shelf = usd("24 by 36 inch shelf");
    assert.deepEqual([shelf.p.overall.width, shelf.p.overall.height, shelf.p.overall.depth], [24, 36, 12]);
    assert.equal(shelf.price, 93.33);
    assert.equal(shelf.pl.totals.pieces, 8);
    const marked = usd('24 by 36" shelf');
    assert.deepEqual([marked.p.overall.width, marked.p.overall.height, marked.p.overall.depth], [24, 36, 12]);
    assert.equal(marked.price, 93.33);
  });

  it("linen cabinet 31.5x78x16 stays the canary", () => {
    const { p, price, pl } = usd("linen cabinet 31.5x78x16");
    assert.equal(p.overall.width, 31.5);
    assert.equal(p.overall.height, 78);
    assert.equal(p.overall.depth, 16);
    assert.equal(price, 193.68);
    assert.equal(pl.totals.pieces, 11);
  });
});
