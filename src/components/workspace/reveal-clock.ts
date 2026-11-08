/**
 * Shared clock for the build reveal (UX plan item 1, "blueprint to wood"). The WebGL scene writes
 * it; the DOM status line and ruler read it. No React context crosses the <Canvas> boundary.
 */
export type RevealState = { active: boolean; n: number; wood: number; t0: number; end: number; skipped: boolean };
let state: RevealState = { active: false, n: 0, wood: 0, t0: 0, end: 0, skipped: false };
const subs = new Set<() => void>();
export const revealState = () => state;
export function setReveal(next: Partial<RevealState>) {
  state = { ...state, ...next };
  subs.forEach((f) => f());
}
export function subscribeReveal(f: () => void) {
  subs.add(f);
  return () => void subs.delete(f);
}
/** Asked by a tap, click or Esc: jump to the finished frame. */
let skipFn: (() => void) | null = null;
export const onRevealSkip = (f: (() => void) | null) => void (skipFn = f);
export const skipReveal = () => skipFn?.();

/** Timeline: wire 0–150 ms (it runs under the lamp fade), then one part every 60–90 ms (compressed past 24 parts), all ≤ 2.4 s. */
export const WIRE_MS = 150;
export const CALLOUT_MS = 200;
export const CAP_MS = 2400;
export function staggerFor(n: number) {
  return Math.max(20, Math.min(90, (CAP_MS - WIRE_MS - CALLOUT_MS) / Math.max(1, n)));
}
/** cubic-bezier(.2,.7,.2,1), the plan's camera ease. */
export function easeCam(x: number) {
  // Solve bezier x(t) = x by Newton, then return y(t).
  const cx = 3 * 0.2, bx = 3 * (0.2 - 0.2) - cx, ax = 1 - cx - bx;
  const cy = 3 * 0.7, by = 3 * (1 - 0.7) - cy, ay = 1 - cy - by;
  let t = x;
  for (let i = 0; i < 6; i++) {
    const f = ((ax * t + bx) * t + cx) * t - x;
    const d = (3 * ax * t + 2 * bx) * t + cx;
    if (Math.abs(d) < 1e-6) break;
    t -= f / d;
  }
  t = Math.min(1, Math.max(0, t));
  return ((ay * t + by) * t + cy) * t;
}
