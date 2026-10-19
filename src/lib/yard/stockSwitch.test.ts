import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildPlan } from "./report.ts";
import { i33, i39 } from "./invariants.ts";
import { honestNestSheetStockName } from "./report.ts";
import { generateFromPrompt } from "./promptMain.ts";
import { interiorSheet } from "./materialForUse.ts";
import { isOutdoorPrompt } from "./outdoor.ts";
import { keptLongNote } from "./sheetThickness.ts";
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
  // Parts over 96": no 1/2" sheet is sold that long, so the switch is refused and said (row 93).
  "bookshelf 30 wide 100 tall 12 deep",
  "wardrobe 36 wide 98 tall 24 deep",
];

/** Frame and safety parts over a switch (I39, row 94): bed guards, ladders, load rails, aprons. */
const STRUCTURAL_CORPUS = ["twin bunk bed", "loft bed", "bunk bed with stairs", "workbench", "twin bunk bed from 1/2 plywood"];

/** Builds with no switch whose parts were drawn at another thickness than their sheet (row 92). */
const NO_SWITCH_CORPUS = [
  "barn birdhouse",
  "birdhouse shaped like church",
  "mudroom locker",
  "locker 15 wide 60 tall 15 deep with 1 door and 2 shelves",
  "lemonade stand",
  "lemonade stand 60 wide 36 deep",
  "knife block maple",
  "record crate",
  "laptop stand",
  "toy train track riser",
  "wall mounted mail organizer",
  "planter box 2 by 4 feet",
  "glider",
  "rolling miter saw stand",
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

  it("no switch: every cut row is its sheet's thickness, and that sheet (exterior outdoors) is bought", () => {
    const bad: string[] = [];
    for (const q of NO_SWITCH_CORPUS) {
      const p = generateFromPrompt(q);
      const plan = buildPlan(p);
      for (const x of i39(p, p, plan)) bad.push(`${q}: ${x.msg}`);
      if (isOutdoorPrompt(q.toLowerCase())) for (const b of plan.bom.filter((b) => /^sheets?$/.test(b.unit) && interiorSheet(b))) bad.push(`${q}: outdoors buys interior ${b.name}`);
    }
    assert.deepEqual(bad, []);
  });

  it("cost canaries: the barn birdhouse and the mudroom locker cost what they did before #99", () => {
    // Main 49aa20f (live yard.wiki) prices, read off the live build: the fix moves no sheet.
    assert.equal(buildPlan(generateFromPrompt("barn birdhouse")).totals.estCostUsd, 132.77);
    assert.equal(buildPlan(generateFromPrompt("mudroom locker")).totals.estCostUsd, 239.15);
  });

  for (const via of ["measure", "stock panel"] as Via[]) {
    it(`${via}: a part over 96" on 1/2" is refused and said, never cut 1/2" from a 3/4" 4×10`, async () => {
      const { after } = await switchStock("bookshelf 30 wide 100 tall 12 deep", "plywood-1-2-4x8", via);
      const plan = buildPlan(after);
      const upright = plan.cutList.find((c) => c.name === "Upright")!;
      // Hand-worked: 1/2" plywood is sold 4×8 at most, so a 100" upright stays 3/4" on a 4×10.
      assert.deepEqual([upright.lengthIn, upright.thicknessIn, upright.material], [100, 0.75, '3/4" Plywood 4×10']);
      assert.ok(!plan.cutList.some((c) => c.thicknessIn === 0.5), "no 1/2\" part");
      assert.ok(!plan.bom.some((b) => b.catalogId === "plywood-1-2-4x8"), plan.bom.map((b) => b.name).join(", "));
      const note = (after.notes ?? []).find((n) => n.startsWith(keptLongNote('1/2" Plywood 4×8')));
      assert.ok(note, (after.notes ?? []).join(" | "));
      assert.match(note!, /the 2 uprights are 100" long/);
      // The pill and the note name the same stock.
      const pill = honestNestSheetStockName(after, plan) ?? getCatalogItem(after.primaryMaterialId)!.name;
      assert.equal(pill, '3/4" Plywood 4×10');
      assert.ok(note!.includes(pill));
    });
  }

  for (const stockId of ["plywood-1-2-4x8", "plywood-1-4-4x8"]) {
    it(`I39 → ${stockId}: guards, ladders and load rails are never thinned, and labels name the real stock`, async () => {
      const bad: string[] = [];
      for (const q of STRUCTURAL_CORPUS) {
        const { before, after } = await switchStock(q, stockId, "stock panel");
        for (const x of i39(before, after)) bad.push(`${q}: ${x.msg}`);
      }
      assert.deepEqual(bad, []);
    });
  }

  it("bunk bed → 1/2\": the 1×8 guards stay 3/4\" 1×8 boards", async () => {
    const { after } = await switchStock("twin bunk bed", "plywood-1-2-4x8", "stock panel");
    const guards = buildPlan(after).cutList.filter((c) => /guard/i.test(c.name));
    assert.ok(guards.length >= 4);
    for (const g of guards) assert.deepEqual([g.thicknessIn, g.material], [0.75, "1×8 Board (8 ft)"], g.name);
  });
});
