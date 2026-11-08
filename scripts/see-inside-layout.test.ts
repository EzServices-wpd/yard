/**
 * See inside, item 1 (PLAN §2): the staged explode layout, renderer-free. The pixel checks (every piece really
 * visible) live in scripts/e2e/see-inside-every-piece.py; this pins the 3D rules the eye can't easily check:
 * the layout never touches the engine's parts, every part gets a role and a unit, hollow drawers move as one,
 * drawers form an aligned staircase that starts clear of the case front, no door, lid or drawer passes through
 * another unit at any frame of the open tween, hardware rides its host, the anchor never moves, and closing
 * reverses opening.
 *
 *   npx tsx --test scripts/see-inside-layout.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";
import { generateFromPrompt } from "../src/lib/yard/promptMain.ts";
import * as THREE from "three";
import { simulateHollowDrawers, SIM_DRAWER_TAG } from "../src/components/workspace/explode-sim.ts";
import { fitPoints } from "../src/components/workspace/explode-frame.ts";
import {
  CLOSE_MS, EXPLODE_MS, REDUCED_FADE_MS, TILT_MAX, applyPose, boxOf, camDirOf, classify, faceTurn, layoutFor, poseAt, posesFor,
  setDrawerTag, tiltAxis, tweenCollides,
  type ExplodePart, type Layout, type Pose, type V3,
} from "../src/components/workspace/explode-layout.ts";
import { explodeClock, explodeSettled, resetExplodeClock, startTween, stepTween } from "../src/components/workspace/explode-state.ts";

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
  test(`${build}: the layout reads the engine and never changes it; every part has a role, a unit and one mover at most`, () => {
    const proj = generateFromPrompt(prompt);
    const before = JSON.stringify(proj.panels);
    const L = layoutFor(proj.panels);
    posesFor(grown(L, 3));
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
  for (const [label, steps] of [["start", 0], ["solved", 3], ["far", 8]] as const) {
    test(`${build} (${label}): no moving unit passes through another unit at any frame of the tween`, () => {
      const L = grown(layoutFor(generateFromPrompt(prompt).panels), steps);
      const poses = posesFor(L);
      const hits = new Set<string>();
      for (let f = 0; f <= 60; f++) {
        const u = f / 60;
        const box = new Map(L.parts.map((p) => { const pose = poses.get(p.id); return [p.id, obb(p, pose && poseAt(pose, p.role, u), 0.05)]; }));
        for (const a of L.parts.filter(moving)) for (const b of L.parts) {
          if (a.id === b.id || a.unit === b.unit || b.role === "hardware") continue;
          // A part that starts inside another (inset panels, engine overlaps PLAN §5) only has to leave, not stay clear.
          if (overlap(obb(a, undefined, 0.05), obb(b, undefined, 0.05))) continue;
          if (overlap(box.get(a.id)!, box.get(b.id)!)) hits.add(`${a.name} × ${b.name} @${Math.round(u * EXPLODE_MS)}ms`);
        }
      }
      assert.deepEqual([...hits].slice(0, 8), []);
    });
  }

  test(`${build} (simulated hollow 5-part drawers): no part passes through another unit at any frame`, () => {
    const panels = generateFromPrompt(prompt).panels;
    // The 6-drawer dresser's drawers are #94-tagged hollow boxes already (the real-parts tests cover it).
    if (!panels.some((p) => p.type === "drawer") || build === "dresser6") return;
    setDrawerTag(SIM_DRAWER_TAG);
    try {
      for (const steps of [0, 3]) {
        const L = grown(layoutFor(simulateHollowDrawers(panels)), steps);
        const poses = posesFor(L);
        // The library's clearance rule (the solver's) agrees with this file's own 61-frame check.
        assert.equal(tweenCollides(L, poses, 40), false, `steps ${steps}`);
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
      setDrawerTag("drawerId");
    }
  });

  test(`${build}: the clearance rule sees a real clash (a moving unit posed into the case)`, () => {
    const L = layoutFor(generateFromPrompt(prompt).panels);
    const poses = posesFor(L);
    assert.equal(tweenCollides(L, poses, 40), false);
    const caseBox = boxOf(L.parts.filter((p) => p.unit === "case"));
    const mover = L.parts.find((p) => moving(p) && p.w > 1 && p.h > 1);
    if (!mover) return;
    // Every part of that unit lands in the middle of the case at the end of the tween.
    const into: V3 = [(caseBox.minX + caseBox.maxX) / 2 - (mover.x + mover.w / 2), (caseBox.minY + caseBox.maxY) / 2 - (mover.y + mover.h / 2), (caseBox.minZ + caseBox.maxZ) / 2 - (mover.z + mover.d / 2)];
    for (const p of L.parts) if (p.unit === mover.unit) poses.set(p.id, { t: into });
    assert.equal(tweenCollides(L, poses, 40), true);
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
      assert.deepEqual(poseAt(pose, p.role, 0).t, [0, 0, 0]);
      const end = poseAt(pose, p.role, 1);
      assert.deepEqual(end.t.map((v) => +v.toFixed(9)), pose.t.map((v) => +v.toFixed(9)));
      if (pose.rot) assert.ok(Math.abs(end.rot!.ang - pose.rot.ang) < 1e-9);
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

test("hollow drawers: the box moves as one and the front stands off it straight forward by front.out", () => {
  const L = layoutFor(generateFromPrompt("nightstand with 2 drawers").panels);
  const poses = posesFor(L);
  const units = new Set(L.parts.filter((p) => p.unit.startsWith("D:") && p.role !== "hardware").map((p) => p.unit));
  assert.equal(units.size, 2);
  for (const unit of units) {
    const mine = L.parts.filter((p) => p.unit === unit && p.role !== "hardware");
    const box = mine.filter((p) => p.role !== "drawerFront").map((p) => poses.get(p.id)!.t);
    assert.equal(new Set(box.map((t) => JSON.stringify(t))).size, 1, `${unit} box moves as one`);
    const f = poses.get(mine.find((p) => p.role === "drawerFront")!.id)!.t;
    const out = L.owner.get(mine[0].id)!.front!.out;
    assert.deepEqual(f.map((v) => +v.toFixed(6)), [box[0][0], box[0][1], box[0][2] + out].map((v) => +v.toFixed(6)), `${unit} front stands off by ${out}`);
  }
});

test("motion budget: open ≤ 1.2 s, close = 0.7 × open, reduced motion is a 150 ms fade", () => {
  assert.ok(EXPLODE_MS <= 1200);
  assert.equal(CLOSE_MS, Math.round(EXPLODE_MS * 0.7));
  assert.equal(REDUCED_FADE_MS, 150);
});

test("the one explode clock: a tween runs to its end and stops; reduced motion (0 ms) jumps; settled needs a solve and a still camera", () => {
  resetExplodeClock();
  startTween(1, EXPLODE_MS, 0);
  assert.equal(stepTween(EXPLODE_MS / 2), true);
  assert.ok(explodeClock.u > 0 && explodeClock.u < 1);
  assert.equal(stepTween(EXPLODE_MS + 1), false);
  assert.equal(explodeClock.u, 1);
  assert.equal(explodeSettled(), false, "no solve yet");
  explodeClock.solved = { key: "k" } as typeof explodeClock.solved;
  explodeClock.cameraBusy = true;
  assert.equal(explodeSettled(), false, "camera still gliding");
  explodeClock.cameraBusy = false;
  assert.equal(explodeSettled(), true);
  startTween(0, 0, 0);
  assert.equal(explodeClock.u, 0);
  assert.equal(stepTween(1), false);
  resetExplodeClock();
});

test("a tipped drawer's open top faces the camera more than a level one, from either side (left and right columns)", () => {
  const rot = (v: V3, r: NonNullable<Pose["rot"]>) => sub(applyPose(v, { t: [0, 0, 0], rot: { ...r, pivot: [0, 0, 0] } }), [0, 0, 0]);
  for (const az of [32, -32, 60, 0]) {
    const cam = camDirOf({ azimuthDeg: az, elevationDeg: 32 });
    const up = rot([0, 1, 0], { axis: tiltAxis(az), ang: TILT_MAX, pivot: [0, 0, 0] });
    assert.ok(up[0] * cam[0] + up[1] * cam[1] + up[2] * cam[2] > cam[1] + 0.05, `az ${az}`);
  }
});

test("a toekick turned fully faces the camera square on", () => {
  const kick = { x: 0, y: 0, z: 0, w: 24, h: 4, d: 0.75 };
  const cam = camDirOf({ azimuthDeg: 32, elevationDeg: 32 });
  const r = faceTurn(kick, cam, 1)!;
  const n = applyPose([0, 0, 1], { t: [0, 0, 0], rot: { ...r, pivot: [0, 0, 0] } });
  assert.ok(n[0] * cam[0] + n[1] * cam[1] + n[2] * cam[2] > 0.999);
  assert.equal(faceTurn(kick, cam, 0), undefined);
});

test("fitPoints frames every posed corner inside the free rect (desk 1280x800 with a card, phone 390x844)", () => {
  for (const [build, prompt] of Object.entries(BUILDS)) {
    const L = grown(layoutFor(generateFromPrompt(prompt).panels), 3);
    const poses = posesFor(L);
    const points = L.parts.flatMap((p) => { const out: V3[] = []; for (const X of [p.x, p.x + p.w]) for (const Y of [p.y, p.y + p.h]) for (const Z of [p.z, p.z + p.d]) out.push(applyPose([X, Y, Z], poses.get(p.id))); return out; });
    for (const [w, h, overlays] of [[1280, 800, [{ left: 0, top: 0, right: 360, bottom: 800 }]], [390, 844, []]] as const) {
      const fr = fitPoints({ points, view: { azimuthDeg: 32, elevationDeg: 32 }, viewport: { w, h }, overlays: [...overlays], fovDeg: 34 });
      const cam = new THREE.PerspectiveCamera(34, w / h, 0.1, 1e5);
      cam.position.set(...fr.position);
      cam.lookAt(new THREE.Vector3(...fr.target));
      cam.setViewOffset(w, h, fr.viewOffset.x, fr.viewOffset.y, w, h);
      cam.updateProjectionMatrix(); cam.updateMatrixWorld(true);
      for (const [x, y, z] of points) {
        const v = new THREE.Vector3(x, y, z).project(cam);
        const px = ((v.x + 1) / 2) * w, py = ((1 - v.y) / 2) * h;
        assert.ok(px >= fr.safe.left - 0.5 && px <= fr.safe.right + 0.5 && py >= fr.safe.top - 0.5 && py <= fr.safe.bottom + 0.5, `${build} ${w}x${h}: (${px.toFixed(1)}, ${py.toFixed(1)}) outside ${JSON.stringify(fr.safe)}`);
      }
    }
  }
});
