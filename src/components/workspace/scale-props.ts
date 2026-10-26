/**
 * Scale ghost and props (PR 14a, plan concept 8): a soft figure at true height beside the build and a few
 * everyday things on its shelves, so the size reads at a glance. Bench-only. Nothing here is a part:
 * props and the figure never reach the project, the Buy list, the part count, the cut list, the steps,
 * the price or any export. They draw on their own layer (PROP_LAYER), which the step photos leave out.
 * All sizes are real, in inches.
 */
import { useSyncExternalStore } from "react";
import type { Panel } from "@/lib/yard/types";

/** Scene layer for the figure and props: the bench camera sees it, step photos (StepCapture) do not. */
export const PROP_LAYER = 2;

export type Figure = "off" | "person" | "kid";
/** Plan concept 8: Person 5′9″, Kid 3′6″. Shoulder widths from adult and 6-year-old body data. */
export const FIGURES = {
  person: { height: 69, width: 18, label: "Person 5′9″", head: 1 / 7.5 },
  kid: { height: 42, width: 11.5, label: "Kid 3′6″", head: 1 / 5.8 },
} as const;
/** Clear space between the build and the figure, in inches. */
export const FIGURE_GAP = 10;

/** Real things, in inches: a folded bath towel (27 × 52 folded to 13 × 10), a hardcover, a coffee mug. */
export const PROP_SIZES = {
  towel: { w: 13, d: 10, h: 2.25 },
  book: { w: 1.25, d: 6.5, h: 9.5 },
  mug: { w: 3.25, d: 3.25, h: 3.75 },
} as const;
export type PropKind = keyof typeof PROP_SIZES;
/** One prop: its kind and box (x, z = centre; y = bottom), never a part id. */
export type PropSpot = { kind: PropKind; x: number; y: number; z: number; w: number; h: number; d: number; tone: number };

const MAX_PROPS = 120;

/** Where the props sit: on flat shelf and bottom tops, only where they fit under the part above. */
export function propSpots(panels: readonly Panel[], name: string): PropSpot[] {
  const towels = /linen|towel|bath/i.test(name);
  const out: PropSpot[] = [];
  const surfaces = panels.filter(
    (p) => (p.type === "shelf" || p.type === "bottom") && !p.yaw && !p.polygon && !p.outline && !p.form && p.size.height <= 1.5 && p.size.width >= 8 && p.size.depth >= 7,
  );
  let mugDone = false;
  surfaces.forEach((s, si) => {
    const top = s.position.y + s.size.height;
    const x0 = s.position.x, x1 = x0 + s.size.width, z0 = s.position.z;
    // Clearance: the lowest flat part above this top whose footprint overlaps it (none: an open top, 18").
    let clear = 18;
    for (const q of panels) {
      if (q === s || q.size.height > 1.5 || q.position.y < top - 0.01) continue;
      const overX = q.position.x < x1 && q.position.x + q.size.width > x0;
      const overZ = q.position.z < z0 + s.size.depth && q.position.z + q.size.depth > z0;
      if (overX && overZ) clear = Math.min(clear, q.position.y - top);
    }
    const add = (kind: PropKind, x: number, y: number, z: number, h: number, tone: number) => {
      const sz = PROP_SIZES[kind];
      if (out.length < MAX_PROPS) out.push({ kind, x, y, z, w: sz.w, h, d: sz.d, tone });
    };
    const zMid = z0 + s.size.depth / 2;
    if (towels) {
      const t = PROP_SIZES.towel;
      const n = Math.min(3, Math.floor((clear - 1) / t.h));
      const stacks = Math.min(3, Math.floor((s.size.width - 1) / (t.w + 1.5)));
      if (n < 1 || stacks < 1 || s.size.depth < t.d + 0.5) return;
      const pitch = s.size.width / stacks;
      for (let k = 0; k < stacks; k++) for (let j = 0; j < n; j++) add("towel", x0 + pitch * (k + 0.5), top + j * t.h, zMid, t.h, (si + k + j) % 3);
      return;
    }
    const b = PROP_SIZES.book;
    if (clear < b.h + 0.5 || s.size.depth < b.d + 0.5) return;
    // A row of up to 8 books against the left end, then a mug on the first shelf with room.
    const n = Math.min(8, Math.floor((s.size.width - 1) / b.w));
    for (let k = 0; k < n; k++) add("book", x0 + 0.5 + b.w * (k + 0.5), top, zMid, b.h - (k % 3) * 0.75, (si + k) % 5);
    const m = PROP_SIZES.mug;
    if (!mugDone && x0 + 0.5 + n * b.w + 2 + m.w < x1) {
      add("mug", x1 - 1 - m.w / 2, top, zMid + 0.5, m.h, 0);
      mugDone = true;
    }
  });
  return out;
}

/** The figure's box beside a build box (to the left, feet on the floor, 7" for its height ticks), for the camera fit. */
export function figureBox<B extends { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number }>(box: B, fig: Figure): B {
  if (fig === "off") return box;
  const f = FIGURES[fig];
  return { ...box, minX: box.minX - FIGURE_GAP - f.width - 7, minY: Math.min(box.minY, 0), maxY: Math.max(box.maxY, f.height + 4) };
}

/** On-device choice (localStorage), shared by the Options panel and the bench. Off by default. */
export type ScaleState = { figure: Figure; props: boolean };
const KEY = "yard.scale";
let state: ScaleState = { figure: "off", props: false };
let loaded = false;
const subs = new Set<() => void>();
function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const v = JSON.parse(window.localStorage.getItem(KEY) ?? "null") as Partial<ScaleState> | null;
    if (v && (v.figure === "off" || v.figure === "person" || v.figure === "kid")) state = { figure: v.figure, props: v.props === true };
  } catch {
    /* private mode: keep the default */
  }
}
export function scaleState(): ScaleState {
  load();
  return state;
}
export function setScale(next: Partial<ScaleState>) {
  state = { ...scaleState(), ...next };
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
  subs.forEach((f) => f());
}
const subscribe = (f: () => void) => (subs.add(f), () => void subs.delete(f));
const SERVER: ScaleState = { figure: "off", props: false };
export function useScale(): ScaleState {
  return useSyncExternalStore(subscribe, scaleState, () => SERVER);
}
