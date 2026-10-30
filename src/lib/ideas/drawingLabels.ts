/**
 * Dimension labels that stay readable on a card. A drawing is baked at 480 × 360 with 9-unit labels (the plan
 * overview's PDF size), so a 220px card drew them about 4px tall. The SVG's own stylesheet now sizes the labels from
 * the width the image is drawn at (an SVG image's media queries see its own box), so a label renders 12px or more
 * from 200px up, with a paper halo where it crosses a line (the halo replaces the baked white box behind each label,
 * which is sized for 9-unit text, so the sheet hides those boxes). A label whose box would leave the drawing at the
 * largest size is pinned at its outer end (text-anchor end/start at the 9-unit edge, so at 9 units it sits where it was
 * baked and grows inward); a bottom label moves up just enough. Text is untouched (drawnDims and the size tests read the
 * same labels). Below 120px (the home chips) the labels are hidden and the white boxes stay, as before this sheet.
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

/** A label's box at `fs` units for its text-anchor: [left, top, right, bottom] in drawing units. */
export function labelBox(x: number, y: number, text: string, fs: number, anchor = "middle"): [number, number, number, number] {
  const w = plain(text).length * ADVANCE * fs;
  const l = anchor === "start" ? x : anchor === "end" ? x - w : x - w / 2;
  return [l, y - 0.75 * fs, l + w, y + 0.25 * fs];
}

/** The label's spot and anchor: an edge label is pinned at its outer end so it never clips at the largest size. */
function labelSpot(x: number, y: number, text: string): [number, number, string] {
  const [h9, hm] = [plain(text).length * ADVANCE * 4.5, (plain(text).length * ADVANCE * MAX_UNITS) / 2];
  let [cx, a] = [x, "middle"];
  if (x + hm > DRAW_W - PAD) [cx, a] = [x + h9, "end"];
  else if (x - hm < PAD) [cx, a] = [x - h9, "start"];
  const cy = Math.min(Math.max(y, PAD + 0.75 * MAX_UNITS), DRAW_H - PAD - 0.25 * MAX_UNITS);
  return [r1(cx), r1(cy), a];
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

/** Idempotent: a drawing with no labels, or already sized, comes back as it was. */
export function cardLabels(svg: string): string {
  if (!svg.includes("<text") || svg.includes("svg{--l:")) return svg;
  const out = svg.replace(/<text x="([\d.]+)" y="([\d.]+)" text-anchor="middle"/g, (m, x, y, at: number) => {
    const t = svg.slice(svg.indexOf(">", at) + 1, svg.indexOf("</text>", at));
    const [cx, cy, a] = labelSpot(Number(x), Number(y), t);
    return `<text x="${cx}" y="${cy}" text-anchor="${a}"`;
  });
  return out.includes("<style>") ? out.replace("<style>", `<style>${CSS}`) : out.replace(/(<svg[^>]*>)/, `$1<style>${CSS}</style>`);
}
