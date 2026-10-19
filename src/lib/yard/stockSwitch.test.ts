import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildPlan } from "./report.ts";
import { i33 } from "./invariants.ts";
import { getCatalogItem } from "./catalog.ts";
import { promptNamingStock, speakCatalogStock } from "./promptHelpers.ts";
import type { YardProject } from "./types.ts";

/**
 * I33 (F32, live walk 10-21 row 77): a stock switch rebuilds the build from the picked sheet. Seam: the store's
 * generate, called the way Measure's stock and thickness chips call it (same prompt, picked id, restock) and the way
 * the Stock panel calls it (prompt rewritten to name the stock, fresh + restock). Expected values are hand-worked
 * from the typed size and the sheet thickness, never read back from the builder.
 */
async function bench() {
  const mem = new Map<string, string>();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => void mem.set(k, v),
    removeItem: (k: string) => void mem.delete(k),
    clear: () => mem.clear(),
    key: () => null,
    length: 0,
  };
  return (await import("./store.ts")).useYard;
}

type Via = "measure" | "stock panel";
async function switchStock(prompt: string, stockId: string, via: Via): Promise<{ before: YardProject; after: YardProject }> {
  const useYard = await bench();
  useYard.getState().generate(prompt, undefined, undefined, { fresh: true });
  const before = useYard.getState().project;
  if (via === "measure") useYard.getState().generate(before.prompt || before.name, stockId, undefined, { restock: true, keepView: true });
  else useYard.getState().generate(promptNamingStock(before.prompt, speakCatalogStock(getCatalogItem(stockId)!)), stockId, undefined, { fresh: true, keepView: true, restock: true });
  return { before, after: useYard.getState().project };
}

const SWITCH_CORPUS = [
  "3 drawer dresser",
  "nightstand with 2 drawers",
  "bookshelf 30 wide 72 tall 12 deep",
  "utility cabinet 30 wide 72 tall 16 deep with 4 shelves and 2 doors",
  "wardrobe",
  "filing cabinet 30x30x24 2 doors 2 drawers",
  "kitchen island",
  "wine cabinet",
  "linen closet 31.5 wide 78 tall 16 deep",
  "broom closet cabinet to fit a 22 inch gap 80 tall 14 deep",
  "vanity with drawers",
  "tv stand",
  "bathroom medicine cabinet 16 wide 24 high 4 deep",
  "shoe rack",
  "desk 60 wide 30 deep 29 tall with a 24 inch knee",
  "corner bookshelf 60 wide 84 tall",
  "coffee table 48 wide 18 tall 24 deep",
  "record shelf",
];

describe("I33 stock switch rebuilds every cut from the picked stock", () => {
  it("dresser → 1/2\" ply: every cut is 1/2\", the top spans upright to upright, the stock column says 1/2\"", async () => {
    const { after } = await switchStock("3 drawer dresser", "plywood-1-2-4x8", "measure");
    const plan = buildPlan(after);
    const row = (name: string) => plan.cutList.find((c) => c.name === name)!;
    // Hand-worked: a 36" body on 1/2" uprights has 35" between them.
    assert.equal(row("Top").lengthIn, 35);
    assert.equal(row("Bottom").lengthIn, 35);
    assert.equal(row("Top").lengthIn + 2 * row("Upright").thicknessIn, 36);
    for (const name of ["Upright", "Top", "Bottom", "Drawer front", "Drawer side", "Drawer back"]) {
      assert.equal(row(name).thicknessIn, 0.5, `${name} is ${row(name).thicknessIn}"`);
      assert.equal(row(name).material, '1/2" Plywood 4×8', `${name} is labelled ${row(name).material}`);
    }
    assert.equal(row("Drawer bottom").thicknessIn, 0.25);
    assert.deepEqual([after.overall.width, after.overall.height], [36, 36]);
    assert.ok(plan.bom.some((b) => b.name === '1/2" Plywood 4×8'));
    assert.ok(!plan.bom.some((b) => /3\/4" Plywood/.test(b.name)), plan.bom.map((b) => b.name).join(", "));
    const steps = plan.instructions.map((s) => `${s.title} ${s.description ?? ""}`).join("\n");
    assert.match(steps, /1\/2" Plywood 4×8/);
    assert.doesNotMatch(steps, /3\/4" Plywood/);
  });

  it("a typed size stays the typed size exactly after the switch", async () => {
    const { after } = await switchStock("bookshelf 30 wide 72 tall 12 deep", "plywood-1-2-4x8", "measure");
    assert.deepEqual([after.overall.width, after.overall.height, after.overall.depth], [30, 72, 12]);
    const xs = after.panels.map((p) => [p.position.x, p.position.x + p.size.width]).flat();
    assert.equal(Math.max(...xs) - Math.min(...xs), 30);
  });

  for (const stockId of ["plywood-1-2-4x8", "plywood-1-4-4x8"]) {
    for (const via of ["measure", "stock panel"] as Via[]) {
      it(`${via} → ${stockId}: I33 holds over the switch corpus`, async () => {
        const bad: string[] = [];
        for (const q of SWITCH_CORPUS) {
          const { before, after } = await switchStock(q, stockId, via);
          for (const x of i33(before, after, stockId)) bad.push(`${q}: ${x.msg}`);
        }
        assert.deepEqual(bad, []);
      });
    }
  }
});
