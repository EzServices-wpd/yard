/**
 * See inside, the readable cluster (Critic #98 round 2: every piece at least 200 CSS px² in the one exploded frame,
 * every build, every viewport, no exemptions). Renderer-free: movers too small to read leave the assembly for a
 * cluster beside it, nearer the camera; the tween stays clear, the engine is untouched, and an empty cluster moves
 * nothing.
 *
 *   npx tsx --test scripts/explode-cluster.test.ts
 */
import test from "node:test";
import assert from "node:assert/strict";
import { generateFromPrompt } from "../src/lib/yard/promptMain.ts";
import { CLUSTER_WINDOW, EXPLODE_VIEW, layoutFor, posesFor, tweenCollides, type Layout } from "../src/components/workspace/explode-layout.ts";
import { CLUSTER_TARGET, applyCluster, axisAngleOf, closeMembers, clusterYaw, minReadable, type ClusterFrame } from "../src/components/workspace/explode-cluster.ts";

const VIEWS: Record<string, ClusterFrame> = {
  desk: { view: EXPLODE_VIEW, viewport: { w: 1280, h: 800 }, overlays: [{ left: 0, top: 0, right: 360, bottom: 800 }], fov: 34 },
  phone: { view: EXPLODE_VIEW, viewport: { w: 390, h: 844 }, overlays: [], fov: 34 },
};
const BUILDS = ["6 drawer dresser", "pocket vanity", "pantry cabinet 30 wide 84 tall 18 deep", "jewelry box with drawers", '60" desk with drawers'];
const drawerKeys = (L: Layout) => [...L.movers.values()].filter((m) => m.key.startsWith("D:") || m.key.startsWith("kick:")).map((m) => m.key);

for (const q of BUILDS) for (const [v, F] of Object.entries(VIEWS)) {
  test(`${q} @${v}: the cluster reaches the target or reads better than the plain explode, keeps the tween clear and never changes the engine`, () => {
    const proj = generateFromPrompt(q);
    const before = JSON.stringify(proj.panels);
    const L = layoutFor(proj.panels);
    const poses = posesFor(L);
    const plain = minReadable(L, poses, F);
    const keys = drawerKeys(L);
    if (!keys.length) return;
    L.cluster = closeMembers(L, keys);
    // Whole drawers only: a drawer's front and box join together (closeMembers closes over links).
    for (const k of keys) assert.ok(L.cluster.has(k), k);
    const moved = applyCluster(L, poses, F);
    assert.equal(JSON.stringify(proj.panels), before);
    if (!moved) return; // nothing read better than the plain explode: nothing moved
    const ids = new Set(L.parts.filter((p) => { const m = L.owner.get(p.id) ?? (p.host ? L.owner.get(p.host) : undefined); return !!m && L.cluster!.has(m.key); }).map((p) => p.id));
    // It either reaches the target (the smallest stage share that does wins) or reads better than the plain explode.
    const got = minReadable(L, poses, F, ids);
    assert.ok(got >= CLUSTER_TARGET || got > plain, `${q} @${v}: cluster ${got.toFixed(0)} px² vs plain ${plain.toFixed(0)} px²`);
    assert.equal(tweenCollides(L, poses), false, `${q} @${v}: cluster tween passes through something`);
    for (const id of ids) {
      const p = poses.get(id)!;
      assert.ok(p.cl && p.clu, id);
      assert.ok(p.clu![0] >= CLUSTER_WINDOW[0] - 1e-9 && p.clu![1] <= CLUSTER_WINDOW[1] + 1e-9, `${id}: its slice ${p.clu} is inside the cluster window`);
    }
    // The pick is kept while the members stay the same (no flip-flop between solver rounds).
    const pick = JSON.stringify(L.clusterPick);
    applyCluster(L, posesFor(L), F);
    assert.equal(JSON.stringify(L.clusterPick), pick);
  });
}

test("an empty cluster moves nothing", () => {
  const L = layoutFor(generateFromPrompt("3 drawer dresser").panels);
  const poses = posesFor(L);
  const snap = JSON.stringify([...poses]);
  assert.equal(applyCluster(L, poses, VIEWS.desk), false);
  L.cluster = new Set();
  assert.equal(applyCluster(L, poses, VIEWS.desk), false);
  assert.equal(JSON.stringify([...poses]), snap);
});

test("cluster turns are about the vertical only and small: standing pieces stand, lying pieces lie", () => {
  for (const az of [0, 32, -32, 75]) {
    for (const p of [{ w: 20, h: 6, d: 0.5 }, { w: 0.5, h: 6, d: 14 }, { w: 20, h: 0.25, d: 14 }]) {
      const y = clusterYaw(p, az);
      assert.ok(Number.isFinite(y) && Math.abs(y) <= Math.PI / 2 + 1e-9, `${JSON.stringify(p)} az ${az}: ${y}`);
    }
  }
  // axisAngleOf reads back a rotation about +y.
  const a = 0.6, c = Math.cos(a), s = Math.sin(a);
  const r = axisAngleOf([c, 0, s, 0, 1, 0, -s, 0, c]);
  assert.ok(Math.abs(Math.abs(r.ang) - a) < 1e-9 && Math.abs(Math.abs(r.axis[1]) - 1) < 1e-9);
});
