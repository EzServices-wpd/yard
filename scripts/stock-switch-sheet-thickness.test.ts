/**
 * Rule: the cut list's size stamp changes a sheet's size, never its thickness. A row cut from the picked sheet keeps
 * that sheet when it fits, else the smallest sold sheet of the same thickness — never 1/2" relabelled as 3/4" plywood.
 *
 * Picking 4×10 keeps 4×10 on rows that also fit 4×8, because Buy sells the 4×10 (not a 4×8 it never lists).
 *
 * Seam: the stock picker (store.generate with restock, as catalog-panel and Measure call it) → buildPlan cut list
 * and Buy list. Expected thickness comes from the catalog row the user picked, never from the cut code.
 */
import assert from "node:assert/strict";
import test from "node:test";

const mem = new Map<string, string>();
(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => void mem.set(k, v),
  removeItem: (k: string) => void mem.delete(k),
  clear: () => mem.clear(),
  key: () => null,
  length: 0,
};

const PROMPTS = [
  "utility cabinet 28 wide 72 tall 16 deep with 4 shelves from 3/4 plywood",
  "bookcase 36 wide 72 tall 12 deep",
  "linen closet 31.5 wide 78 tall 16 deep",
  "dresser 48 wide 34 tall 18 deep with 6 drawers",
  "nightstand 20 wide 24 tall 16 deep with 1 drawer",
  "pantry cabinet 30 wide 84 tall 16 deep",
  "wardrobe 40 wide 72 tall 22 deep",
];

test("switching to any sheet stock: every row cut from that sheet names a sheet of its thickness that Buy lists", async () => {
  const { useYard } = await import("../src/lib/yard/store.ts");
  const { FORGE_CATALOG } = await import("../src/lib/yard/catalog.ts");
  const { promptNamingStock, speakCatalogStock } = await import("../src/lib/yard/promptHelpers.ts");
  const { buildPlan } = await import("../src/lib/yard/report.ts");
  const sheets = FORGE_CATALOG.filter((i) => i.category === "sheet_goods" && i.dims.thickness);
  const byName = new Map(sheets.map((i) => [i.name, i]));
  assert.ok(sheets.some((s) => s.dims.thickness !== 0.75 && s.dims.thickness !== 0.25), "catalog sells a sheet that is neither 3/4 nor 1/4");
  const bad: string[] = [];
  for (const prompt of PROMPTS) {
    for (const sheet of sheets) {
      mem.clear();
      useYard.getState().generate(prompt, undefined, undefined, { fresh: true });
      const base = useYard.getState().project;
      useYard.getState().generate(promptNamingStock(base.prompt, speakCatalogStock(sheet)), sheet.id, undefined, { fresh: true, keepView: true, restock: true });
      const plan = buildPlan(useYard.getState().project);
      const bought = new Set(plan.bom.map((b) => b.name));
      // A face that fits the picked sheet is bought as that sheet (parts too big for it are Buy's own class).
      const fitsPicked = (c: { lengthIn: number; widthIn: number }) =>
        Math.max(c.lengthIn, c.widthIn) <= Math.max(sheet.dims.length!, sheet.dims.width!) && Math.min(c.lengthIn, c.widthIn) <= Math.min(sheet.dims.length!, sheet.dims.width!);
      for (const c of plan.cutList) {
        // Rows cut from the picked sheet (the id names the stock the part is drawn from).
        if (c.id.split("|")[0] !== sheet.id) continue;
        const named = byName.get(c.material ?? "");
        if (named && named.dims.thickness !== sheet.dims.thickness) {
          bad.push(`${prompt} → ${sheet.name}: ${c.label ?? ""} ${c.name} is cut from it but the cut list says ${c.material}`);
        } else if (named && fitsPicked(c) && !bought.has(named.name)) {
          bad.push(`${prompt} → ${sheet.name}: ${c.label ?? ""} ${c.name} says ${c.material}, which Buy does not list`);
        }
      }
    }
  }
  assert.deepEqual(bad.slice(0, 20), [], `${bad.length} cut rows name the wrong sheet`);
});
