/**
 * Critic #140 rows 353 and 354 (See inside).
 * 353: reduced and full motion must land on the same pose. The solve is framed against the overlay cards; under full
 *   motion a card is still sliding/fading in when the idle solve starts, so the old driver solved against its
 *   mid-slide rect (or without it: opacity 0) and kept that solve, while reduced motion solved against the settled
 *   card. Rule: solve from the SETTLED cards (wait while one moves; re-solve when the settled cards differ from the
 *   ones the shown solve used). Checked with the real solver (explode-solver.ts) on a CPU ID buffer, for the
 *   6-drawer dresser and the nightstand at desk and phone sizes: every posed corner within 0.75 px.
 * 354: delete and undo keep the project id, so the solve key must carry the part list (count + ids).
 */
import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { generateFromPrompt } from "../src/lib/yard/prompt";
import { useYard } from "../src/lib/yard/store";
import { SOLVE_MAX_STEPS, explodeCamera, plainExplode, solveJob } from "../src/components/workspace/explode-solver";
import { EXPLODE_VIEW } from "../src/components/workspace/explode-layout";
import { SolveDesk, buildKey, cardsMoving, type Cards } from "../src/components/workspace/explode-settle";
import { runSlice } from "../src/components/workspace/step-budget";
import { BENCH_FOV, type Rect } from "../src/lib/yard/benchFrame";
import type { ExplodeSolved } from "../src/components/workspace/explode-state";

/** A CPU stand-in for the WebGL renderer: just what renderIds uses (clear, render flat ids with depth, read back). */
function cpuGl() {
  let target: { width: number; height: number; px?: Uint8Array } | null = null;
  const v = new THREE.Vector4(), n = new THREE.Vector3(), nm = new THREE.Matrix3();
  return {
    shadowMap: { autoUpdate: true },
    getRenderTarget: () => target, setRenderTarget: (t: typeof target) => { target = t; },
    getClearColor: (c: THREE.Color) => c.set(0), getClearAlpha: () => 1, setClearColor: () => {},
    clear: () => { if (target) target.px = new Uint8Array(target.width * target.height * 4); },
    readRenderTargetPixels: (t: typeof target, _x: number, _y: number, w: number, h: number, buf: Uint8Array) => { buf.set(t!.px!.subarray(0, w * h * 4)); },
    render(scene: THREE.Scene, cam: THREE.Camera) {
      const t = target!, W = t.width, H = t.height, px = t.px!, depth = new Float32Array(W * H).fill(Infinity);
      const vp = new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
      for (const o of scene.children) {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh || !mesh.layers.test(cam.layers)) continue;
        const mat = mesh.material as THREE.Material & { color?: THREE.Color; uniforms?: Record<string, { value: THREE.Vector3 }> };
        const rgb = (r: number, g: number, b: number) => [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
        const g = mesh.geometry, pos = g.getAttribute("position"), nor = g.getAttribute("normal"), idx = g.getIndex()!;
        const mvp = new THREE.Matrix4().multiplyMatrices(vp, mesh.matrixWorld);
        nm.getNormalMatrix(mesh.matrixWorld);
        for (let f = 0; f < idx.count; f += 3) {
          const ids = [idx.getX(f), idx.getX(f + 1), idx.getX(f + 2)];
          let col: number[];
          if (mat.uniforms) { n.fromBufferAttribute(nor, ids[0]).applyMatrix3(nm).normalize(); const u = n.y > 0.5 ? mat.uniforms.up.value : mat.uniforms.other.value; col = rgb(u.x, u.y, u.z); }
          else col = rgb(mat.color!.r, mat.color!.g, mat.color!.b);
          const s = ids.map((i) => { v.set(pos.getX(i), pos.getY(i), pos.getZ(i), 1).applyMatrix4(mvp); return v.w > 0 ? [((v.x / v.w + 1) / 2) * W, ((v.y / v.w + 1) / 2) * H, v.z / v.w] : null; });
          if (s.some((p) => !p)) continue;
          const [a, b, c] = s as number[][];
          const area = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
          if (!area) continue;
          const x0 = Math.max(0, Math.floor(Math.min(a[0], b[0], c[0]))), x1 = Math.min(W - 1, Math.ceil(Math.max(a[0], b[0], c[0])));
          const y0 = Math.max(0, Math.floor(Math.min(a[1], b[1], c[1]))), y1 = Math.min(H - 1, Math.ceil(Math.max(a[1], b[1], c[1])));
          for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
            const X = x + 0.5, Y = y + 0.5;
            const w0 = ((b[0] - X) * (c[1] - Y) - (b[1] - Y) * (c[0] - X)) / area, w1 = ((c[0] - X) * (a[1] - Y) - (c[1] - Y) * (a[0] - X)) / area, w2 = 1 - w0 - w1;
            if (w0 < 0 || w1 < 0 || w2 < 0) continue;
            const z = w0 * a[2] + w1 * b[2] + w2 * c[2], k = y * W + x;
            if (z >= depth[k]) continue;
            depth[k] = z; px[k * 4] = col[0]; px[k * 4 + 1] = col[1]; px[k * 4 + 2] = col[2]; px[k * 4 + 3] = 255;
          }
        }
      }
    },
  } as unknown as THREE.WebGLRenderer;
}

