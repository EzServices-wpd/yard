/**
 * See inside: the explode solver (PLAN §2.4). Runs once per build per viewport class, on idle after the
 * build settles, then is cached. Each round renders the layout's boxes as an ID buffer at 1/4 resolution
 * from the explode camera (fitBench on the EXPLODED box), finds the parts below N = 30% visible, and grows
 * the mover of each failing part's main occluder by 0.2 g along its axis (a drawer bank spreads instead; a
 * part hidden by its own unit is handed to stage B). Caps: every mover ≤ 1.6 × the case's largest dimension,
 * at most 40 rounds. What still fails goes to the stepper (PR 2).
 *
 * It renders into its own off-screen scene (boxes, one flat colour each) with the live renderer, and never
 * touches the live scene, the model or the plan.
 */
import * as THREE from "three";
import type { BenchView, Rect } from "@/lib/yard/benchFrame";
import { fitPoints } from "@/components/workspace/explode-frame";
import type { Panel } from "@/lib/yard/types";
import {
  boxOf, cornersOf, explodedBox, layoutFor, posedPoints, posesFor,
  type Box3, type Layout, type Pose, type V3,
} from "@/components/workspace/explode-layout";
import type { ExplodeSolved } from "@/components/workspace/explode-state";
import { renderIds } from "@/components/workspace/id-pass";

export const SOLVE_N = 0.3;
export const SOLVE_O = 0.6;
export const SOLVE_ROUNDS = 40;

/** Union of two boxes. */
export function unionBox(a: Box3, b: Box3): Box3 {
  return {
    minX: Math.min(a.minX, b.minX), minY: Math.min(a.minY, b.minY), minZ: Math.min(a.minZ, b.minZ),
    maxX: Math.max(a.maxX, b.maxX), maxY: Math.max(a.maxY, b.maxY), maxZ: Math.max(a.maxZ, b.maxZ),
  };
}

/** The camera the user will see the explode from (same math as the live CameraRig). */
export function explodeCamera(points: V3[], view: BenchView, viewport: { w: number; h: number }, overlays: Rect[], fov: number) {
  const frame = fitPoints({ points, view, viewport, overlays, fovDeg: fov });
  const cam = new THREE.PerspectiveCamera(fov, viewport.w / viewport.h, Math.max(0.1, frame.distance / 200), frame.distance * 30);
  cam.position.set(...frame.position);
  cam.lookAt(new THREE.Vector3(...frame.target));
  cam.setViewOffset(viewport.w, viewport.h, frame.viewOffset.x, frame.viewOffset.y, viewport.w, viewport.h);
  cam.updateProjectionMatrix();
  cam.updateMatrixWorld(true);
  return { cam, frame };
}

export function poseMatrix(p: { x: number; y: number; z: number; w: number; h: number; d: number }, pose?: Pose): THREE.Matrix4 {
  const c = new THREE.Vector3(p.x + p.w / 2, p.y + p.h / 2, p.z + p.d / 2);
  const m = new THREE.Matrix4();
  if (pose?.rot) {
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(...pose.rot.axis), pose.rot.ang);
    const piv = new THREE.Vector3(...pose.rot.pivot);
    c.sub(piv).applyQuaternion(q).add(piv);
    m.compose(c.add(new THREE.Vector3(...pose.t)), q, new THREE.Vector3(1, 1, 1));
  } else {
    m.makeTranslation(c.x + (pose?.t[0] ?? 0), c.y + (pose?.t[1] ?? 0), c.z + (pose?.t[2] ?? 0));
  }
  return m;
}

