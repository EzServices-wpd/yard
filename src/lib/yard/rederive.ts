import type { Panel } from "./types";
import { getCatalogItem } from "./catalog";

/**
 * Rows 705/706: a stock switch re-derives parts from the joints, never from the ¾" layout. Two parts are joined on
 * axis k when one's end meets the other's start face to face (they overlap on the other two axes). After the faces
 * thin, every joint meets again: the part that can grow on that axis (a shelf, back, rod or rail along its length)
 * follows the wall's new face; a part's own thickness never stretches, so two walls that meet end to end close up by
 * moving the one that is not an outer face of the build.
 */
const AX = [["x", "width"], ["y", "height"], ["z", "depth"]] as const;
const EPS = 0.005;
const GAP = 1 / 16; // a typed fraction rounds a cut to 1/16": a part that close to a face is joined to it
const boxy = (p: Panel) => !p.yaw && !p.polygon && !p.strut && !p.form && !p.outline && !p.blank;
const lo = (p: Panel, k: number) => p.position[AX[k][0]];
const hi = (p: Panel, k: number) => p.position[AX[k][0]] + p.size[AX[k][1]];
const over = (p: Panel, q: Panel, k: number) => Math.min(hi(p, k), hi(q, k)) - Math.max(lo(p, k), lo(q, k));

/** [i, j, k, g]: panel i's far face on axis k meets panel j's near face, g apart (0, or a fraction's 1/16" or less). */
export function jointsOf(panels: Panel[]): [number, number, number, number][] {
  const out: [number, number, number, number][] = [];
  for (let i = 0; i < panels.length; i++) for (let j = 0; j < panels.length; j++) {
    if (i === j || !boxy(panels[i]) || !boxy(panels[j])) continue;
    for (let k = 0; k < 3; k++) {
      const g = lo(panels[j], k) - hi(panels[i], k);
      if (g > -EPS && g < GAP + EPS && [0, 1, 2].every((o) => o === k || over(panels[i], panels[j], o) > 0.05)) out.push([i, j, k, Math.max(0, g)]);
    }
  }
  return out;
}

/** Joints of `was` that no longer meet in `now` (same panel list), with the gap (+) or overlap (−) in inches. */
export function openJoints(was: Panel[], now: Panel[], tol = 1 / 16): { a: string; b: string; axis: string; gap: number }[] {
  return jointsOf(was)
    .filter(([i, j]) => boxy(now[i]) && boxy(now[j]))
    .map(([i, j, k, g]) => ({ a: now[i].name, b: now[j].name, axis: "xyz"[k], gap: lo(now[j], k) - hi(now[i], k) - g }))
    .filter((x) => Math.abs(x.gap) > tol + 1e-9);
}

/** `now` is `was` with some faces thinned in place: move and grow parts until every joint of `was` meets again. */
export function meetAgain(was: Panel[], now: Panel[]): Panel[] {
  const J = jointsOf(was);
  if (!J.length) return now;
  const P = now.map((p) => ({ ...p, position: { ...p.position }, size: { ...p.size } }));
  // A sheet part grows along any cut edge, never through its stock thickness (1 1/2" or less); a board, stick or rod
  // only along its length. A drawer envelope (a block, not a sheet) grows like the sheet its box is cut from.
  const grows = (p: Panel, k: number) => {
    const s = [p.size.width, p.size.height, p.size.depth];
    const it = getCatalogItem(p.materialId);
    return !(s[k] === Math.min(...s) && s[k] <= 1.6) && (it?.category === "sheet_goods" || it?.formFactor === "sheet" || s[k] === Math.max(...s));
  };
  const env = [0, 1, 2].map((k) => [Math.min(...was.map((p) => lo(p, k))), Math.max(...was.map((p) => hi(p, k)))]);
  const outer = (i: number, k: number) => Math.abs(lo(was[i], k) - env[k][0]) < EPS || Math.abs(hi(was[i], k) - env[k][1]) < EPS;
  const setLo = (p: Panel, k: number, v: number) => { p.size[AX[k][1]] = hi(p, k) - v; p.position[AX[k][0]] = v; };
  const setHi = (p: Panel, k: number, v: number) => { p.size[AX[k][1]] = v - lo(p, k); };
  const shift = (p: Panel, k: number, d: number) => { p.position[AX[k][0]] += d; };
  const pinned = new Set<string>();
  for (let pass = 0; pass < 4; pass++) {
    let moved = false;
    for (const [i, j, k, g] of J) {
      const a = hi(P[i], k) + g, b = lo(P[j], k) - g;
      if (Math.abs(b + g - a) < EPS) continue;
      const jl = `${j}:${k}:lo`, ih = `${i}:${k}:hi`;
      // a = where j's near face belongs, b = where i's far face belongs (the 3/4" gap g kept).
      if (grows(P[j], k) && !pinned.has(jl) && hi(P[j], k) - a > 1) { setLo(P[j], k, a); pinned.add(jl); }
      else if (grows(P[i], k) && !pinned.has(ih) && b - lo(P[i], k) > 1) { setHi(P[i], k, b); pinned.add(ih); }
      else if (!grows(P[j], k) && !outer(j, k) && !pinned.has(jl)) { shift(P[j], k, a - lo(P[j], k)); pinned.add(jl); pinned.add(`${j}:${k}:hi`); }
      else if (!grows(P[i], k) && !outer(i, k) && !pinned.has(ih)) { shift(P[i], k, b - hi(P[i], k)); pinned.add(ih); pinned.add(`${i}:${k}:lo`); }
      else continue;
      moved = true;
    }
    if (!moved) break;
  }
  return P;
}