const gl = cpuGl();
const VIEWS = { desk: { w: 1280, h: 800 }, phone: { w: 390, h: 844 } } as const;
type View = keyof typeof VIEWS;
/** Settled cards (canvas px) and the same cards one frame into their slide-in under full motion. */
function cards(view: View): { settled: Rect[]; sliding: Rect[] } {
  const { w, h } = VIEWS[view];
  const settled = view === "phone"
    ? [{ left: 8, top: 8, right: w - 8, bottom: 64 }, { left: 0, top: h - 170, right: w, bottom: h }]
    : [{ left: 16, top: 16, right: 380, bottom: 120 }, { left: w - 360, top: 16, right: w - 16, bottom: h - 16 }];
  // Mid-slide: the bottom sheet / side dock still off its place (translate), the step card not yet shown (opacity 0).
  const sliding = view === "phone"
    ? [{ left: 0, top: h - 40, right: w, bottom: h + 130 }]
    : [{ left: w - 60, top: 16, right: w + 284, bottom: h - 16 }];
  return { settled, sliding };
}

function solve(desk: SolveDesk, base: string, c: Cards): ExplodeSolved | null {
  const j = desk.start(base, c);
  if (!j) return null;
  const r = j.done ?? runSlice(j, () => plainExplode([], j.key), { maxSteps: SOLVE_MAX_STEPS })!;
  desk.remember(j.key, r);
  return r;
}

/**
 * The driver's order of calls (explode-driver.tsx): idle ticks while the cards come in, then the tap, then the
 * cards-moved re-check while See inside is on. Returns the solve on screen at the end.
 */
function seeInside(q: string, view: View, timeline: Cards[]): ExplodeSolved {
  const p = generateFromPrompt(q);
  const { w, h } = VIEWS[view];
  const desk = new SolveDesk((key, overlays) => solveJob({ gl, panels: p.panels, key, viewport: { w, h }, overlays, view: EXPLODE_VIEW, fov: BENCH_FOV }), new Map());
  const base = `${buildKey(p.id, p.panels)}|${w}x${h}`;
  let shown: ExplodeSolved | null = null;
  for (const c of timeline) if ((shown = solve(desk, base, c))) break; // idle: the first tick that may solve
  const now = timeline[timeline.length - 1];
  shown = solve(desk, base, now) ?? shown; // tap
  if (shown && desk.stale(shown.key, base, now)) shown = solve(desk, base, now) ?? shown; // cards moved since
  return shown!;
}

