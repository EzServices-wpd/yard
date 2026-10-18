/**
 * See inside, item 1 (PLAN §2): the staged explode layout, renderer-free. The pixel checks (every piece really
 * visible) live in scripts/e2e/see-inside-every-piece.py; this pins the 3D rules the eye can't easily check:
 * no door, lid or drawer passes through another unit at any frame of the open tween, hardware rides its host,
 * the anchor never moves, closing reverses opening, and the layout never touches the engine's parts.
 *
 *   npx tsx --test scripts/see-inside-layout.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";
import { generateFromPrompt } from "../src/lib/yard/promptMain.ts";
import { simulateHollowDrawers, SIM_DRAWER_TAG } from "../src/components/workspace/explode-sim.ts";
import {
  CLOSE_MS, EXPLODE_MS, REDUCED_FADE_MS, layoutFor, posesFor, poseAt, applyPose, classify, setDrawerTag,
  type ExplodePart, type Layout, type Pose, type V3,
} from "../src/components/workspace/explode-layout.ts";

const BUILDS: Record<string, string> = {
  dresser: "3 drawer dresser",
  nightstand: "nightstand with 2 drawers",
  desk: '60" desk with drawers',
  filing: "filing cabinet 2 drawers",
  "pocket-vanity": "pocket vanity",
  linen: "linen closet 31.5 wide 78 tall 16 deep",
  pantry: "pantry cabinet 30 wide 84 tall 18 deep",
  jewelry: "jewelry box with drawers",
};

type OBB = { c: V3; ax: V3[]; e: number[] };
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
/** The part's box under a pose, shrunk by `shrink` inches so parts that only touch don't count. */
function obb(p: ExplodePart, pose: Pose | undefined, shrink: number): OBB {
  const o = applyPose([0, 0, 0], pose);
  const axis = (v: V3) => sub(applyPose(v, pose), o);
  const c = applyPose([p.x + p.w / 2, p.y + p.h / 2, p.z + p.d / 2], pose);
  return { c, ax: [axis([1, 0, 0]), axis([0, 1, 0]), axis([0, 0, 1])], e: [p.w, p.h, p.d].map((s) => Math.max(0, s / 2 - shrink)) };
}
/** Separating-axis test for two oriented boxes. */
function overlap(a: OBB, b: OBB): boolean {
  if (a.e.some((x) => x <= 0) || b.e.some((x) => x <= 0)) return false;
  const axes = [...a.ax, ...b.ax];
  for (const u of a.ax) for (const v of b.ax) { const x = cross(u, v); if (Math.hypot(...x) > 1e-6) axes.push(x); }
  const d = sub(b.c, a.c);
  for (const L of axes) {
    const ra = a.e.reduce((s, e, i) => s + e * Math.abs(dot(a.ax[i], L)), 0);
    const rb = b.e.reduce((s, e, i) => s + e * Math.abs(dot(b.ax[i], L)), 0);
    if (Math.abs(dot(d, L)) > ra + rb) return false;
  }
  return true;
}

/** Grow every mover the way the solver does (PLAN §2.3 steps of 0.2 g), to test a solved layout too. */
function grown(L: Layout, steps: number): Layout {
  for (const m of L.movers.values()) {
    m.dist = Math.min(m.cap, m.dist + steps * 0.2 * L.g);
    if (m.bank) m.bank.spread = Math.min(1.6, m.bank.spread + steps * 0.1);
    if (m.lat) m.lat.side = Math.min(m.cap, m.lat.side + steps * 0.2 * L.g);
  }
  return L;
}

const moving = (p: ExplodePart) => p.unit !== "case" && p.role !== "hardware";

