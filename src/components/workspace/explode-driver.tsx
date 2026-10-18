"use client";
/**
 * See inside, item 1: drives the staged unit explode on the bench.
 * - Solves the layout on idle once the build has settled (one solver round per idle slice), cached per build
 *   and viewport; a tap before it finishes completes it at once.
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
import { CLOSE_MS, EXPLODE_MS, EXPLODE_VIEW, REDUCED_FADE_MS, stageWindow, windowed } from "@/components/workspace/explode-layout";
import { explodeClock, startTween, stepTween, type ExplodeSolved } from "@/components/workspace/explode-state";
import { solveSteps } from "@/components/workspace/explode-solver";
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
  const w = stageWindow(s!.roles.get(id) ?? "case");
  const m = windowed(u, w.move);
  const [tx, ty, tz] = pose.t;
  if (pose.rot) {
    const r = windowed(u, w.swing);
    const [px, py, pz] = pose.rot.pivot;
    outer.position.set(px + tx * m, py + ty * m, pz + tz * m);
    outer.quaternion.copy(Q.setFromAxisAngle(AX.set(...pose.rot.axis), pose.rot.ang * r));
    inner.position.set(-px, -py, -pz);
  } else {
    outer.position.set(tx * m, ty * m, tz * m);
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

type Job = { key: string; it: Generator<number, ExplodeSolved, void>; done: ExplodeSolved | null };
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
    if (job.current?.key === key) return job.current;
    const view = explodeView();
    job.current = {
      key,
      done: cache.get(key) ?? null,
      it: solveSteps({ gl, panels: project.panels, key, viewport: { w: size.width, h: size.height }, overlays: overlayRects(gl.domElement), view, fov: BENCH_FOV }),
    };
    return job.current;
  };
  const finish = (): ExplodeSolved => {
    const j = start();
    while (!j.done) { const r = j.it.next(); if (r.done) { j.done = r.value; cache.set(j.key, r.value); } }
    return j.done;
  };

  // On idle, after the build has settled (its reveal done): one solver round per idle slice.
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
      const r = j.it.next();
      if (r.done) { j.done = r.value; cache.set(j.key, r.value); return; }
      h = ric(tick);
    };
    h = window.setTimeout(tick, 1200);
    return () => { cancelled = true; window.clearTimeout(h); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, staged]);

  // Toggle: solve if needed (at once), then tween (or, reduced motion, jump with a 150 ms fade).
  const was = useRef(false);
  useEffect(() => {
    if (!staged) return;
    const reduced = reducedMotion();
    const fade = () => gl.domElement.animate([{ opacity: 0 }, { opacity: 1 }], { duration: REDUCED_FADE_MS, easing: "ease-out" });
    if (explode) {
      const s = finish();
      if (explodeClock.solved?.key !== s.key) {
        // A new build (or size) while See inside is on: start from the assembled pose.
        if (explodeClock.solved && explodeClock.solved.key.split("|")[0] !== s.key.split("|")[0]) explodeClock.u = 0;
        explodeClock.solved = s;
      }
      startTween(1, reduced ? 0 : EXPLODE_MS);
      if (reduced && !was.current) fade();
    } else {
      startTween(0, reduced ? 0 : CLOSE_MS);
      if (reduced && was.current) fade();
    }
    was.current = explode;
    for (const [id, g] of registry) applyOne(id, g);
    invalidate();
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