function projected(s: ExplodeSolved, view: View, settled: Rect[]): [number, number][] {
  const { w, h } = VIEWS[view];
  // The camera the bench frames the explode with (canvas.tsx fit: the solved points, the settled cards).
  const { cam } = explodeCamera(s.points, EXPLODE_VIEW, { w, h }, settled, BENCH_FOV);
  return s.points.map((pt) => { const v = new THREE.Vector3(...pt).project(cam); return [((v.x + 1) / 2) * w, ((1 - v.y) / 2) * h]; });
}

for (const [slug, q] of [["dresser6", "6 drawer dresser"], ["nightstand", "nightstand with 2 drawers"]] as const) {
  for (const view of ["desk", "phone"] as const) {
    test(`row 353: ${slug} ${view}: reduced and full motion land on the same pose (<= 0.75 px)`, () => {
      const { settled, sliding } = cards(view);
      const full = seeInside(q, view, [{ rects: sliding, moving: true }, { rects: settled, moving: true }, { rects: settled, moving: false }]);
      const reduced = seeInside(q, view, [{ rects: settled, moving: false }]);
      const a = projected(full, view, settled), b = projected(reduced, view, settled);
      assert.equal(a.length, b.length);
      let d = 0;
      for (let i = 0; i < a.length; i++) d = Math.max(d, Math.abs(a[i][0] - b[i][0]), Math.abs(a[i][1] - b[i][1]));
      console.log(`${slug} ${view}: rounds full ${full.rounds} / reduced ${reduced.rounds}, max corner diff ${d.toFixed(2)} px`);
      assert.ok(d <= 0.75, `${slug} ${view}: full motion lands ${d.toFixed(2)} px from reduced motion (rounds ${full.rounds} vs ${reduced.rounds})`);
    });
  }
}

test("row 353: a card counts as moving only while a finite animation runs on it or a box around it", () => {
  const anim = (playState: string, endTime: number) => ({ playState, effect: { getComputedTiming: () => ({ endTime }) } });
  type N = { getAnimations: () => ReturnType<typeof anim>[]; parentElement: N | null };
  const host: N = { getAnimations: () => [], parentElement: null };
  const tray: N = { getAnimations: () => [], parentElement: host };
  const card: N = { getAnimations: () => [], parentElement: tray };
  assert.equal(cardsMoving([card], host), false);
  tray.getAnimations = () => [anim("running", 180)];
  assert.equal(cardsMoving([card], host), true, "a sliding tray moves its card");
  tray.getAnimations = () => [anim("running", Infinity), anim("finished", 180)];
  assert.equal(cardsMoving([card], host), false, "endless or finished animations never hold the solve");
});

test("row 354: delete and undo change the solve key (same project id), and undo gets the first key back", () => {
  const st = useYard.getState();
  const p = generateFromPrompt("nightstand with 2 drawers");
  st.setProject(p);
  const key = () => buildKey(useYard.getState().project.id, useYard.getState().project.panels);
  const k0 = key(), id0 = useYard.getState().project.id;
  useYard.getState().select(p.panels[p.panels.length - 1].id);
  useYard.getState().deleteSelected();
  assert.equal(useYard.getState().project.id, id0, "delete keeps the project id (why the old key went stale)");
  assert.equal(useYard.getState().project.panels.length, p.panels.length - 1, "one part deleted");
  const k1 = key();
  assert.notEqual(k1, k0, "after a delete See inside must solve again");
  useYard.getState().undo();
  assert.equal(key(), k0, "undo brings the part list (and its cached solve) back");
  // The part count and the ids are both in the key: a same-count list with another id is another key.
  const swapped = p.panels.map((x, i) => (i === 0 ? { ...x, id: x.id + "-b" } : x));
  assert.notEqual(buildKey(p.id, swapped), k0);
  assert.match(k0, new RegExp(`\\|${p.panels.length}p`));
});
