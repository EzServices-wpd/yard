"use client";
/**
 * See inside, item 1: drives the staged unit explode on the bench.
 * - Solves the layout on idle once the build has settled (one solver slice per idle callback), cached per build
 *   and viewport. A tap before it finishes runs the rest one slice per task (the page keeps its frames) with a
 *   1.5 s wall deadline, then uses the solve so far. Every solve is a step-budget job: a new build, a new size or
 *   unmounting closes the old one, so its ID-pass meshes are always freed.
 * - Runs the one tween (1.2 s open, 0.7× to close) and moves every part's explode groups (transform only),
 *   invalidating frames only while something moves (frameloop "demand").
 * - Reduced motion: no tween, the same final pose, a 150 ms fade.
 */
import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useYard } from "@/lib/yard/store";
import type { YardProject } from "@/lib/yard/types";
import { BENCH_FOV, type BenchView, type Rect } from "@/lib/yard/benchFrame";
import { CLOSE_MS, EXPLODE_MS, EXPLODE_VIEW, REDUCED_FADE_MS, poseAt } from "@/components/workspace/explode-layout";
import { explodeClock, setSolved, startTween, stepTween, type ExplodeSolved } from "@/components/workspace/explode-state";
import { SOLVE_FINISH_MS, SOLVE_MAX_STEPS, SOLVE_SLICE_MS, plainExplode, solveJob } from "@/components/workspace/explode-solver";
import { closeJob, runJob, runSlice, type StepJob } from "@/components/workspace/step-budget";
import { revealState } from "@/components/workspace/reveal-clock";

type Groups = { outer: THREE.Group | null; inner: THREE.Group | null };
const registry = new Map<string, Groups>();
let wake: (() => void) | null = null;

/** PanelMesh's two explode groups: outer = pivot + translation and the swing, inner = −pivot. */
export function useExplodeRefs(id: string) {
  const g = useRef<Groups>({ outer: null, inner: null });
  return useMemo(() => {
    const sync = () => {
      if (g.current.outer && g.current.inner) { registry.set(id, g.current); applyOne(id, g.current); wake?.(); }
      else if (registry.get(id) === g.current) registry.delete(id);
    };
    return {
      outer: (o: THREE.Group | null) => { g.current.outer = o; sync(); },
      inner: (o: THREE.Group | null) => { g.current.inner = o; sync(); },
    };
  }, [id]);
}

const Q = new THREE.Quaternion();
const AX = new THREE.Vector3();
function applyOne(id: string, g: Groups) {
  const { outer, inner } = g;
  if (!outer || !inner) return;
  const s = explodeClock.solved;
  const pose = s?.poses.get(id);
  const u = explodeClock.u;
  if (!pose || u <= 0) {
    outer.position.set(0, 0, 0); outer.quaternion.identity(); inner.position.set(0, 0, 0);
    return;
  }
  const at = poseAt(pose, s!.roles.get(id) ?? "case", u);
  const [tx, ty, tz] = at.t;
  if (at.rot) {
    const [px, py, pz] = at.rot.pivot;
    outer.position.set(px + tx, py + ty, pz + tz);
    outer.quaternion.copy(Q.setFromAxisAngle(AX.set(...at.rot.axis), at.rot.ang));
    inner.position.set(-px, -py, -pz);
  } else {
    outer.position.set(tx, ty, tz);
    outer.quaternion.identity();
    inner.position.set(0, 0, 0);
  }
}

const reducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Canvas-relative rects of the UI cards floating over the bench (marked data-bench-overlay). */
export function overlayRects(canvas: HTMLCanvasElement): Rect[] {
  const host = canvas.closest("[data-bench-host]") ?? canvas.parentElement?.parentElement?.parentElement;
  if (!host) return [];
  const c = canvas.getBoundingClientRect();
  const out: Rect[] = [];
  host.querySelectorAll<HTMLElement>("[data-bench-overlay]").forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return;
    const st = window.getComputedStyle(el);
    if (st.visibility === "hidden" || st.display === "none" || Number(st.opacity) === 0) return;
    out.push({ left: r.left - c.left, top: r.top - c.top, right: r.right - c.left, bottom: r.bottom - c.top });
  });
  return out;
}

/** The view the explode is framed from: the user's own angle if they turned it, else 32° az / 32° el. */
export function explodeView(): BenchView {
  const st = useYard.getState();
  return st.orbited && st.userView ? st.userView : EXPLODE_VIEW;
}