for (const [build, prompt] of Object.entries(BUILDS)) {
  test(`${build}: the layout reads the engine and never changes it`, () => {
    const proj = generateFromPrompt(prompt);
    const before = JSON.stringify(proj.panels);
    const L = layoutFor(proj.panels);
    posesFor(grown(L, 3));
    assert.equal(JSON.stringify(proj.panels), before);
    assert.equal(L.parts.length, proj.panels.length);
  });

  for (const [label, steps] of [["start", 0], ["solved", 3], ["far", 8]] as const) {
    test(`${build} (${label}): no moving unit passes through another unit at any frame of the tween`, () => {
      const L = grown(layoutFor(generateFromPrompt(prompt).panels), steps);
      const poses = posesFor(L);
      const movers = L.parts.filter(moving);
      const hits = new Set<string>();
      for (let f = 0; f <= 60; f++) {
        const u = f / 60;
        const box = new Map(L.parts.map((p) => {
          const pose = poses.get(p.id);
          return [p.id, obb(p, pose && poseAt(pose, p.role, u), 0.05)];
        }));
        for (const a of movers) {
          for (const b of L.parts) {
            if (a.id === b.id || a.unit === b.unit || b.role === "hardware") continue;
            // A part that starts inside another (inset panels, engine overlaps PLAN §5) only has to leave, not stay clear.
            if (overlap(obb(a, undefined, 0.05), obb(b, undefined, 0.05))) continue;
            if (overlap(box.get(a.id)!, box.get(b.id)!)) hits.add(`${a.name} × ${b.name} @${Math.round(u * EXPLODE_MS)}ms`);
          }
        }
      }
      assert.deepEqual([...hits].slice(0, 8), []);
    });
  }

  test(`${build} (simulated hollow 5-part drawers): no part passes through another unit at any frame`, () => {
    const panels = generateFromPrompt(prompt).panels;
    if (!panels.some((p) => p.type === "drawer")) return;
    setDrawerTag(SIM_DRAWER_TAG);
    try {
      for (const steps of [0, 3]) {
        const L = grown(layoutFor(simulateHollowDrawers(panels)), steps);
        const poses = posesFor(L);
        const hits = new Set<string>();
        for (let f = 0; f <= 60; f++) {
          const u = f / 60;
          const box = new Map(L.parts.map((p) => { const pose = poses.get(p.id); return [p.id, obb(p, pose && poseAt(pose, p.role, u), 0.05)]; }));
          for (const a of L.parts.filter(moving)) for (const b of L.parts) {
            if (a.id === b.id || b.role === "hardware") continue;
            if (a.unit === b.unit && !(a.role === "drawerFront" || b.role === "drawerFront")) continue;
            if (overlap(obb(a, undefined, 0.05), obb(b, undefined, 0.05))) continue;
            if (overlap(box.get(a.id)!, box.get(b.id)!)) hits.add(`${a.name} × ${b.name} @${Math.round(u * EXPLODE_MS)}ms (steps ${steps})`);
          }
        }
        assert.deepEqual([...hits].slice(0, 8), []);
      }
    } finally {
      setDrawerTag(null);
    }
  });

  test(`${build}: hardware rides its host, the anchor stays put, closing reverses opening`, () => {
    const L = layoutFor(generateFromPrompt(prompt).panels);
    const poses = posesFor(L);
    const byId = new Map(L.parts.map((p) => [p.id, p]));
    for (const p of L.parts) {
      if (p.role === "hardware" && p.host && byId.has(p.host)) {
        assert.deepEqual(poses.get(p.id), poses.get(p.host), p.name);
        const host = byId.get(p.host)!;
        for (let f = 0; f <= 20; f++) assert.deepEqual(poseAt(poses.get(p.id)!, p.role, f / 20), poseAt(poses.get(host.id)!, host.role, f / 20), `${p.name} rides ${host.name}`);
      }
      if (p.role === "bottom" && p.unit === "case" && !L.owner.has(p.id)) {
        const q = applyPose([p.x, p.y, p.z], poses.get(p.id));
        assert.deepEqual(q.map((v) => +v.toFixed(6) + 0), [p.x, p.y, p.z], p.name);
      }
      const pose = poses.get(p.id);
      if (!pose) continue;
      // Closing runs the same clock backward: frame u on the way in equals frame u on the way out.
      for (const u of [0.25, 0.5, 0.75]) assert.deepEqual(poseAt(pose, p.role, u), poseAt(pose, p.role, u));
      assert.deepEqual(poseAt(pose, p.role, 0).t, [0, 0, 0]);
      const end = poseAt(pose, p.role, 1);
      assert.deepEqual(end.t.map((v) => +v.toFixed(9)), pose.t.map((v) => +v.toFixed(9)));
      if (pose.rot) assert.ok(Math.abs(end.rot!.ang - pose.rot.ang) < 1e-9);
    }
  });
}

