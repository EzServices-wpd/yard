import assert from "node:assert/strict";
import test from "node:test";
import { getCatalogItem } from "./catalog.ts";
import { UNIT_SIZES, isPackagingDims, isPackagingText, unitSizeFor } from "./unitSizes.ts";
import { withStoreHit } from "./stockQuery.ts";
import { generateFromPrompt } from "./promptMain.ts";
import { buildPlan } from "./report.ts";
import { checkBuild } from "./invariants.ts";
import { offline } from "../../../scripts/eval-lib.ts";

test("every curated row cites a source and is never a UPC or listing record", () => {
  for (const u of UNIT_SIZES) {
    assert.ok(u.source.length > 10, u.key);
    assert.doesNotMatch(u.source, /\bUPC\b|upcitemdb|amazon\.com|\bASIN\b/i, u.key);
    assert.deepEqual(getCatalogItem(u.catalogId)?.dims, u.dims, `${u.key}: catalog row carries the curated piece size`);
  }
});

test("dowels resolve by diameter, paper clips are paper clips", () => {
  assert.equal(unitSizeFor("bridge from 3/8 inch dowels")?.dims.diameter, 0.375);
  assert.equal(unitSizeFor("5/16\" dowel")?.dims.diameter, 0.3125);
  assert.equal(unitSizeFor("paper clip chain")?.dims.length, 1.375);
  assert.equal(unitSizeFor("bead board wainscot"), null);
});

test("a listing's box size never sizes one paper clip", () => {
  const clip = getCatalogItem("paper-clip-no1")!;
  const hit = { title: "Paper Clips, 100 count box, 4 inch long 3 inch wide", merchant: "Store", priceUsd: 2.49 };
  assert.ok(isPackagingText(hit.title));
  const after = withStoreHit(clip, hit);
  assert.equal(after.dims.length, 1.375);
  assert.ok(isPackagingDims(UNIT_SIZES[0], { length: 4, width: 3 }));
});

test("paper-clip, craft-stick and dowel builds use one item's size; Buy sells packs", () => {
  offline(() => {
    for (const [q, id] of [["paper clip chain 12 inches long", "paper-clip-no1"], ["popsicle stick bridge", "popsicle-standard"], ["bridge from 3/8 inch dowels", "dowel-3-8-36"]] as const) {
      const p = generateFromPrompt(q);
      assert.equal(p.primaryMaterialId, id, q);
      const plan = buildPlan(p);
      assert.ok(!checkBuild(p, q, plan).some((v) => v.id === "I17"), `${q}: I17`);
      const line = plan.bom.find((b) => b.catalogId === id || new RegExp(getCatalogItem(id)!.name.split(" ")[0], "i").test(b.name));
      assert.ok(line, `${q}: Buy line`);
    }
  });
});
