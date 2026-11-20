/**
 * Every board the picker can put on Buy is a priced catalog id, or a section that has
 * no priced length and no checked listing anywhere in the repo.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FORGE_CATALOG } from "./catalog";
import { generateFromPrompt } from "./promptMain";
import { weekendSizedStockPhrases } from "./promptHelpers";
import { carryBoard } from "./realObjects";
import { buildPlan, longerLumber } from "./report";
import { getCatalogItem } from "./catalog";
import { boardNominal, boardPickOf, boardPriceUsd, checkedSpeciesBoardUsd, pickNearestPricedLength, pricedBoardId, type BoardPick } from "./pricedStock";

/** Sections with no priced length and no checked listing. 1×6, 1×8, 1×10 and 1×12 have listings, so this set is empty. */
export const UNPRICED_BOARD_IDS: readonly string[] = [];

/** Cheapest checked listing for the boards that had no catalog price. Home Depot when both stores list one. */
const LISTED_BOARD_USD: Record<string, number> = {
  "lumber-1x6-8": 14.68,
  "lumber-1x8-8": 20.48,
  "lumber-1x10-8": 24.23,
  "lumber-1x12-8": 30.73,
};

const lumberIds = () =>
  FORGE_CATALOG.filter((c) => c.category === "lumber" && c.formFactor === "board").map((c) => c.id);

describe("the board picker only chooses a priced length of the same section", () => {
  it("picks the nearest priced length and ignores a different thickness", () => {
    const want: BoardPick = { id: "lumber-1x6-8", length: 96, width: 5.5, thick: 0.75, price: null };
    const boards: BoardPick[] = [
      want,
      { id: "lumber-1x6-6", length: 72, width: 5.5, thick: 0.75, price: 8 },
      { id: "lumber-1x6-12", length: 144, width: 5.5, thick: 0.75, price: 16 },
      { id: "lumber-2x6-8", length: 96, width: 5.5, thick: 1.5, price: 8.75 },
    ];
    assert.equal(pickNearestPricedLength(want, boards)?.id, "lumber-1x6-6");
    assert.equal(pickNearestPricedLength({ ...want, price: 7 }, boards), null);
    assert.equal(pickNearestPricedLength(want, boards.filter((b) => b.thick !== 0.75 || b.id === want.id)), null);
  });

  it("a tie of length takes the shorter priced board", () => {
    const want: BoardPick = { id: "lumber-1x8-8", length: 96, width: 7.25, thick: 0.75, price: null };
    const boards: BoardPick[] = [
      want,
      { id: "lumber-1x8-10", length: 120, width: 7.25, thick: 0.75, price: 12 },
      { id: "lumber-1x8-6", length: 72, width: 7.25, thick: 0.75, price: 9 },
    ];
    assert.equal(pickNearestPricedLength(want, boards)?.id, "lumber-1x8-6");
  });

  it("a free pallet stays a pallet, not the priced 1×4 of the same inches", () => {
    assert.equal(pricedBoardId("pallet-board"), "pallet-board");
    assert.equal(boardNominal("pallet-board"), null);
    assert.equal(boardNominal("lumber-2x10-10"), "2x10");
  });

  it("pallet builds keep their stock: the pallet is bought as a pallet, and a part past 4 ft still takes the longer board of its section", () => {
    const dog = buildPlan(generateFromPrompt("dog bed from a pallet")).bom;
    assert.ok(dog.some((b) => b.catalogId === "pallet-board"));
    assert.equal(dog.some((b) => b.catalogId === "lumber-1x4-8"), false);
    assert.equal(longerLumber(getCatalogItem("pallet-board")!, 72)?.id, "lumber-1x4-8");
    const table = buildPlan(generateFromPrompt("pallet dining table 72 long"));
    assert.equal(table.instructions.some((s) => /half-lap splice/.test(s.description ?? "")), false);
  });

  it("every catalog board the picker can emit is priced, or is a section with no priced length", () => {
    const fromPhrases = weekendSizedStockPhrases().map(([, id]) => id).filter((id) => id.startsWith("lumber-"));
    const fromCarry = ["1x4 toolbox", "1x6 toolbox", "1x8 toolbox", "1x10 caddy", "1x12 crate"].map((q) => carryBoard(q).id);
    const ids = [...new Set([...lumberIds(), ...fromPhrases, ...fromCarry])];
    const unpriced: string[] = [];
    for (const id of ids) {
      const chosen = pricedBoardId(id);
      const item = FORGE_CATALOG.find((c) => c.id === chosen);
      // A catalog $0 is a real free price (a pallet), not a missing one.
      if (item?.unitCostUsd === 0) continue;
      const price = boardPriceUsd(item);
      if (price != null && price > 0) continue;
      unpriced.push(chosen);
      const want = boardPickOf(FORGE_CATALOG.find((c) => c.id === chosen));
      assert.ok(want, chosen);
      assert.equal(pickNearestPricedLength(want!, FORGE_CATALOG.map(boardPickOf).filter((b): b is BoardPick => !!b)), null, chosen);
    }
    assert.deepEqual([...new Set(unpriced)].sort(), [...UNPRICED_BOARD_IDS].sort());
  });
});

