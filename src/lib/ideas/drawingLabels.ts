/**
 * Dimension labels that stay readable on a card. A drawing is baked at 480 × 360 with 9-unit labels (the plan
 * overview's PDF size), so a 220px card drew them about 4px tall. The SVG's own stylesheet sizes the labels from the
 * width the image is drawn at (an SVG image's media queries see its own box), so a label renders 12px or more from
 * 200px up, with a paper halo. The baked white box behind each label (sized for 9-unit text) is hidden on cards, and
 * below 120px (the home chips) the labels are hidden and the white boxes stay, as before this sheet.
 *
 * A bigger label no longer fits on its dimension line, so `placeLabel` moves it beside the line, from the drawing's
 * own geometry: the label's box (an offset in em from a point on the line, so it scales with the font) must clear its
 * own line and ticks, every part, the other labels (and if it can, the other dimension lines) and the drawing's edge
 * at every size the sheet uses, stay within 1em of its line and nearer its middle than any other line's. The side
 * away from the model is tried first, then along the line (rotated), then past an end. Text is untouched (drawnDims
 * reads the same labels).
 */
export const DRAW_W = 480;
export const DRAW_H = 360;
/** [widest drawn width in CSS px, label font in drawing units]; above the last band the baked 9 stands. */
export const LABEL_BANDS: ReadonlyArray<readonly [number, number]> = [[640, 11], [560, 12], [480, 15], [400, 18], [330, 21], [280, 24], [240, 29], [200, 30]];
/** Every label size the sheet can draw, in drawing units. */
export const LABEL_SIZES = [9, ...LABEL_BANDS.map(([, u]) => u)];
export const plain = (t: string) => t.replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
/** Label width in em: the widest of Helvetica/Arial Bold and Roboto Bold (Android's fallback) per glyph, rounded up. */
const ADVANCE: Record<string, number> = { " ": 0.3, "/": 0.42, '"': 0.5, "'": 0.3, a: 0.58, d: 0.63, i: 0.3 };
export const labelEm = (text: string) => [...plain(text)].reduce((w, ch) => w + (ADVANCE[ch] ?? 0.58), 0);
/** The halo (stroke .25em) reaches .125em past the glyphs on every side. */
export const HALO = 0.125;
const PAD = 1;

export function labelUnits(drawnWidth: number): number {
  let fs = 9;
  for (const [max, u] of LABEL_BANDS) if (drawnWidth <= max) fs = u;
  return fs;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

type P = [number, number];
type Seg = [P, P];
/** A label's place: point (x, y) on its line, text centre offset (dx) and baseline offset (dy) in em, rotation in degrees. */
export type Spot = { x: number; y: number; dx: number; dy: number; rot: number };
/** Label ink from the baseline in em: figures, quotes, slash and "dia" rise .75em at most and drop under .05em. */
export const [ASCENT, DESCENT] = [0.75, 0.05];

/** The four corners of a label's box at `fs` units, with its halo unless `halo` is 0. */
export function spotBox(s: Spot, text: string, fs: number, halo = HALO): P[] {
  const hw = labelEm(text) / 2 + halo;
  const [c, n] = [Math.cos((s.rot * Math.PI) / 180), Math.sin((s.rot * Math.PI) / 180)];
  return ([[-hw, -ASCENT - halo], [hw, -ASCENT - halo], [hw, DESCENT + halo], [-hw, DESCENT + halo]] as P[]).map(([u, v]) => {
    const [a, b] = [(s.dx + u) * fs, (s.dy + v) * fs];
    return [s.x + a * c - b * n, s.y + a * n + b * c];
  });
}

const cross = (o: P, a: P, b: P) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
function segsMeet([a, b]: Seg, [c, d]: Seg): boolean {
  const [d1, d2, d3, d4] = [cross(c, d, a), cross(c, d, b), cross(a, b, c), cross(a, b, d)];
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) return true;
  const on = (p: P, q: P, r: P) => Math.min(p[0], q[0]) <= r[0] && r[0] <= Math.max(p[0], q[0]) && Math.min(p[1], q[1]) <= r[1] && r[1] <= Math.max(p[1], q[1]);
  return (d1 === 0 && on(c, d, a)) || (d2 === 0 && on(c, d, b)) || (d3 === 0 && on(a, b, c)) || (d4 === 0 && on(a, b, d));
}
function inside(p: P, poly: P[]): boolean {
  let k = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [a, b] = [poly[i], poly[j]];
    if (a[1] > p[1] !== b[1] > p[1] && p[0] < ((b[0] - a[0]) * (p[1] - a[1])) / (b[1] - a[1]) + a[0]) k = !k;
  }
  return k;
}
const edges = (poly: P[], closed = true): Seg[] => poly.slice(0, closed ? poly.length : -1).map((p, i) => [p, poly[(i + 1) % poly.length]]);
const segDist = (p: P, [a, b]: Seg) => {
  const [vx, vy] = [b[0] - a[0], b[1] - a[1]];
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * vx + (p[1] - a[1]) * vy) / (vx * vx + vy * vy || 1)));
  return Math.hypot(p[0] - a[0] - t * vx, p[1] - a[1] - t * vy);
};
/** Gap between a box and a segment (0 when they meet). */
export const boxGap = (box: P[], l: Seg) =>
  boxMeets(box, l, false) ? 0 : Math.min(...box.map((p) => segDist(p, l)), ...edges(box).flatMap((e) => [segDist(l[0], e), segDist(l[1], e)]));

