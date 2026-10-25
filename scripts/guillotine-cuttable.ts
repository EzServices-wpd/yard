/**
 * Guillotine check for a sheet layout: can every piece be freed with straight, edge-to-edge saw cuts
 * (table saw or circular saw along a straightedge)? Read-only; it never changes a nest.
 *
 * A region is cuttable when it holds 0 or 1 pieces, or a full-length vertical or horizontal line
 * crosses no piece and both sides are cuttable. With `kerf` > 0 the line must also sit in a gap at
 * least one kerf wide (nesting.ts models a 1/8" kerf between parts, BLADE_KERF), so the blade
 * never eats into a piece. A piece touching the region edge needs no kerf there (factory edge).
 */
export type Rect = { x: number; y: number; width: number; height: number; id?: string; name?: string; label?: string };
export type GuillotineResult =
  | { ok: true; cuts: number }
  | { ok: false; reason: "overlap" | "off-sheet" | "no-through-cut"; region: { x0: number; y0: number; x1: number; y1: number }; pieces: Rect[] };

const EPS = 1e-6;

/** Pieces overlap or leave the sheet: report that before any cut search. */
function sanity(parts: Rect[], W: number, H: number): GuillotineResult | null {
  for (const p of parts)
    if (p.x < -EPS || p.y < -EPS || p.x + p.width > W + EPS || p.y + p.height > H + EPS)
      return { ok: false, reason: "off-sheet", region: { x0: 0, y0: 0, x1: W, y1: H }, pieces: [p] };
  for (let i = 0; i < parts.length; i++)
    for (let j = i + 1; j < parts.length; j++) {
      const a = parts[i], b = parts[j];
      if (a.x < b.x + b.width - EPS && b.x < a.x + a.width - EPS && a.y < b.y + b.height - EPS && b.y < a.y + a.height - EPS)
        return { ok: false, reason: "overlap", region: { x0: 0, y0: 0, x1: W, y1: H }, pieces: [a, b] };
    }
  return null;
}

/** One through-cut along an axis: pieces split into the near and far side with a gap ≥ kerf. */
function splitOn(parts: Rect[], axis: "x" | "y", kerf: number): [Rect[], Rect[]] | null {
  const lo = (p: Rect) => (axis === "x" ? p.x : p.y);
  const hi = (p: Rect) => (axis === "x" ? p.x + p.width : p.y + p.height);
  const sorted = [...parts].sort((a, b) => lo(a) - lo(b));
  let reach = -Infinity;
  for (let i = 0; i < sorted.length - 1; i++) {
    reach = Math.max(reach, hi(sorted[i]));
    // Every piece after i starts at or beyond `reach + kerf`: a line in that gap crosses nothing.
    if (lo(sorted[i + 1]) >= reach + kerf - EPS) return [sorted.slice(0, i + 1), sorted.slice(i + 1)];
  }
  return null;
}

export function guillotineCuttable(parts: Rect[], sheet: { width: number; height: number }, kerf = 0): GuillotineResult {
  const bad = sanity(parts, sheet.width, sheet.height);
  if (bad) return bad;
  let cuts = 0;
  const walk = (ps: Rect[]): GuillotineResult => {
    if (ps.length <= 1) return { ok: true, cuts: 0 };
    for (const axis of ["x", "y"] as const) {
      const s = splitOn(ps, axis, kerf);
      if (!s) continue;
      cuts++;
      for (const side of s) { const r = walk(side); if (!r.ok) return r; }
      return { ok: true, cuts };
    }
    const x0 = Math.min(...ps.map((p) => p.x)), y0 = Math.min(...ps.map((p) => p.y));
    const x1 = Math.max(...ps.map((p) => p.x + p.width)), y1 = Math.max(...ps.map((p) => p.y + p.height));
    return { ok: false, reason: "no-through-cut", region: { x0, y0, x1, y1 }, pieces: ps };
  };
  const r = walk(parts);
  return r.ok ? { ok: true, cuts } : r;
}