function hullArea(pts: [number, number][]): number {
  pts = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cr = (o: number[], a: number[], b: number[]) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo: [number, number][] = [], up: [number, number][] = [];
  for (const p of pts) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  for (const p of pts.slice().reverse()) { while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
  const h = lo.slice(0, -1).concat(up.slice(0, -1));
  let a = 0;
  for (let i = 0; i < h.length; i++) { const p = h[i], q = h[(i + 1) % h.length]; a += p[0] * q[1] - q[0] * p[1]; }
  return Math.abs(a) / 2;
}

export type SolveInput = {
  gl: THREE.WebGLRenderer;
  panels: readonly Panel[];
  key: string;
  viewport: { w: number; h: number };
  overlays: Rect[];
  view: BenchView;
  fov: number;
};

/**
 * The solver as steps (one round each), so it can run in idle slices; `finish` runs what is left at once.
 * Returns the solved poses, the exploded box, the rounds used and the parts still failing.
 */
export function* solveSteps(inp: SolveInput): Generator<number, ExplodeSolved, void> {
  const L: Layout = layoutFor(inp.panels);
  const assembled = boxOf(L.parts);
  const groups = [...new Set(L.parts.map((p) => p.group))];
  const scale = 0.25;
  const vw = Math.max(32, Math.round(inp.viewport.w * scale)), vh = Math.max(32, Math.round(inp.viewport.h * scale));
  const scene = new THREE.Scene();
  const meshes = L.parts.map((p, i) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(Math.max(p.w, 0.01), Math.max(p.h, 0.01), Math.max(p.d, 0.01)));
    m.matrixAutoUpdate = false;
    scene.add(m);
    return { mesh: m, id: i + 1, part: p };
  });
  const step = 0.2 * L.g;
  const selfOcc = new Set<string>();
  let rounds = 0, failing: string[] = [];
  let poses = posesFor(L);
  try {
    for (; rounds < SOLVE_ROUNDS; rounds++) {
      poses = posesFor(L);
      for (const { mesh, part } of meshes) { mesh.matrix.copy(poseMatrix(part, poses.get(part.id))); mesh.matrixWorld.copy(mesh.matrix); }
      const { cam } = explodeCamera(posedPoints(L, poses), inp.view, inp.viewport, inp.overlays, inp.fov);
      const ids = renderIds(inp.gl, scene, cam, meshes, vw, vh);
      const vis = new Array<number>(meshes.length + 1).fill(0);
      for (let k = 0; k < ids.length; k++) if (ids[k]) vis[ids[k]]++;
      // (a) visible / footprint below N, or (c) one other part covering more than O of it. A part can only be
      // over O covered when under 1 − O visible, so only those get a solo pass for (c).
      type Fail = { i: number; cnt: Map<number, number> };
      const fails: Fail[] = [];
      for (const { part, id } of meshes) {
        if (part.role === "hardware" || selfOcc.has(part.id)) continue;
        const pts = cornersOf(part, poses.get(part.id)).map((c) => {
          const v = new THREE.Vector3(...c).project(cam);
          return [((v.x + 1) / 2) * vw, ((1 - v.y) / 2) * vh] as [number, number];
        });
        const area = hullArea(pts);
        if (!(area > 0)) continue;
        const frac = vis[id] / area;
        if (frac >= Math.max(SOLVE_N, 1 - SOLVE_O)) continue;
        const solo = renderIds(inp.gl, scene, cam, [meshes[id - 1]], vw, vh);
        const cnt = new Map<number, number>();
        let foot = 0;
        for (let k = 0; k < solo.length; k++) if (solo[k] === id) { foot++; if (ids[k] && ids[k] !== id) cnt.set(ids[k], (cnt.get(ids[k]) ?? 0) + 1); }
        let top = 0;
        for (const n of cnt.values()) top = Math.max(top, n);
        if (frac < SOLVE_N || (foot > 0 && top / foot > SOLVE_O)) fails.push({ i: id, cnt });
      }
      failing = fails.map((f) => meshes[f.i - 1].part.id);
      if (!fails.length) break;
      const pushed = new Set<string>();
      let spread = false;
      for (const { i, cnt } of fails) {
        const P = meshes[i - 1].part;
        // The main occluder from ANOTHER unit (a drawer box always hides behind its own front; that part of
        // it is by design). Only a part hidden by nothing but its own unit is handed to stage B.
        const own = L.owner.get(P.id);
        let occ = 0, best = 0;
        for (const [o, n] of cnt) if (n > best && L.owner.get(meshes[o - 1].part.id) !== own) { best = n; occ = o; }
        let m = occ ? L.owner.get(meshes[occ - 1].part.id) : undefined;
        if (!m && cnt.size) { selfOcc.add(P.id); continue; }
        if (m && own && m.bank && m.bank === own.bank) {
          // A drawer hidden by a drawer: spread the banks upward (even gaps).
          if (!spread && m.bank.spread < 1.6) { m.bank.spread += 0.1; spread = true; pushed.add("bank"); }
          continue;
        }
        if (m?.lat && !own?.lat) {
          // A case part hidden by a drawer: step the drawer columns sideways, clear of the carcase.
          if (!pushed.has("lat") && m.lat.side < m.cap) { m.lat.side = Math.min(m.cap, m.lat.side + step); pushed.add("lat"); }
          continue;
        }
        if (!m || m.key === "anchor" || m.dist >= m.cap) m = own;
        if (m && m.key !== "anchor" && m.dist < m.cap && !pushed.has(m.key)) {
          const d = Math.min(m.cap, m.dist + step);
          // Linked movers keep one distance (both sides, both doors, matching drawers): gaps stay even.
          for (const q of L.movers.values()) if (q === m || (m.link && q.link === m.link)) { q.dist = Math.max(q.dist, d); pushed.add(q.key); }
        }
      }
      if (!pushed.size) break;
      yield rounds;
    }
  } finally {
    for (const { mesh } of meshes) mesh.geometry.dispose();
  }
  poses = posesFor(L);
  const box = unionBox(assembled, explodedBox(L, poses));
  const points = posedPoints(L, poses);
  const byId = new Map(L.parts.map((p) => [p.id, p]));
  const roles = new Map(L.parts.map((p) => [p.id, p.role === "hardware" && p.host ? byId.get(p.host)!.role : p.role]));
  return { key: inp.key, poses, roles, box, points, rounds, failing, groups };
}

export function solveNow(inp: SolveInput): ExplodeSolved {
  const it = solveSteps(inp);
  for (;;) { const r = it.next(); if (r.done) return r.value; }
}