type Job = StepJob<ExplodeSolved> & { key: string };
const cache = new Map<string, ExplodeSolved>();

export function ExplodeDriver({ project, explode }: { project: YardProject; explode: boolean }) {
  const { gl, size, invalidate } = useThree();
  const job = useRef<Job | null>(null);
  const key = `${project.id}|${Math.round(size.width)}x${Math.round(size.height)}`;
  const staged = project.panels.length > 0;

  useEffect(() => {
    wake = () => invalidate();
    return () => { wake = null; };
  }, [invalidate]);

  const start = (): Job => {
    const j = job.current;
    // The same build and size, still alive: keep it. A cancelled one (closed before it finished) starts again.
    if (j && j.key === key && !(j.closed && !j.done)) return j;
    // A new build or size: drop the old solve and free its meshes.
    if (j && !j.done) closeJob(j);
    const sj = solveJob({ gl, panels: project.panels, key, viewport: { w: size.width, h: size.height }, overlays: overlayRects(gl.domElement), view: explodeView(), fov: BENCH_FOV });
    const next: Job = Object.assign(sj, { key });
    const hit = cache.get(key);
    if (hit) { next.done = hit; closeJob(next); }
    return (job.current = next);
  };
  // A solver error or a slow solve never hangs the tab: it falls back to the plain explode and logs (row 105).
  const fallback = () => plainExplode(project.panels, key);
  const onError = (e: unknown) => console.warn("[yard] See inside: explode solver stopped early (kept the solve so far, else the plain explode)", e);

  // Unmount: close whatever solve is still open.
  useEffect(() => () => { const j = job.current; if (j && !j.done) closeJob(j); job.current = null; }, []);

  // On idle, after the build has settled (its reveal done): one solver slice per idle callback.
  useEffect(() => {
    if (!staged) return;
    let cancelled = false, h = 0;
    const ric = (f: () => void) => {
      const w = window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
      return w.requestIdleCallback ? w.requestIdleCallback(f, { timeout: 1500 }) : window.setTimeout(f, 50);
    };
    const tick = () => {
      if (cancelled) return;
      if (revealState().active || document.hidden) { h = window.setTimeout(tick, 400); return; }
      const j = start();
      if (j.done) return;
      const r = runSlice(j, fallback, { maxSteps: SOLVE_MAX_STEPS, sliceMs: SOLVE_SLICE_MS }, { onError });
      if (r) { cache.set(j.key, r); return; }
      h = ric(tick);
    };
    h = window.setTimeout(tick, 1200);
    return () => { cancelled = true; window.clearTimeout(h); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, staged]);

  // Toggle: solve if needed (the rest of it one slice per task, at most SOLVE_FINISH_MS), then tween (or, reduced
  // motion, jump with a 150 ms fade).
  const was = useRef(false);
  useEffect(() => {
    if (!staged) return;
    const reduced = reducedMotion();
    const fade = () => gl.domElement.animate([{ opacity: 0 }, { opacity: 1 }], { duration: REDUCED_FADE_MS, easing: "ease-out" });
    const settle = () => { for (const [id, g] of registry) applyOne(id, g); invalidate(); };
    if (explode) {
      const show = (s: ExplodeSolved) => {
        if (explodeClock.solved?.key !== s.key) {
          // A new build (or size) while See inside is on: start from the assembled pose.
          if (explodeClock.solved && explodeClock.solved.key.split("|")[0] !== s.key.split("|")[0]) explodeClock.u = 0;
          setSolved(s);
        }
        startTween(1, reduced ? 0 : EXPLODE_MS);
        if (reduced && !was.current) fade();
        was.current = true;
        settle();
      };
      const j = start();
      if (j.done) { show(j.done); return; }
      const cancel = runJob(j, fallback, { maxSteps: SOLVE_MAX_STEPS, deadlineMs: SOLVE_FINISH_MS, sliceMs: SOLVE_SLICE_MS }, (r) => { cache.set(j.key, r); show(r); }, { onError });
      return cancel;
    }
    startTween(0, reduced ? 0 : CLOSE_MS);
    if (reduced && was.current) fade();
    was.current = false;
    settle();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [explode, key, staged]);

  useFrame(() => {
    const moving = stepTween();
    for (const [id, g] of registry) applyOne(id, g);
    if (moving) invalidate();
  });
  return null;
}

export { CLOSE_MS, EXPLODE_MS };
