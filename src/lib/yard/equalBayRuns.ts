/**
 * Clear bays of one auto-divided shelf run: shelf pieces on one level, in one depth,
 * joined face to face by center dividers. A run of three or more is the span pass
 * splitting one opening. Builder bays ("Bay divider") stay their own runs.
 */
import type { Panel } from "./types";

const Y_BAND = 1 / 32;
const FACE = 0.02;

export type BayRun = { shelves: Panel[]; dividers: Panel[] };

function overlapsZ(a: Panel, b: Panel): boolean {
  const oz = Math.min(a.position.z + a.size.depth, b.position.z + b.size.depth) - Math.max(a.position.z, b.position.z);
  return oz > 0.5;
}

function centerBetween(panels: Panel[], prev: Panel, next: Panel): Panel | null {
  const gapL = prev.position.x + prev.size.width;
  const gapR = next.position.x;
  if (gapR - gapL < -FACE) return null;
  const y0 = Math.max(prev.position.y, next.position.y);
  const y1 = y0 + Math.min(prev.size.height, next.size.height);
  return (
    panels.find((d) => {
      if (!/^Center divider\b/.test(d.name)) return false;
      if (Math.abs(d.position.x - gapL) > FACE) return false;
      if (Math.abs(d.position.x + d.size.width - gapR) > FACE) return false;
      const oy = Math.min(d.position.y + d.size.height, y1) - Math.max(d.position.y, y0);
      return oy > -0.2;
    }) ?? null
  );
}

/** Auto-divided runs with at least `minBays` clear openings. */
export function equalBayRuns(panels: Panel[], minBays = 3): BayRun[] {
  const shelves = panels.filter((s) => s.type === "shelf" && !s.outline);
  const unused = [...shelves];
  const groups: Panel[][] = [];
  while (unused.length) {
    const seed = unused.pop()!;
    const group = [seed];
    let grew = true;
    while (grew) {
      grew = false;
      for (let i = unused.length - 1; i >= 0; i--) {
        const shelf = unused[i];
        if (group.some((m) => Math.abs(m.position.y - shelf.position.y) < Y_BAND && overlapsZ(m, shelf))) {
          group.push(shelf);
          unused.splice(i, 1);
          grew = true;
        }
      }
    }
    groups.push(group);
  }
  const runs: BayRun[] = [];
  for (const group of groups) {
    const line = [...group].sort((a, b) => a.position.x - b.position.x || a.position.z - b.position.z);
    let shelvesIn: Panel[] = [];
    let dividers: Panel[] = [];
    const flush = () => {
      if (shelvesIn.length >= minBays) runs.push({ shelves: shelvesIn, dividers });
      shelvesIn = [];
      dividers = [];
    };
    for (const shelf of line) {
      if (!shelvesIn.length) {
        shelvesIn = [shelf];
        continue;
      }
      const div = centerBetween(panels, shelvesIn[shelvesIn.length - 1], shelf);
      if (!div) {
        flush();
        shelvesIn = [shelf];
        continue;
      }
      shelvesIn.push(shelf);
      dividers.push(div);
    }
    flush();
  }
  return runs;
}

/** The support face (upright or divider) that this shelf edge sits on. */
function sitsOnSide(panels: Panel[], shelf: Panel, x: number, side: "left" | "right"): boolean {
  return panels.some((p) => {
    if (p.type !== "upright" && p.type !== "divider") return false;
    const face = side === "left" ? p.position.x + p.size.width : p.position.x;
    if (Math.abs(face - x) > 1e-4) return false;
    const oy = Math.min(p.position.y + p.size.height, shelf.position.y + shelf.size.height) - Math.max(p.position.y, shelf.position.y);
    return oy > -0.2;
  });
}

/**
 * Problems with an auto-divided run of 3+ clear bays.
 * Clear widths match within 1/64", and the bays plus the dividers between them
 * fill the run between the sides.
 */
export function equalBayProblems(panels: Panel[]): string[] {
  const bad: string[] = [];
  for (const run of equalBayRuns(panels, 3)) {
    const widths = run.shelves.map((s) => s.size.width);
    const spread = Math.max(...widths) - Math.min(...widths);
    const y = run.shelves[0].position.y;
    if (spread > 1 / 64 + 1e-9) bad.push(`y=${y}: clear bays differ by ${spread.toFixed(4)}" (${widths.map((w) => w.toFixed(4)).join(", ")})`);
    const x0 = run.shelves[0].position.x;
    const last = run.shelves[run.shelves.length - 1];
    const x1 = last.position.x + last.size.width;
    const filled = widths.reduce((a, w) => a + w, 0) + run.dividers.reduce((a, d) => a + d.size.width, 0);
    if (Math.abs(filled - (x1 - x0)) > 1e-6) bad.push(`y=${y}: bays + dividers ${filled.toFixed(4)} do not fill ${ (x1 - x0).toFixed(4) }`);
    if (!sitsOnSide(panels, run.shelves[0], x0, "left") || !sitsOnSide(panels, last, x1, "right")) {
      bad.push(`y=${y}: the run does not meet the sides (${x0.toFixed(4)} .. ${x1.toFixed(4)})`);
    }
  }
  return bad;
}
