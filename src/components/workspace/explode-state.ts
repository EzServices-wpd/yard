/**
 * See inside: the shared explode clock. One tween (0 = assembled, 1 = exploded) that every part and the
 * camera read in useFrame, so the whole move is transform-only and renders only while it runs
 * (frameloop "demand": the driver invalidates while busy, then stops).
 */
import type { Box3, Pose, Role, V3 } from "@/components/workspace/explode-layout";

export type ExplodeSolved = {
  key: string;
  poses: Map<string, Pose>;
  /** Stage role per part (hardware takes its host's), for stageWindow. */
  roles: Map<string, Role>;
  box: Box3;
  /** Every part's posed corners: the explode camera fits these (explode-frame.ts). */
  points: V3[];
  rounds: number;
  /** Parts the solver could not make pass in one frame (handed to the stepper, PR 2). */
  failing: string[];
  groups: string[];
};

type Tween = { from: number; to: number; t0: number; dur: number };

export const explodeClock = {
  /** Current progress 0..1 (eased in the reader). */
  u: 0,
  target: 0,
  tween: null as Tween | null,
  solved: null as ExplodeSolved | null,
  /** The camera's own glide (CameraRig), so settled waits for it too. */
  cameraBusy: false,
  /** A solve (or the check for cards that moved) is still running, so the shown pose may change (row 353). */
  solving: false,
  /** When the last tween ended (ms, performance.now()). */
  endedAt: 0,
};

/** A new solve for the camera to frame (CameraRig refits when it lands; a tap's solve can land a little later). */
let solvedV = 0;
const solvedSubs = new Set<() => void>();
export function setSolved(s: ExplodeSolved) {
  explodeClock.solved = s;
  solvedV++;
  solvedSubs.forEach((f) => f());
}
export const solvedVersion = () => solvedV;
export function subscribeSolved(f: () => void) {
  solvedSubs.add(f);
  return () => void solvedSubs.delete(f);
}

export function startTween(to: number, dur: number, now = performance.now()) {
  const c = explodeClock;
  if (c.target === to && !c.tween && c.u === to) return;
  c.target = to;
  if (dur <= 0) { c.u = to; c.tween = null; c.endedAt = now; return; }
  c.tween = { from: c.u, to, t0: now, dur: dur * Math.abs(to - c.u) };
  if (c.tween.dur <= 0) { c.u = to; c.tween = null; c.endedAt = now; }
}

/** Advance the clock; returns true while still moving. */
export function stepTween(now = performance.now()): boolean {
  const c = explodeClock, t = c.tween;
  if (!t) return false;
  const k = Math.min(1, (now - t.t0) / t.dur);
  c.u = t.from + (t.to - t.from) * k;
  if (k >= 1) { c.u = t.to; c.tween = null; c.endedAt = now; return false; }
  return true;
}

export function explodeSettled(): boolean {
  const c = explodeClock;
  return c.target === 1 && !c.tween && !c.cameraBusy && !c.solving && c.u === 1 && !!c.solved;
}

export function resetExplodeClock() {
  explodeClock.u = 0; explodeClock.target = 0; explodeClock.tween = null; explodeClock.solved = null; explodeClock.cameraBusy = false; explodeClock.solving = false;
}