function lumberRows(prompt: string) {
  const plan = buildPlan(generateFromPrompt(prompt));
  return {
    plan,
    rows: plan.bom.filter((b) => (b.catalogId ?? "").startsWith("lumber-")),
  };
}

function assertPricedBoard(prompt: string, id: string) {
  const { plan, rows } = lumberRows(prompt);
  const row = rows.find((b) => b.catalogId === id);
  assert.ok(row, `${prompt} missing ${id}`);
  assert.ok((row!.estimatedCost ?? 0) > 0, `${prompt} ${id} cost ${row!.estimatedCost}`);
  assert.ok((row!.offers ?? []).some((o) => o.unitPrice > 0), `${prompt} offer`);
  assert.doesNotMatch(row!.notes ?? "", /No price/);
  const priced = plan.bom.filter((b) => (b.estimatedCost ?? 0) > 0).reduce((s, b) => s + (b.estimatedCost ?? 0), 0);
  assert.ok(Math.abs(plan.totals.estCostUsd - priced) < 0.05, `${prompt} total ${plan.totals.estCostUsd} vs ${priced}`);
  assert.equal(plan.bom.some((b) => b.estimatedCost == null || b.estimatedCost === 0), false, `${prompt} still has an unpriced Buy row`);
}

describe("reported board prompts and other widths", () => {
  it("cedar 1x6 planter buys the checked cedar board, and the total includes it", () => {
    const { plan, rows } = lumberRows("cedar 1x6 planter");
    const row = rows.find((b) => b.catalogId === "lumber-1x6-8");
    assert.ok(row);
    assert.equal(checkedSpeciesBoardUsd("lumber-1x6-8", "cedar"), 19.98);
    assert.equal(row!.estimatedCost, Math.round(19.98 * row!.quantity * 100) / 100);
    assert.ok((row!.offers ?? []).some((o) => o.unitPrice === 19.98));
    const priced = plan.bom.reduce((s, b) => s + (b.estimatedCost ?? 0), 0);
    assert.ok(Math.abs(plan.totals.estCostUsd - priced) < 0.05);
    assert.ok((row!.estimatedCost ?? 0) > 0 && plan.totals.estCostUsd > row!.estimatedCost!);
  });

  it("a checked cedar 1x6 price is the listing, and pine 1x6, 1x8, 1x10 and 1x12 use their checked listings", () => {
    const sandbox = buildPlan(generateFromPrompt("sandbox cover 4 by 4")).bom.find((b) => b.catalogId === "lumber-1x6-8");
    assert.equal(sandbox?.estimatedCost, 79.92);
    for (const q of ["carry crate 1x6", "1x6 planter", "tote", "caddy", "bookshelf 36x12x72 pine 1x10", "bookcase from 1x12"]) {
      const row = lumberRows(q).rows.find((b) => b.catalogId != null && LISTED_BOARD_USD[b.catalogId] != null);
      assert.ok(row?.catalogId, q);
      const want = Math.round(LISTED_BOARD_USD[row!.catalogId!] * row!.quantity * 100) / 100;
      assert.equal(Math.round((row!.estimatedCost ?? 0) * 100) / 100, want, `${q} ${row!.estimatedCost}`);
    }
  });

  it("other widths and species that have a real price are priced", () => {
    // Not the reported list: each uses a different width or species the seed library actually prices.
    assertPricedBoard("oak 1x4 shelf 24 long", "lumber-1x4-8");
    assertPricedBoard("maple 1x3 shelf 30 long", "lumber-1x3-8");
    assertPricedBoard("poplar 1x2 shelf 18 long", "lumber-1x2-8");
    assertPricedBoard("cedar 2x6 bench 48 wide", "lumber-2x6-8");
    assertPricedBoard("walnut 2x8 bench 60 wide", "lumber-2x8-8");
    assertPricedBoard("cherry 4x4 mailbox post", "lumber-4x4-8");
  });
});