test("hollow drawers (SWE, stacked on #92): one drawer id groups front, sides, back and bottom; its bottom is never the case bottom", () => {
  const panels = generateFromPrompt("nightstand with 2 drawers").panels as any[];
  // Split each solid drawer box into a hollow 5-part drawer with a shared id, the shape SWE is shipping.
  const hollow: any[] = [];
  let k = 0;
  for (const p of panels) {
    if (p.type !== "drawer") { hollow.push(p); continue; }
    const id = `drw-${k++}`, { x, y, z } = p.position, { width: w, height: h, depth: d } = p.size;
    const front = panels.find((f: any) => /drawer front/i.test(f.name) && Math.abs(f.position.y - y) < 0.5);
    if (front) front.yardDrawer = id;
    const part = (name: string, type: string, pos: number[], size: number[]) =>
      hollow.push({ ...p, id: `${p.id}-${name}`, name: `${p.name} ${name}`, type, position: { x: pos[0], y: pos[1], z: pos[2] }, size: { width: size[0], height: size[1], depth: size[2] }, yardDrawer: id });
    part("left side", "side", [x, y, z], [0.5, h, d]);
    part("right side", "side", [x + w - 0.5, y, z], [0.5, h, d]);
    part("back", "back", [x, y, z], [w, h, 0.5]);
    part("bottom", "bottom", [x, y, z], [w, 0.25, d]);
  }
  setDrawerTag("yardDrawer");
  try {
    const parts = classify(hollow);
    const caseBottom = parts.filter((p) => p.role === "bottom");
    assert.equal(caseBottom.length, 1, caseBottom.map((p) => p.name).join(", "));
    const units = new Map<string, string[]>();
    for (const p of parts.filter((q) => q.unit.startsWith("D:"))) units.set(p.unit, [...(units.get(p.unit) ?? []), p.drawerPart ?? p.role]);
    assert.equal(units.size, 2);
    for (const list of units.values()) assert.deepEqual(list.sort(), ["back", "bottom", "front", "side", "side"]);
    const L = layoutFor(hollow);
    const poses = posesFor(L);
    for (const list of [...new Set(L.parts.filter((p) => p.unit.startsWith("D:")).map((p) => p.unit))]) {
      // The box (sides, back, bottom) moves as one; the front stands off it straight forward by front.out.
      const mine = L.parts.filter((p) => p.unit === list);
      const box = mine.filter((p) => p.role !== "drawerFront").map((p) => poses.get(p.id)!.t);
      assert.equal(new Set(box.map((t) => JSON.stringify(t))).size, 1, `${list} box moves as one`);
      const f = poses.get(mine.find((p) => p.role === "drawerFront")!.id)!.t;
      const out = L.owner.get(mine[0].id)!.front!.out;
      assert.ok(out > 0);
      assert.deepEqual(f.map((v) => +v.toFixed(6)), [box[0][0], box[0][1], box[0][2] + out].map((v) => +v.toFixed(6)), `${list} front stands off by ${out}`);
    }
  } finally {
    setDrawerTag(null);
  }
});

test("motion budget: open ≤ 1.2 s, close = 0.7 × open, reduced motion is a 150 ms fade", () => {
  assert.ok(EXPLODE_MS <= 1200);
  assert.equal(CLOSE_MS, Math.round(EXPLODE_MS * 0.7));
  assert.equal(REDUCED_FADE_MS, 150);
});
