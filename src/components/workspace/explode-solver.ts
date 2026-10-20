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
  TILT_MAX, TILT_STEP, boxOf, camDirOf, growIfClear, cornersOf, explodedBox, layoutFor, posedPoints, posesFor, tiltAxis,
  type Box3, type Layout, type Pose, type V3,
} from "@/components/workspace/explode-layout";
import type { ExplodeSolved } from "@/components/workspace/explode-state";
import { faceUpMaterial, renderIds } from "@/components/workspace/id-pass";
/** An id no part uses: a drawer bottom's non-inner faces, so only its inner face counts. */
const OTHER_ID = 0xfffffe;

export const SOLVE_N = 0.3;
export const SOLVE_O = 0.6;
/** The solver aims past the e2e's lines by this margin: it measures at 1/4 resolution, the e2e at full. */
export const SOLVE_MARGIN = 0.05;
/** Most a drawer bank spreads upward, in drawer heights per gap (1.6 left a 6-drawer dresser's backs hidden). */
export const SPREAD_MAX = 2.5;
export const SOLVE_ROUNDS = 40;
/** (b) of every-piece-visible: at least this many CSS px² of a part show (the e2e's M). */
export const SOLVE_M = 200;

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
  // Drawers tip toward the camera the user will see the explode from.
  L.tilt.axis = tiltAxis(inp.view.azimuthDeg);
  L.camDir = camDirOf(inp.view);
  const assembled = boxOf(L.parts);
  const groups = [...new Set(L.parts.map((p) => p.group))];
  const scale = 0.25;
  const vw = Math.max(32, Math.round(inp.viewport.w * scale)), vh = Math.max(32, Math.round(inp.viewport.h * scale));
  const scene = new THREE.Scene();
  const meshes = L.parts.map((p, i) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(Math.max(p.w, 0.01), Math.max(p.h, 0.01), Math.max(p.d, 0.01)));
    m.matrixAutoUpdate = false;
    scene.add(m);
    // A hollow drawer's bottom is judged by its INNER face (every-drawer rule): only its up faces keep its id.
    const material = p.drawerPart === "bottom" ? faceUpMaterial(i + 1, OTHER_ID) : undefined;
    return { mesh: m, id: i + 1, part: p, material };
  });
  const step = 0.2 * L.g;
  const selfOcc = new Set<string>();
  // Tip and spread steps that would make units pass through each other are taken back, and not tried again.
  let tiltBlocked = false, spreadBlocked = false;
  let rounds = 0, failing: string[] = [];
  let poses = posesFor(L);
  try {
    for (; rounds < SOLVE_ROUNDS; rounds++) {
      poses = posesFor(L);
      for (const { mesh, part } of meshes) { mesh.matrix.copy(poseMatrix(part, poses.get(part.id))); mesh.matrixWorld.copy(mesh.matrix); }
      const { cam } = explodeCamera(posedPoints(L, poses), inp.view, inp.viewport, inp.overlays, inp.fov);
      const ids = renderIds(inp.gl, scene, cam, meshes, vw, vh);
      const vis = new Array<number>(meshes.length + 1).fill(0);
      // Only ids that name a part count: OTHER_ID (a drawer bottom's outer faces) and a cleared pixel are not parts.
      const isPart = (o: number) => partIdAt(meshes, o) !== undefined;
      for (let k = 0; k < ids.length; k++) if (isPart(ids[k])) vis[ids[k]]++;
      // (a) visible / footprint below N, or (c) one other part covering more than O of it. A part can only be
      // over O covered when under 1 − O visible, so only those get a solo pass for (c).
      type Fail = { i: number; cnt: Map<number, number>; small?: boolean; onlySmall?: boolean };
      // Solver pixels are 1/scale CSS px on each side: (b) holds when vis / scale² >= SOLVE_M.
      const minPx = SOLVE_M * (vw / inp.viewport.w) * (vh / inp.viewport.h);
      const fails: Fail[] = [];
      for (const { part, id } of meshes) {
        if (part.role === "hardware" || selfOcc.has(part.id)) continue;
        const pts = cornersOf(part, poses.get(part.id)).map((c) => {
          const v = new THREE.Vector3(...c).project(cam);
          return [((v.x + 1) / 2) * vw, ((1 - v.y) / 2) * vh] as [number, number];
        });
        const inner = part.drawerPart === "bottom";
        const area = hullArea(pts);
        if (!(area > 0)) continue;
        const frac = vis[id] / area;
        const small = vis[id] < minPx;
        if (!inner && !small && frac >= Math.max(SOLVE_N, 1 - SOLVE_O) + SOLVE_MARGIN) continue;
        const solo = renderIds(inp.gl, scene, cam, [meshes[id - 1]], vw, vh);
        const cnt = new Map<number, number>();
        let foot = 0;
        for (let k = 0; k < solo.length; k++) if (solo[k] === id) { foot++; if (isPart(ids[k]) && ids[k] !== id) cnt.set(ids[k], (cnt.get(ids[k]) ?? 0) + 1); }
        let top = 0;
        for (const n of cnt.values()) top = Math.max(top, n);
        if (inner) {
          const low = foot > 0 && vis[id] / foot < SOLVE_N + SOLVE_MARGIN;
          if (low || small) fails.push({ i: id, cnt, small, onlySmall: !low });
          continue;
        }
        const hid = frac < SOLVE_N + SOLVE_MARGIN || (foot > 0 && top / foot > SOLVE_O - SOLVE_MARGIN);
        if (hid || small) fails.push({ i: id, cnt, small, onlySmall: !hid });
      }
      failing = fails.map((f) => partIdAt(meshes, f.i)).filter((x): x is string => x !== undefined);
      if (!fails.length) break;
      const pushed = new Set<string>();
      let spread = false;
      for (const { i, cnt, small, onlySmall } of fails) {
        const P = meshes[i - 1]?.part;
        if (!P) continue;
        const own0 = L.owner.get(P.id);
        // (b) too few pixels: a flat strip turns its broad face to the camera (tipping drawers would only grow the frame).
        if (small && P.role === "kick" && own0 && (own0.face ?? 0) < 1) {
          if (!pushed.has(`face:${own0.key}`)) { own0.face = Math.min(1, (own0.face ?? 0) + 0.25); pushed.add(`face:${own0.key}`); }
          continue;
        }
        // Too small but in plain view: pushing parts apart only shrinks the frame, so nothing else moves for it.
        if (onlySmall) continue;
        // The main occluder from ANOTHER unit (a drawer box always hides behind its own front; that part of
        // it is by design). Only a part hidden by nothing but its own unit is handed to stage B.
        const own = L.owner.get(P.id);
        let occ = 0, best = 0;
        for (const [o, n] of cnt) { const q = partIdAt(meshes, o); if (q !== undefined && n > best && L.owner.get(q) !== own) { best = n; occ = o; } }
        let m = occ ? L.owner.get(partIdAt(meshes, occ)!) : undefined;
        // A hollow drawer's inside (bottom or back) hidden mostly by its OWN side or back is seen side-on: tip every
        // drawer's open top toward the camera (one value), never just push it further away.
        let topO = 0, topN = 0;
        for (const [o, n] of cnt) if (n > topN && partIdAt(meshes, o) !== undefined) { topN = n; topO = o; }
        const topPart = topO ? meshes[topO - 1].part : undefined;
        if (own?.front && (P.drawerPart === "bottom" || P.drawerPart === "back") && topPart && L.owner.get(topPart.id) === own && topPart.drawerPart !== "front") {
          if (!pushed.has("tilt") && !tiltBlocked && L.tilt.ang < TILT_MAX) {
            const was = L.tilt.ang;
            if (growIfClear(L, () => { L.tilt.ang = Math.min(TILT_MAX, was + TILT_STEP); }, () => { L.tilt.ang = was; })) pushed.add("tilt");
            else tiltBlocked = true;
          }
          continue;
        }
        if (!m && cnt.size && (P.drawerPart === "bottom" || P.drawerPart === "back") && own?.front) {
          // A drawer's inside hidden by its own front: stand every front further off its box (one value).
          if (!pushed.has("front") && own.front.out < 1.2 * (P.d + 1)) { own.front.out += step; pushed.add("front"); }
          continue;
        }
        // Hidden by nothing but its own unit (stage B). A hollow drawer's pieces are never parked there: the layout
        // keeps moving, and the next drawer's front can come to cover them later (dresser6, jewelry box).
        if (!m && cnt.size) { if (!P.drawerPart) selfOcc.add(P.id); continue; }
        if (m && own && m.bank && m.bank === own.bank) {
          // A drawer hidden by a drawer: spread the banks upward (even gaps), up to SPREAD_MAX drawer heights.
          if (!spread && !spreadBlocked && m.bank.spread < SPREAD_MAX) {
            const bank = m.bank, was = bank.spread;
            if (growIfClear(L, () => { bank.spread = was + 0.1; }, () => { bank.spread = was; })) { spread = true; pushed.add("bank"); }
            else spreadBlocked = true;
          }
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
    for (const { mesh, material } of meshes) { mesh.geometry.dispose(); material?.dispose(); }
  }
  poses = posesFor(L);
  const box = unionBox(assembled, explodedBox(L, poses));
  const points = posedPoints(L, poses);
  const byId = new Map(L.parts.map((p) => [p.id, p]));
  const roles = new Map(L.parts.map((p) => [p.id, p.role === "hardware" && p.host ? byId.get(p.host)!.role : p.role]));
  return { key: inp.key, poses, roles, box, points, rounds, failing, groups };
}

/** The part id an ID-buffer value names, or undefined when it names none (0, OTHER_ID, out of range). */
export function partIdAt(meshes: readonly { part: { id: string } }[], o: number): string | undefined {
  return Number.isInteger(o) && o >= 1 && o <= meshes.length ? meshes[o - 1].part.id : undefined;
}

/**
 * The plain explode: the layout's own poses with no solver rounds (no rendering). The fallback whenever the solver
 * throws or runs out of time, so See inside always opens.
 */
export function plainExplode(panels: readonly Panel[], key: string, failing: string[] = []): ExplodeSolved {
  const L: Layout = layoutFor(panels);
  const poses = posesFor(L);
  const byId = new Map(L.parts.map((p) => [p.id, p]));
  const roles = new Map(L.parts.map((p) => [p.id, p.role === "hardware" && p.host ? byId.get(p.host)!.role : p.role]));
  return {
    key, poses, roles, box: unionBox(boxOf(L.parts), explodedBox(L, poses)), points: posedPoints(L, poses),
    rounds: 0, failing, groups: [...new Set(L.parts.map((p) => p.group))],
  };
}

/** Hard caps on one solve: never more steps than the solver's rounds allow, never longer than this on one call. */
export const SOLVE_MAX_STEPS = SOLVE_ROUNDS + 2;
export const SOLVE_FINISH_MS = 1500;

/**
 * Advances a solve job: `budget` steps (Infinity = to the end) within `deadlineMs`. Never loops forever:
 * - a thrown step (a solver bug) ends the job with the fallback, and is reported through onError;
 * - a job past SOLVE_MAX_STEPS or the deadline ends with the fallback too.
 * Returns the result once the job is over, else null (more idle slices to go).
 */
export function driveSolve(
  job: { it: Iterator<number, ExplodeSolved, void>; steps: number; done: ExplodeSolved | null },
  fallback: () => ExplodeSolved,
  opts: { budget?: number; deadlineMs?: number; now?: () => number; onError?: (e: unknown) => void } = {},
): ExplodeSolved | null {
  if (job.done) return job.done;
  const now = opts.now ?? (() => (typeof performance !== "undefined" ? performance.now() : Date.now()));
  const end = now() + (opts.deadlineMs ?? Infinity);
  const budget = opts.budget ?? Infinity;
  for (let k = 0; k < budget; k++) {
    if (job.steps >= SOLVE_MAX_STEPS || now() > end) {
      opts.onError?.(new Error(job.steps >= SOLVE_MAX_STEPS ? "explode solve: step cap" : "explode solve: time cap"));
      return (job.done = fallback());
    }
    let r: IteratorResult<number, ExplodeSolved>;
    try {
      r = job.it.next();
    } catch (e) {
      opts.onError?.(e);
      return (job.done = fallback());
    }
    job.steps++;
    if (r.done) return (job.done = r.value ?? fallback());
  }
  return null;
}

export function solveNow(inp: SolveInput): ExplodeSolved {
  const job = { it: solveSteps(inp), steps: 0, done: null as ExplodeSolved | null };
  return driveSolve(job, () => plainExplode(inp.panels, inp.key))!;
}
