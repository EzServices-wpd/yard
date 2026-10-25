"use client";
/**
 * See inside, item 1: drives the staged unit explode on the bench.
 * - Solves the layout on idle once the build and the overlay cards have settled (one solver slice per idle
 *   callback), cached per part list, viewport and settled cards (explode-settle.ts, rows 353/354). A tap before it
 *   finishes runs the rest one slice per task (the page keeps its frames) with a 1.5 s wall deadline, then uses the
 *   solve so far. Cards that settle somewhere else while See inside is on re-solve, so reduced and full motion end
 *   on the same pose. Every solve is a step-budget job: a new key or unmounting closes the old one, so its ID-pass
 *   meshes are always freed.
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
import { runJob, runSlice } from "@/components/workspace/step-budget";
import { SolveDesk, buildKey, cardsMoving, type Cards } from "@/components/workspace/explode-settle";
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

/** The cards over the bench now, and whether any is still sliding or fading into place (row 353). */
function cardsNow(canvas: HTMLCanvasElement): Cards {
  const host = canvas.closest("[data-bench-host]");
  const els = host ? host.querySelectorAll<HTMLElement>("[data-bench-overlay]") : [];
  return { rects: overlayRects(canvas), moving: cardsMoving(els as Iterable<HTMLElement>, host as HTMLElement | null) };
}
/** Longest a tap waits for the cards to settle before it solves against them as they are. */
const SETTLE_WAIT_MS = 1000;

