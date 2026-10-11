import assert from "node:assert/strict";
import { it } from "node:test";
import { generateFromPrompt } from "./promptMain.ts";
import { buildPlan } from "./report.ts";

const bom = (q: string) => buildPlan(generateFromPrompt(q)).bom;
it("sandbox cover: whole 1×6 boards, two 48-inch boards per 8-ft board, outdoor package, hardware priced", () => {
  const b = bom("sandbox cover 4 by 4");
  const boards = b.find((x) => /1×6/.test(x.name))!;
  assert.equal(boards.quantity, 4);
  assert.ok(!/edge-glued/.test(boards.notes ?? ""));
  assert.ok(b.some((x) => /exterior/i.test(x.name)));
  // Hardware is priced; a board the seed library does not sell stays unpriced rather than guessed.
  assert.ok(b.filter((x) => !/1×6/.test(x.name)).every((x) => x.estimatedCost != null), b.filter((x) => x.estimatedCost == null).map((x) => x.name).join());
});
it("one Buy line per stock", () => {
  const names = bom("2x4 workbench 60 inches long").map((x) => x.name);
  assert.equal(names.length, new Set(names).size, names.join());
});
