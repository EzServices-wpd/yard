/**
 * One size for a build (header, cover, card, idea log): typed axes are the size said back; an assumed axis is the
 * model's own extent, so the header prints the same 1/16 the drawings label. Light (no jsPDF), so the server log
 * reads it too.
 */
import { modelFinishedDepth, modelProudNote, stampFinishedDepth } from "./modelSize";
import { clean, frac } from "./pdfKit";
import { drawnExtent } from "./pdfDraw";
import { isUnitItem } from "./unitItems";
import { specOf, type YardSpec } from "./spec";
import { isBedLongWide, typedOffBy } from "./typedAxesRead";
import type { YardProject } from "./types";

/** The unit the plan talks about: a pocket build's unit, else the overall box. */
function unitBox(project: YardProject) {
  return project.pocket?.unit
    ? { width: project.pocket.unit.width, height: project.pocket.unit.height, depth: project.pocket.unit.depth }
    : project.overall;
}

/**
 * Per axis: typed → the typed size; assumed → the model's drawn extent (grown or shrunk). Height is from the floor, as the
 * engine sizes it (a floating desk's 30″ is its top's height). Depth keeps the proud-front rule.
 */
/**
 * Wall-hung accessories over the unit (a vanity's mirror hung above its top) are not the unit's size: an assumed
 * axis reads the unit's own extent without them. Class rule, seeded by the vanity (Critic #93: a "30 inch vanity"
 * headed 44" tall because its mirror tops out at 44"; the vanity is 34"). A mirror set in a door, or one that is the
 * build itself (a mirror frame), stays.
 */
export function isWallAccessoryAbove(p: YardProject["panels"][number], unitHeight: number): boolean {
  const mirror = p.type === "mirror" || /\bmirror\b/i.test(p.name);
  return mirror && unitHeight > 0 && p.position.y >= unitHeight - 0.01;
}

function shownSize(project: YardProject, assumed: Partial<Record<Axis, boolean>>) {
  const o = unitBox(project);
  const body = project.panels.filter((p) => !isWallAccessoryAbove(p, o.height));
  const unit = body.length && body.length < project.panels.length ? { ...project, panels: body } : project;
  const box = !project.instances.length && project.panels.length ? drawnExtent(unit) : null;
  const ext: Record<Axis, number> | null = box ? { width: box.max.x - box.min.x, height: box.max.y - Math.min(0, box.min.y), depth: box.max.z - box.min.z } : null;
  // A pocket build's size is its fitted unit on every axis: the drawn extent would fold the proud fronts into the depth
  // the note already names (#109 B1: pocket vanity 17" deep, never 17 3/4").
  if (project.pocket?.unit) return { width: o.width, height: o.height, depth: o.depth };
  const at = (a: Axis) => (assumed[a] && ext && ext[a] > 0 ? ext[a] : o[a]);
  // C11: a whole bought item's depth is its real piece, so it reads the model's finished depth too.
  const depth = assumed.depth && ext && ext.depth > 0 ? ext.depth : isUnitItem(project) ? modelFinishedDepth(project.panels, o.depth) : o.depth;
  return { width: at("width"), height: at("height"), depth };
}

/** The build's one size (W, D, H in inches) every surface prints through inchFrac. */
export function headerSize(project: YardProject): { width: number; depth: number; height: number } {
  return shownSize(project, typedAxesTalk(project).assumed);
}

export type Axis = "width" | "height" | "depth";
const AXIS_WORD: Record<Axis, string> = { width: "wide", height: "tall", depth: "deep" };

/**
 * Typed-axes honesty for the PDF (same rule as the engine's class-default densify):
 * typed axes print plainly; untyped axes read from the build's "Assumed …" notes are marked assumed.
 * A prompt with no numbers at all (stock design size) is all assumed.
 */
/** "21 3/4" → 21.75, "3/4" → 0.75, "34" → 34. */
function shopInches(raw: string): number {
  const [a, b] = raw.trim().split(/\s+/);
  const part = (t: string) => (t.includes("/") ? Number(t.split("/")[0]) / Number(t.split("/")[1]) : parseFloat(t));
  return b ? part(a) + part(b) : part(a);
}

