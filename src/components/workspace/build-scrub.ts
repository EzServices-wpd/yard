import type { BuildPlan, YardProject } from "@/lib/yard/types";
import { buildOrder } from "./build-order";

/**
 * "Watch it build" scrubber (plan L631, PR 10): drag or step through the build in the plan's own step
 * order and watch the parts turn from outline to wood. Read-only over buildOrder (the same order the
 * reveal and the step pictures use): no order is derived here, no part, price or plan is touched, and
 * the scale figure and props (#176) are not parts, so they are never in a beat or a count.
 */
export type ScrubBeat = { step: number; title: string };
export type ScrubTrack = { at: Map<string, number>; ids: string[]; beats: ScrubBeat[]; total: number };

export function scrubTrack(project: YardProject, plan: Pick<BuildPlan, "instructions" | "cutList"> | null | undefined): ScrubTrack | null {
  if (!plan?.instructions.length) return null;
  const { at, n, stale, steps } = buildOrder(project, plan);
  if (n < 2 || stale) return null;
  const ids = [...project.panels.map((p) => p.id), ...project.instances.map((i) => i.id)].filter((id) => at.has(id));
  const beats = steps.map((s) => ({ step: plan.instructions[s].step, title: plan.instructions[s].title }));
  return { at, ids, beats, total: plan.instructions.length };
}

/**
 * Parts in wood at scrub position k (1..beats: steps 1 to k are done). The last position is the whole
 * build and returns null, so it renders through the very same path as the default finished frame.
 */
export function scrubShown(track: ScrubTrack, k: number): Set<string> | null {
  if (k >= track.beats.length) return null;
  return new Set(track.ids.filter((id) => track.at.get(id)! < k));
}

/** The plan's own step numbers for position k: "Step 4 of 9" (the visible counter and the start of the label). */
export function scrubCounter(track: ScrubTrack, k: number): string {
  return `Step ${scrubBeat(track, k).step} of ${track.total}`;
}
/** What a screen reader hears for position k: "Step 4 of 9: Fit the shelves". */
export function scrubLabel(track: ScrubTrack, k: number): string {
  return `${scrubCounter(track, k)}: ${scrubBeat(track, k).title}`;
}
export function scrubBeat(track: ScrubTrack, k: number): ScrubBeat {
  return track.beats[Math.max(1, Math.min(track.beats.length, k)) - 1];
}

/** Play: one beat every 700 ms, the whole run held to about 8 s on a long build (never under 250 ms a beat). */
export function playGap(beats: number) {
  return Math.max(250, Math.min(700, 8000 / Math.max(1, beats)));
}

/** Shared state: the DOM scrubber writes it, the WebGL bench reads it (no React context crosses the Canvas). */
export type ScrubState = { open: boolean; k: number };
let state: ScrubState = { open: false, k: 0 };
const subs = new Set<() => void>();
export const scrubState = () => state;
export function setScrub(next: Partial<ScrubState>) {
  state = { ...state, ...next };
  subs.forEach((f) => f());
}
export function subscribeScrub(f: () => void) {
  subs.add(f);
  return () => void subs.delete(f);
}
