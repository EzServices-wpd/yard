/**
 * See inside: what a solve is keyed on, and which cards it is framed against (Critic #140 rows 353, 354).
 * - Row 353: a solve is framed against the overlay cards, so it must use where they SETTLE, never a passing layout
 *   (a card mid-slide, the phone's More tray still open at the tap) — else reduced and full motion land on
 *   different poses. A solve waits while a card (or a box around it) still moves, its key carries the cards to the
 *   pixel, and cards that settle somewhere else later make the shown solve stale (the driver re-solves). So the final pose depends only on the build, the viewport,
 *   the view and the settled cards, not on the motion that got there.
 * - Row 354: the build part of the key is the part list (count, ids, sizes, places), not just the project id, which
 *   delete and undo keep.
 * Framework-free (the driver feeds it; scripts/see-inside-settle.test.ts drives it with the real solver).
 */
import type { Rect } from "@/lib/yard/benchFrame";
import type { Panel } from "@/lib/yard/types";
import { closeJob, type StepJob } from "@/components/workspace/step-budget";
import type { ExplodeSolved } from "@/components/workspace/explode-state";

/** Row 354: project id + part count + a hash of every part's id, size, place and turn. */
export function buildKey(id: string, panels: readonly Panel[]): string {
  let h = 0x811c9dc5;
  const add = (s: string) => { for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } };
  for (const p of panels) add(`${p.id}:${p.size.width},${p.size.height},${p.size.depth}@${p.position.x},${p.position.y},${p.position.z}r${p.yaw ?? 0};`);
  return `${id}|${panels.length}p${(h >>> 0).toString(36)}`;
}

/** The cards a solve is framed against, to the pixel. */
export function cardsKey(rects: readonly Rect[]): string {
  return rects.map((r) => [r.left, r.top, r.right, r.bottom].map(Math.round).join(",")).join(";") || "none";
}

type Animated = { getAnimations(): { playState: string; effect: { getComputedTiming(): { endTime?: unknown } } | null }[] };
type Node = Animated & { parentElement: Node | null };
/**
 * A card, or a box it sits in, still sliding or fading (a running CSS animation, transition or Web Animation):
 * its rect is not where it will settle. Endless animations never settle and do not count.
 */
export function cardsMoving(cards: Iterable<Node>, host: Node | null): boolean {
  const seen = new Set<Node>();
  for (const c of cards) {
    for (let el: Node | null = c; el && !seen.has(el); el = el === host ? null : el.parentElement) {
      seen.add(el);
      for (const a of el.getAnimations()) {
        if (a.playState !== "running") continue;
        const end = Number(a.effect?.getComputedTiming().endTime ?? Infinity);
        if (Number.isFinite(end)) return true;
      }
    }
  }
  return false;
}

export type Cards = { rects: Rect[]; moving: boolean };
export type SolveJobK = StepJob<ExplodeSolved> & { key: string; overlays: Rect[] };
/** Solves kept (build + viewport + cards each make a key): the oldest is dropped past this. */
export const CACHE_MAX = 8;

/**
 * One rule for every caller (idle, tap, a card that settles later): the solve for this build + viewport and the
 * cards as they are now, or null while they still move (wait and ask again).
 */
/** Shared by every driver mount (the Canvas remounts on each rebuild). */
const solved = new Map<string, ExplodeSolved>();
export class SolveDesk {
  job: SolveJobK | null = null;
  constructor(public make: (key: string, overlays: Rect[]) => StepJob<ExplodeSolved>, private cache = solved) {}
  keyFor(base: string, c: Cards): string | null {
    return c.moving ? null : `${base}|${cardsKey(c.rects)}`;
  }
  start(base: string, c: Cards): SolveJobK | null {
    const key = this.keyFor(base, c);
    if (!key) return null;
    const j = this.job;
    // The same key, still alive: keep it. A cancelled one (closed before it finished) starts again.
    if (j && j.key === key && !(j.closed && !j.done)) return j;
    // Another build, size or set of cards: drop the old solve and free its meshes.
    if (j && !j.done) closeJob(j);
    const next: SolveJobK = Object.assign(this.make(key, c.rects), { key, overlays: c.rects });
    const hit = this.cache.get(key);
    if (hit) { next.done = hit; closeJob(next); }
    return (this.job = next);
  }
  /** A new run of the same solve (same key and cards), for one a time cap stopped early: never served from the cache. */
  fresh(j: SolveJobK): SolveJobK {
    if (this.job && this.job !== j && !this.job.done) closeJob(this.job);
    this.cache.delete(j.key);
    return (this.job = Object.assign(this.make(j.key, j.overlays), { key: j.key, overlays: j.overlays }));
  }
  /** The shown solve no longer matches the settled cards (or build, or size). */
  stale(shown: string | undefined, base: string, c: Cards): boolean {
    const key = this.keyFor(base, c);
    return !!key && key !== shown;
  }
  remember(k: string, s: ExplodeSolved) {
    this.cache.delete(k);
    this.cache.set(k, s);
    if (this.cache.size > CACHE_MAX) this.cache.delete([...this.cache.keys()][0]);
  }
  close() {
    const j = this.job;
    if (j && !j.done) closeJob(j);
    this.job = null;
  }
}