export function ExplodeDriver({ project, explode }: { project: YardProject; explode: boolean }) {
  const { gl, size, invalidate } = useThree();
  // Row 354: the part list, not just the project id (delete and undo keep the id).
  const base = `${buildKey(project.id, project.panels)}|${Math.round(size.width)}x${Math.round(size.height)}`;
  const staged = project.panels.length > 0;
  const desk = useRef<SolveDesk | null>(null);
  desk.current ??= new SolveDesk(() => { throw new Error("unset"); });
  desk.current.make = (key, overlays) => solveJob({ gl, panels: project.panels, key, viewport: { w: size.width, h: size.height }, overlays, view: explodeView(), fov: BENCH_FOV });
  const start = (force = false) => {
    const c = cardsNow(gl.domElement);
    return desk.current!.start(base, force ? { ...c, moving: false } : c);
  };

  useEffect(() => {
    wake = () => invalidate();
    return () => { wake = null; };
  }, [invalidate]);

  // A solver error or a slow solve never hangs the tab: it falls back to the plain explode and logs (row 105).
  const fallback = (key: string) => () => plainExplode(project.panels, key);
  const onError = (e: unknown) => console.warn("[yard] See inside: explode solver stopped early (kept the solve so far, else the plain explode)", e);

  // Unmount: close whatever solve is still open.
  useEffect(() => () => desk.current?.close(), []);

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
      // A card still sliding in: solve once it has settled, never against where it is mid-slide (row 353).
      if (!j) { h = window.setTimeout(tick, 100); return; }
      if (j.done) return;
      const r = runSlice(j, fallback(j.key), { maxSteps: SOLVE_MAX_STEPS, sliceMs: SOLVE_SLICE_MS }, { onError });
      if (r) { desk.current!.remember(j.key, r); return; }
      h = ric(tick);
    };
    h = window.setTimeout(tick, 1200);
    return () => { cancelled = true; window.clearTimeout(h); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base, staged]);

  // Toggle: once the cards have settled (at most SETTLE_WAIT_MS), solve if needed (the rest of it one slice per task,
  // at most SOLVE_FINISH_MS), then tween (or, reduced motion, jump with a 150 ms fade). While on, a card that settles
  // somewhere else (tray, step card, a late resize) re-solves against it (row 353).
  const was = useRef(false);
  useEffect(() => {
    if (!staged) return;
    const reduced = reducedMotion();
    const fade = () => gl.domElement.animate([{ opacity: 0 }, { opacity: 1 }], { duration: REDUCED_FADE_MS, easing: "ease-out" });
    const settle = () => { for (const [id, g] of registry) applyOne(id, g); invalidate(); };
    if (!explode) {
      startTween(0, reduced ? 0 : CLOSE_MS);
      if (reduced && was.current) fade();
      was.current = false;
      settle();
      return;
    }
    let cancel: (() => void) | undefined, running: unknown = null, t = 0, gone = false;
    const show = (s: ExplodeSolved) => {
      if (explodeClock.solved !== s) {
        const prev = explodeClock.solved;
        // A new build while See inside is on: start from the assembled pose.
        if (prev && prev.key.split("|")[0] !== s.key.split("|")[0]) explodeClock.u = 0;
        // A re-solve after the explode has landed (the cards moved): a 150 ms fade, never a jump cut.
        else if (prev && was.current && !explodeClock.tween) fade();
        setSolved(s);
      }
      explodeClock.solving = false;
      startTween(1, reduced ? 0 : EXPLODE_MS);
      if (reduced && !was.current) fade();
      was.current = true;
      settle();
    };
    const t0 = performance.now();
    const ensure = () => {
      if (gone) return;
      const j = start(performance.now() - t0 > SETTLE_WAIT_MS);
      explodeClock.solving = true;
      if (!j) { t = window.setTimeout(ensure, 50); return; }
      if (j === running && !j.done) return; // already being solved; it shows when it lands
      // Another key: stop the old run first, so it can never land (or be cached) after this one.
      cancel?.(); cancel = undefined; running = null;
      if (j.done) { show(j.done); return; }
      running = j;
      let capped = false;
      const noteCap = (e: unknown) => { if (e instanceof Error && e.message.endsWith("time cap")) capped = true; onError(e); };
      cancel = runJob(j, fallback(j.key), { maxSteps: SOLVE_MAX_STEPS, deadlineMs: SOLVE_FINISH_MS, sliceMs: SOLVE_SLICE_MS }, (r) => {
        running = null;
        if (!capped) { desk.current!.remember(j.key, r); show(r); return; }
        // Time cap (a slow or busy device): show the solve so far now, then solve the same key again in slices with
        // only the step cap and swap it in, so the pose you end on never depends on device speed (row 353).
        show(r);
        explodeClock.solving = true;
        const f = desk.current!.fresh(j);
        running = f;
        cancel = runJob(f, fallback(f.key), { maxSteps: SOLVE_MAX_STEPS, deadlineMs: Infinity, sliceMs: SOLVE_SLICE_MS }, (r2) => { running = null; desk.current!.remember(f.key, r2); show(r2); }, { onError });
      }, { onError: noteCap });
    };
    ensure();
    // Cards that move after the solve: re-check once they have been still for a moment.
    const host = gl.domElement.closest("[data-bench-host]");
    let k = 0;
    const kick = () => {
      window.clearTimeout(k);
      explodeClock.solving = true;
      k = window.setTimeout(() => {
        if (gone) return;
        const c = cardsNow(gl.domElement);
        if (c.moving) return kick();
        if (explodeClock.solved && desk.current!.stale(explodeClock.solved.key, base, c)) ensure();
        else if (!running) explodeClock.solving = false;
      }, 120);
    };
    const ro = new ResizeObserver(kick);
    const mo = new MutationObserver(() => { host?.querySelectorAll("[data-bench-overlay]").forEach((el) => ro.observe(el)); kick(); });
    if (host) {
      host.querySelectorAll("[data-bench-overlay]").forEach((el) => ro.observe(el));
      mo.observe(host, { subtree: true, childList: true, attributes: true, attributeFilter: ["hidden", "class"] });
      host.addEventListener("transitionend", kick);
      host.addEventListener("animationend", kick);
    }
    return () => {
      gone = true; explodeClock.solving = false; cancel?.(); window.clearTimeout(t); window.clearTimeout(k); ro.disconnect(); mo.disconnect();
      host?.removeEventListener("transitionend", kick); host?.removeEventListener("animationend", kick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [explode, base, staged]);

  useFrame(() => {
    const moving = stepTween();
    for (const [id, g] of registry) applyOne(id, g);
    if (moving) invalidate();
  });
  return null;
}

export { CLOSE_MS, EXPLODE_MS };