function notesAxes(project: YardProject) {
  // A pocket build's overall is the room pocket it stands in (walls + clearance) — the plan talks
  // about the unit you build, the same 38 × 102 × 17 the bench and the cover arrows show.
  const o = project.pocket?.unit
    ? { width: project.pocket.unit.width, height: project.pocket.unit.height, depth: project.pocket.unit.depth }
    : project.overall;
  const prompt = project.prompt ?? "";
  const assumed: Partial<Record<Axis, boolean>> = {};
  const extra: string[] = [];
  const axisOf = (w: string): Axis => (/wide/i.test(w) ? "width" : /tall/i.test(w) ? "height" : "depth");
  for (const n of project.notes ?? []) {
    // Shop fractions in the note ("Assumed 21 3/4" deep") read as their inch value.
    const m = String(n).trim().match(/^Assumed\s+(\d+(?:\.\d+)?(?:\s+\d+\/\d+)?|\d+\/\d+)\s*(?:"|″|in)?\s*(wide|tall|deep)\b(?:\s*\(([^)]*)\))?/i);
    if (!m) continue;
    const axis = axisOf(m[2]);
    const v = shopInches(m[1]);
    const finishedAxis = axis === "depth" ? modelFinishedDepth(project.panels, o.depth) : o[axis];
    if (Math.abs(v - o[axis]) < 0.5 || Math.abs(v - finishedAxis) < 0.07) assumed[axis] = true;
    // An assumed part size that is not the overall (L-desk wing depth) names its part: "desk 24" deep".
    else extra.push(`${m[3] ? `${clean(m[3]).replace(/\s*(?:class\s+)?default$/i, "")} ` : ""}${frac(v)} ${AXIS_WORD[axis]}`);
  }
  const noDigits = !/\d/.test(prompt);
  // Digits that size nothing ("3 bays", "20lb tank", "for a 50 lb dog") type no axis: with no
  // dimension triple and no bare length, an axis no "N wide/tall/deep" names is assumed.
  {
    const lp = prompt.toLowerCase();
    const sized = /\d\s*(?:"|″|in\b|inch|ft\b|feet|foot|'|cm\b|mm\b)?\s*(?:[x×]|by)\s*\d/.test(lp) || /\d\s*(?:'|ft\b|feet|foot|cm\b|mm\b|"|″|in\b|inch(?:es)?\b)(?!\s*(?:wide|width|long|length|tall|high|height|deep|depth))/.test(lp);
    if (!noDigits && !sized) {
      const named: Record<Axis, RegExp> = { width: /\d[\d\s./]*\s*(?:"|″|in(?:ch(?:es)?)?)?\s*(?:wide|width|long|length)\b|\b(?:width|length)\s*(?:of\s*)?\d/, height: /\d[\d\s./]*\s*(?:"|″|in(?:ch(?:es)?)?)?\s*(?:tall|high|height)\b|\bheight\s*(?:of\s*)?\d/, depth: /\d[\d\s./]*\s*(?:"|″|in(?:ch(?:es)?)?)?\s*(?:deep|depth)\b|\bdepth\s*(?:of\s*)?\d/ };
      for (const a of ["width", "height", "depth"] as Axis[]) if (!named[a].test(lp)) assumed[a] = true;
    }
  }
  const axes: Axis[] = ["width", "height", "depth"];
  // Nothing typed is still stock size when the build's own Assumed notes cover every axis.
  const stock = noDigits && !extra.length && (!Object.keys(assumed).length || axes.every((a) => assumed[a]));
  if (stock) axes.forEach((a) => (assumed[a] = true));
  // C11: a whole bought item is its known trade size (the unit table), never an assumed size to measure.
  if (isUnitItem(project)) {
    axes.forEach((a) => delete assumed[a]);
    extra.length = 0;
  }
  // An edit in place reads its marks from the edited spec (spec.ts), never from notes the rebuild no longer carries: an
  // axis set on the bench is the person's own value, every other axis keeps the mark it had (#109 B2).
  const spec = project.spec;
  if (spec && axes.some((a) => spec.size[a].edited)) {
    for (const a of axes) if (spec.size[a].assumed && !spec.size[a].edited) assumed[a] = true; else delete assumed[a];
    return { assumed, extra, stock: false };
  }
  return { assumed, extra, stock };
}

/** The header, card, readout and steps' size talk (their own typed/assumed reading until each moves to the spec). */
export function typedAxesTalk(project: YardProject, craft = false) {
  return axesTalk(project, craft, notesAxes(project), false);
}

/**
 * The PDF cover's size line, read from the project's one spec (spec.ts, I42): typed axes print plainly, assumed axes
 * are marked assumed, and a typed size built differently says both.
 */
export function coverAxesTalk(project: YardProject, craft = false) {
  const spec = specOf(project);
  const assumed: Partial<Record<Axis, boolean>> = {};
  for (const a of ["width", "height", "depth"] as Axis[]) if (spec.size[a].assumed) assumed[a] = true;
  return axesTalk(project, craft, { assumed, extra: [...spec.parts], stock: spec.stock }, true, spec);
}

function axesTalk(project: YardProject, craft: boolean, read: ReturnType<typeof notesAxes>, sayTyped: boolean, spec?: YardSpec) {
  const o = unitBox(project);
  const name = clean(project.name) || "Yard plan";
  const { assumed, extra, stock } = read;
  const axes: Axis[] = ["width", "height", "depth"];
  const finished = modelFinishedDepth(project.panels, o.depth);
  // One size (headerSize): a typed axis is the typed number said back on every surface, the cover too (Chief walk
  // 21 Oct: filing typed 30 deep, header 30, PDF 30 3/4). Doors or fronts standing proud are the note, not the size.
  // An assumed axis is the model's extent. The cover prints the title's and tags' own numbers (headerSize), so proud
  // fronts are said once, in the note, never also folded into a depth (Critic #109 B1: vanity 17 3/4 beside 17).
  const shown = shownSize(project, sayTyped ? notesAxes(project).assumed : assumed);
  // A typed size built at another size says both, plainly: "48" wide (you typed 36")".
  const bed = isBedLongWide(project.notes);
  const saidBack = (a: Axis) => {
    // An edited axis is the person's own bench value, never "you typed" the old one.
    const t = !sayTyped || spec?.size[a].edited || bed || isUnitItem(project) ? null : typedOffBy(project.typedPrompt ?? project.prompt ?? "", a, [o[a], shown[a], finished]);
    return `${frac(shown[a])} ${AXIS_WORD[a]}${t != null ? ` (you typed ${frac(t)})` : ""}`;
  };
  const typed = axes.filter((a) => !assumed[a]).map(saidBack);
  const guessed = axes.filter((a) => assumed[a]).map((a) => `${frac(shown[a])} ${AXIS_WORD[a]}`);
  const list = (xs: string[]) => (xs.length <= 1 ? xs.join("") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);
  const assumedList = [...guessed, ...extra];
  const assumedTalk = !assumedList.length
    ? ""
    : craft && stock
      ? "design size, nothing typed"
      : `${list(assumedList)} assumed, measure to lock`;
  // One finished depth. The note does not repeat an inch figure.
  const proud = modelProudNote(project.panels, o.depth);
  const subtitle =
    craft && stock
      ? `About ${guessed.join(" x ")} · ${assumedTalk}`
      : [typed.join(" x "), assumedTalk, proud].filter(Boolean).join(" · ");
  // Title never stamps an untyped stock size: "Nightstand 20" × 24" × 16"" from a bare prompt → "Nightstand".
  const title = stampFinishedDepth(
    stock && /\d/.test(name) ? name.replace(/\s*\d.*$/, "").trim() || name : name,
    o.depth,
    shown.depth,
  );
  const assumedShort = assumedList.length ? (craft && stock ? "design size" : `${list(assumedList)} assumed`) : "";
  return { title, subtitle: clean(subtitle), assumed, assumedTalk, assumedShort };
}
