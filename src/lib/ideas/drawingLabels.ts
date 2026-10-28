/**
 * Dimension labels that stay readable on a card. A drawing is baked at 480 × 360 with 9-unit labels (the plan
 * overview's PDF size), so a 220px card drew them about 4px tall. The SVG's own stylesheet now sizes the labels from
 * the width the image is drawn at (an SVG image's media queries see its own box), so a label renders 12px or more
 * from 200px up, with a paper halo where it crosses a line. A label near the edge moves in just enough that it never clips.
 * Text and positions are untouched (drawnDims and the size tests still read the same labels).
 */
export const DRAW_W = 480;
export const DRAW_H = 360;
/** [widest drawn width in CSS px, label font in drawing units]; above the last band the baked 9 stands. */
export const LABEL_BANDS: ReadonlyArray<readonly [number, number]> = [[640, 11], [560, 12], [480, 15], [400, 18], [330, 21], [280, 24], [240, 29], [200, 30]];
/** Helvetica Bold advance is 0.556em for figures, less for quote, slash and space: 0.6 is the safe width per glyph. */
const ADVANCE = 0.6;
const PAD = 3;

export function labelUnits(drawnWidth: number): number {
  let fs = 9;
  for (const [max, u] of LABEL_BANDS) if (drawnWidth <= max) fs = u;
  return fs;
}

const plain = (t: string) => t.replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
export const MAX_UNITS = Math.max(...LABEL_BANDS.map(([, u]) => u));
const r1 = (n: number) => Math.round(n * 10) / 10;

/** A middle-anchored label's box at `fs` units: [left, top, right, bottom] in drawing units. */
export function labelBox(x: number, y: number, text: string, fs: number): [number, number, number, number] {
  const half = (plain(text).length * ADVANCE * fs) / 2;
  return [x - half, y - 0.75 * fs, x + half, y + 0.25 * fs];
}

/** The label's spot moved in just enough that it stays inside the drawing at the largest card size. */
function labelSpot(x: number, y: number, text: string): [number, number] {
  const half = (plain(text).length * ADVANCE * MAX_UNITS) / 2;
  const cx = Math.min(Math.max(x, PAD + half), DRAW_W - PAD - half);
  const cy = Math.min(Math.max(y, PAD + 0.75 * MAX_UNITS), DRAW_H - PAD - 0.25 * MAX_UNITS);
  return [r1(cx), r1(cy)];
}

const CSS =
  "svg{--l:9px}" +
  LABEL_BANDS.map(([max, u]) => `@media(max-width:${max}px){svg{--l:${u}px}}`).join("") +
  "text{font-size:var(--l);paint-order:stroke;stroke:rgb(247,244,238);stroke-width:.25em;stroke-linejoin:round}";

/** Idempotent: a drawing with no labels, or already sized, comes back as it was. */
export function cardLabels(svg: string): string {
  if (!svg.includes("<text") || svg.includes("svg{--l:")) return svg;
  const out = svg.replace(/<text x="([\d.]+)" y="([\d.]+)"/g, (m, x, y, at: number) => {
    const t = svg.slice(svg.indexOf(">", at) + 1, svg.indexOf("</text>", at));
    const [cx, cy] = labelSpot(Number(x), Number(y), t);
    return `<text x="${cx}" y="${cy}"`;
  });
  return out.includes("<style>") ? out.replace("<style>", `<style>${CSS}`) : out.replace(/(<svg[^>]*>)/, `$1<style>${CSS}</style>`);
}