/** Does a label box touch a polygon (closed) or a polyline (open)? */
export function boxMeets(box: P[], shape: P[], closed = true): boolean {
  const be = edges(box);
  if (edges(shape, closed).some((e) => be.some((f) => segsMeet(e, f)))) return true;
  return inside(shape[0], box) || (closed && shape.length > 2 && inside(box[0], shape));
}

/** A drawing's geometry: part outlines (paths, other strokes) and each label's dimension (line, then its two ticks). */
export function drawingGeometry(svg: string) {
  const parts: { pts: P[]; closed: boolean }[] = [];
  const dims: { text: string; at: number; lines: Seg[] }[] = [];
  let lines: Seg[] = [];
  const num = (a: string, k: string) => Number(a.match(new RegExp(`\\b${k}="(-?[\\d.]+)"`))?.[1] ?? NaN);
  for (const m of svg.matchAll(/<(path|line|ellipse|rect|text)\b([^>]*)>/g)) {
    const [tag, a] = [m[1], m[2]];
    if (tag === "line") lines.push([[num(a, "x1"), num(a, "y1")], [num(a, "x2"), num(a, "y2")]]);
    else if (tag === "text") {
      const at = m.index!;
      dims.push({ text: svg.slice(at + m[0].length, svg.indexOf("</text>", at)), at, lines: lines.slice(-3) });
      lines = lines.slice(0, -3);
    } else if (tag === "rect") continue;
    else {
      parts.push(...lines.map(([p, q]) => ({ pts: [p, q], closed: false })));
      lines = [];
      if (tag === "ellipse") {
        const [cx, cy, rx, ry] = ["cx", "cy", "rx", "ry"].map((k) => num(a, k));
        parts.push({ pts: [[cx - rx, cy - ry], [cx + rx, cy - ry], [cx + rx, cy + ry], [cx - rx, cy + ry]], closed: true });
      } else for (const sub of (a.match(/\bd="([^"]*)"/)?.[1] ?? "").split(/(?=M)/)) {
        const n = (sub.replace(/A\s*[-\d.]+\s+[-\d.]+\s+[-\d.]+\s+[01]\s+[01]/g, "L").match(/-?[\d.]+/g) ?? []).map(Number);
        const pts: P[] = [];
        for (let i = 0; i + 1 < n.length; i += 2) pts.push([n[i], n[i + 1]]);
        if (pts.length > 1) parts.push({ pts, closed: /Z/i.test(sub) && pts.length > 2 });
      }
    }
  }
  parts.push(...lines.map(([p, q]) => ({ pts: [p, q], closed: false })));
  return { parts, dims };
}

