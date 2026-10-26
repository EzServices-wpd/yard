// PR 16 Shop light: lights and materials only. These guard that it never reaches geometry, sizes or the frame budget.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { SHOP_LIGHT, plyCount, shopLook } from "../src/components/workspace/shop-light";
import { getCatalogItem } from "../src/lib/yard/catalog";

const read = (p: string) => fs.readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const item = (id: string) => {
  const it = getCatalogItem(id);
  assert.ok(it, `catalog item ${id}`);
  return it;
};

test("a plywood cut edge shows its real plies; lumber, card and PVC show none", () => {
  assert.equal(plyCount(item("plywood-3-4-4x8"), 0.75), 7);
  assert.equal(plyCount(item("plywood-1-2-4x8"), 0.5), 5);
  assert.equal(plyCount(item("plywood-1-4-4x8"), 0.25), 3);
  for (const id of ["lumber-1x4-8", "popsicle-standard", "pvc-3-4-sch40", "chipboard-sheet"]) assert.equal(plyCount(item(id), 0.75), 0, id);
  assert.equal(plyCount(null, 0.75), 0);
});

test("only wood and ply looks are retuned; kraft, PVC and metal keep their own colour response", () => {
  const map = {} as never;
  const wood = shopLook({ map, roughness: 0.62, metalness: 0.03, env: 0.72 }, item("plywood-3-4-4x8"));
  assert.ok(wood.env < 0.72 && wood.env > 0.5, "less grey HDR wash on wood");
  assert.ok(wood.roughness >= 0.5 && wood.roughness < 0.62);
  assert.equal(wood.metalness, 0.03);
  const pvc = { map: null, roughness: 0.22, metalness: 0.08, env: 1.25 };
  assert.deepEqual(shopLook(pvc, item("pvc-3-4-sch40")), pvc);
  const card = { map, roughness: 0.9, metalness: 0, env: 0.35 };
  assert.deepEqual(shopLook(card, { ...item("plywood-3-4-4x8"), category: "cardboard" }), card);
});

test("the light rig never uses the chalk-blue mark colour (Night shop B: marks only)", () => {
  assert.doesNotMatch(JSON.stringify(SHOP_LIGHT), /#7cb2ff|#2a62c4/i);
});

test("materials only: shop-light builds no geometry, and the bench keeps demand frames and its DPR cap", () => {
  const shop = read("src/components/workspace/shop-light.ts");
  assert.doesNotMatch(shop, /Geometry|position\s*=|\.scale|args=\{\[/);
  const canvas = read("src/components/workspace/canvas.tsx");
  assert.match(canvas, /frameloop=\{workMode === "walk" \? "always" : "demand"\}/);
  assert.match(canvas, /innerWidth < 820 \? \[1, 1\.5\] : \[1, 1\.75\]/);
  // Edge strips keep their exact boxes; only the material per strip changed.
  const hw = read("src/components/workspace/panelHardware.tsx");
  assert.equal((hw.match(/<boxGeometry args=\{\[(w \+ 0\.01|t), /g) ?? []).length, 12);
});
