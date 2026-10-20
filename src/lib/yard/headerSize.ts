/**
 * One size for a build (header, cover, card, idea log): typed axes are the size said back; an assumed axis is the
 * model's own extent, so the header prints the same 1/16 the drawings label. Light (no jsPDF), so the server log
 * reads it too.
 */
import { modelFinishedDepth, modelProudNote, stampFinishedDepth } from "./modelSize";
import { clean, frac } from "./pdfKit";
import { drawnExtent } from "./pdfDraw";
import { isUnitItem } from "./unitItems";
import { specOf } from "./spec";
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
 * The PDF cover's size line, read from the project's one spec (spec.ts): typed axes print plainly, assumed axes are
 * marked assumed, and nothing here decides typed versus assumed on its own (I42).
 */
export function typedAxesTalk(project: YardProject, craft = false) {
  // A pocket build's overall is the room pocket it stands in (walls + clearance) — the plan talks
  // about the unit you build, the same 38 × 102 × 17 the bench and the cover arrows show.
  const o = unitBox(project);
  const name = clean(project.name) || "Yard plan";
  const spec = specOf(project);
  const axes: Axis[] = ["width", "height", "depth"];
  const assumed: Partial<Record<Axis, boolean>> = {};
  for (const a of axes) if (spec.size[a].assumed) assumed[a] = true;
  const extra = [...spec.parts];
  const stock = spec.stock;
  const finished = modelFinishedDepth(project.panels, o.depth);
  // One size (headerSize): a typed axis is the typed number said back on every surface, the cover too (Chief walk
  // 21 Oct: filing typed 30 deep, header 30, PDF 30 3/4). Doors or fronts standing proud are the note, not the size.
  // An assumed axis is the model's extent.
  const shown = shownSize(project, assumed);
  // A typed size built at another size says both, plainly: "48" wide (you typed 36")".
  const bed = isBedLongWide(project.notes);
  const saidBack = (a: Axis) => {
    const t = bed || isUnitItem(project) ? null : typedOffBy(project.typedPrompt ?? project.prompt ?? "", a, [o[a], shown[a], finished]);
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