/** Is a label at `s` clear of everything at every size? `strict` also keeps it off the other dimension lines. */
function clear(s: Spot, text: string, own: Seg[], geo: ReturnType<typeof drawingGeometry>, placed: [Spot, string][], strict: boolean): boolean {
  return LABEL_SIZES.every((fs) => {
    const b = spotBox(s, text, fs);
    if (spotBox(s, text, fs, 0).some(([x, y]) => x < PAD || y < PAD || x > DRAW_W - PAD || y > DRAW_H - PAD)) return false;
    // It reads as its own line's label: within 1em of that line, and nearer its middle than any other line's middle.
    const [mid, half] = [(q: P[]): P => [(q[0][0] + q[2][0]) / 2, (q[0][1] + q[2][1]) / 2], ([p, q]: Seg): P => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]];
    const far = (l: Seg) => Math.hypot(mid(b)[0] - half(l)[0], mid(b)[1] - half(l)[1]);
    if (boxGap(b, own[0]) > fs || geo.dims.some((d) => d.lines !== own && d.lines.length && far(d.lines[0]) <= far(own[0]))) return false;
    const [l, t, r, d] = [Math.min(...b.map((p) => p[0])), Math.min(...b.map((p) => p[1])), Math.max(...b.map((p) => p[0])), Math.max(...b.map((p) => p[1]))];
    const near = (pts: P[]) => !pts.every((p) => p[0] < l) && !pts.every((p) => p[0] > r) && !pts.every((p) => p[1] < t) && !pts.every((p) => p[1] > d);
    if (own.some((q) => boxMeets(b, q, false)) || geo.parts.some((p) => near(p.pts) && boxMeets(b, p.pts, p.closed))) return false;
    if (strict && geo.dims.some((d) => d.lines !== own && d.lines.some((l) => boxMeets(b, l, false)))) return false;
    return placed.every(([q, t]) => !boxMeets(b, spotBox(q, t, fs)));
  });
}

