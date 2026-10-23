/**
 * See inside, item 1 (PLAN §2): the staged explode layout, renderer-free. The pixel checks (every piece really
 * visible) live in scripts/e2e/see-inside-every-piece.py; this pins the 3D rules the eye can't easily check:
 * the layout never touches the engine's parts, every part gets a role and a unit, hollow drawers move as one,
 * and drawers form an aligned staircase that starts clear of the case front.
 *
 *   npx tsx --test scripts/see-inside-layout.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";
import { generateFromPrompt } from "../src/lib/yard/promptMain.ts";
import { classify, layoutFor, boxOf } from "../src/components/workspace/explode-layout.ts";

const BUILDS: Record<string, string> = {
  dresser: "3 drawer dresser",
  dresser6: "6 drawer dresser",
  nightstand: "nightstand with 2 drawers",
  desk: '60" desk with drawers',
  filing: "filing cabinet 2 drawers",
  "pocket-vanity": "pocket vanity",
  linen: "linen closet 31.5 wide 78 tall 16 deep",
  pantry: "pantry cabinet 30 wide 84 tall 18 deep",
  jewelry: "jewelry box with drawers",
};

for (const [build, prompt] of Object.entries(BUILDS)) {
  test(`${build}: the layout reads the engine and never changes it; every part has a role, a unit and one mover at most`, () => {
    const proj = generateFromPrompt(prompt);
    const before = JSON.stringify(proj.panels);
    const L = layoutFor(proj.panels);
    assert.equal(JSON.stringify(proj.panels), before);
    assert.equal(L.parts.length, proj.panels.length);
    for (const p of L.parts) {
      assert.ok(p.role && p.unit && p.group, p.name);
      // Hardware rides its host (no mover of its own); every other part belongs to exactly one mover.
      if (p.role === "hardware") assert.equal(L.owner.has(p.id), false, p.name);
      else assert.equal([...L.movers.values()].filter((m) => m.parts.includes(p)).length, 1, p.name);
    }
  });

  test(`${build}: drawers form an aligned staircase that starts clear of the case front`, () => {
    const L = layoutFor(generateFromPrompt(prompt).panels);
    const A = boxOf(L.parts);
    const drawers = [...L.movers.values()].filter((m) => m.key.startsWith("D:"));
    for (const m of drawers) {
      const b = boxOf(m.parts.filter((q) => q.role !== "drawerFront"));
      assert.deepEqual(m.axis, [0, 0, 1], m.key);
      assert.ok(b.minZ + m.dist >= A.maxZ, `${m.key}: the sideways step starts outside the carcase`);
    }
    // In a column (same lat/dir), a lower drawer (larger k) never sits nearer than the one above it.
    const cols = new Map<string, typeof drawers>();
    for (const m of drawers) cols.set(`${m.dir}|${m.n}`, [...(cols.get(`${m.dir}|${m.n}`) ?? []), m]);
    for (const col of cols.values()) {
      col.sort((a, b) => a.k! - b.k!);
      for (let i = 1; i < col.length; i++) assert.ok(col[i].dist >= col[i - 1].dist - 1e-9, `${build}: ${col[i].key}`);
    }
  });
}

test("hollow drawers (#94 drawerId/drawerPart): one drawer id groups front, sides, back and bottom; its bottom is never the case bottom", () => {
  // The engine ships hollow 5-part drawers (front, 2 sides, back, 1/4" ply bottom) tagged drawerId + drawerPart.
  const panels = generateFromPrompt("nightstand with 2 drawers").panels;
  assert.ok(panels.some((p) => p.drawerId), "engine drawers are tagged");
  const parts = classify(panels);
  const caseBottom = parts.filter((p) => p.role === "bottom");
  assert.equal(caseBottom.length, 1, caseBottom.map((p) => p.name).join(", "));
  const units = new Map<string, string[]>();
  for (const p of parts.filter((q) => q.unit.startsWith("D:") && q.role !== "hardware")) units.set(p.unit, [...(units.get(p.unit) ?? []), p.drawerPart ?? p.role]);
  assert.equal(units.size, 2);
  for (const list of units.values()) assert.deepEqual(list.sort(), ["back", "bottom", "front", "side", "side"]);
  // Hollow drawers get a front stand-off (one value for every drawer) so the box's inside can show.
  const L = layoutFor(panels);
  const outs = new Set([...L.movers.values()].filter((m) => m.key.startsWith("D:")).map((m) => m.front?.out));
  assert.equal(outs.size, 1);
  assert.ok([...outs][0]! > 0);
});