/** Where a label goes (null: nowhere clear, so it stays baked). */
export function placeLabel(own: Seg[], text: string, geo: ReturnType<typeof drawingGeometry>, placed: [Spot, string][]): Spot | null {
  const [[a, b]] = own;
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  const [ux, uy] = [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
  const all = geo.parts.flatMap((p) => p.pts);
  const [mx, my] = [all.reduce((s, p) => s + p[0], 0) / (all.length || 1), all.reduce((s, p) => s + p[1], 0) / (all.length || 1)];
  const away = (-uy * (mx - (a[0] + b[0]) / 2) + ux * (my - (a[1] + b[1]) / 2)) > 0 ? -1 : 1;
  let deg = (Math.atan2(uy, ux) * 180) / Math.PI;
  if (deg >= 90) deg -= 180; // reads left to right, or bottom to top
  if (deg < -90) deg += 180;
  const [hw, hh] = [labelEm(text) / 2 + HALO, (ASCENT + DESCENT) / 2 + HALO];
  const rots = Math.abs(deg) < 1 ? [0] : [0, r2(deg)];
  // First choice: touching the line's middle stretch from outside (the box's near side .15em or more off the line).
  const near: Spot[] = [];
  for (const side of [away, -away]) for (const rot of rots) for (const t of [0.5, 0.4, 0.6, 0.3, 0.7, 0.2, 0.8]) for (const g of [0.15, 0.5, 1]) {
    const [nx, ny] = [-uy * side, ux * side];
    const [c, n] = [Math.cos((rot * Math.PI) / 180), Math.sin((rot * Math.PI) / 180)];
    const [sx, sy] = [nx * c + ny * n, -nx * n + ny * c]; // the normal in the text's frame
    const k = g + hw * Math.abs(sx) + hh * Math.abs(sy) + 0.01;
    near.push({ x: r2(a[0] + (b[0] - a[0]) * t), y: r2(a[1] + (b[1] - a[1]) * t), dx: r2(sx * k), dy: r2(sy * k + (ASCENT - DESCENT) / 2), rot });
  }
  // Else the nearest clear spot around the line or past either end, by distance from the line's middle at 21 units.
  const far: [number, Spot][] = [];
  for (const rot of rots) for (const t of [0.5, 0, 1]) for (let dx = -6; dx <= 6; dx += 0.25) for (let dy = -2; dy <= 3; dy += 0.25) {
    const s: Spot = { x: r2(a[0] + (b[0] - a[0]) * t), y: r2(a[1] + (b[1] - a[1]) * t), dx, dy, rot };
    const q = spotBox(s, text, 21), [ox, oy] = [(q[0][0] + q[2][0]) / 2 - (a[0] + b[0]) / 2, (q[0][1] + q[2][1]) / 2 - (a[1] + b[1]) / 2];
    far.push([Math.hypot(ox, oy) + Math.abs(ox * uy - oy * ux) + (rot ? 20 : 0), s]);
  }
  far.sort((p, q) => p[0] - q[0]);
  // Outside first: the whole box on the far side of the line from the model (its infinite line, so past an end counts).
  const out = (s: Spot) => spotBox(s, text, 21).every((p) => (-uy * (p[0] - a[0]) + ux * (p[1] - a[1])) * away > 0);
  const order = [...near, ...far.map(([, s]) => s)];
  for (const strict of [true, false]) for (const s of [...order.filter(out), ...order.filter((s) => !out(s))]) if (clear(s, text, own, geo, placed, strict)) return s;
  return null;
}

/** The baked white box behind every label (the base drawings put one right before each <text>). */
export const WHITE_BOX = 'rect[fill="rgb(255,255,255)"]';
/** At or below this drawn width (the home chips, 36px) labels can't be read, so they are hidden. */
export const CHIP_MAX = 120;

const CSS =
  "svg{--l:9px}" +
  LABEL_BANDS.map(([max, u]) => `@media(max-width:${max}px){svg{--l:${u}px}}`).join("") +
  "text{font-size:var(--l);paint-order:stroke;stroke:rgb(247,244,238);stroke-width:.25em;stroke-linejoin:round}" +
  `@media(min-width:${CHIP_MAX + 1}px){${WHITE_BOX}{display:none}}@media(max-width:${CHIP_MAX}px){text{display:none}}`;

/** A spot as text attributes: anchored (middle) at its point, moved by dx/dy in em so it scales with the label. */
const attrs = (s: Spot) => `x="${s.x}" y="${s.y}" text-anchor="middle" dx="${s.dx}em" dy="${s.dy}em"${s.rot ? ` transform="rotate(${s.rot} ${s.x} ${s.y})"` : ""}`;

/** Idempotent: a drawing with no labels, or already sized, comes back as it was. A label with no clear spot stays baked. */
export function cardLabels(svg: string): string {
  if (!svg.includes("<text") || svg.includes("svg{--l:")) return svg;
  const geo = drawingGeometry(svg);
  const placed: [Spot, string][] = [];
  const spots = new Map<number, Spot>();
  for (const d of geo.dims) {
    const s = d.lines.length === 3 ? placeLabel(d.lines, d.text, geo, placed) : null;
    if (s) placed.push([s, d.text]), spots.set(d.at, s);
  }
  const out = svg.replace(/<text x="[\d.]+" y="[\d.]+" text-anchor="middle"/g, (m, at: number) => (spots.has(at) ? `<text ${attrs(spots.get(at)!)}` : m));
  return out.includes("<style>") ? out.replace("<style>", `<style>${CSS}`) : out.replace(/(<svg[^>]*>)/, `$1<style>${CSS}</style>`);
}
