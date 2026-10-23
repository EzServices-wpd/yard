/**
 * Wall fastener hardware on Buy is installed by a step, and every fastener a step drives is on Buy (Critic rows 231,
 * 291 and 311). The tie is data, never a word: a step lists the Buy lines it drives in fastenersUsed ({ id, qty }), a
 * line counts as installed only when a step lists its id, and the step names the fastener from that same data
 * (fastenerText), so its words cannot name hardware it does not carry. Lag screws get a "Lag … to the wall studs"
 * step, an anti-tip kit a strap step, rated wall anchors a step that sets them, and wall screws a build buys with no
 * step to drive them a "Screw it to the wall studs" step. The step goes where the note puts it ("before the bed is
 * mounted": right after the back is on), otherwise last, once the unit stands where it lives.
 */
import type { BuildPlan, FastenerUse, YardProject } from "./types";

/** A carcass back (never a drawer's): "Back", "Back panel", "Upper back 2". */
const BACK_PART = /^(?:upper |lower )?back(?: panel)?(?: \d+)?$/i;

type Step = BuildPlan["instructions"][number];
type Row = BuildPlan["bom"][number];

/** The id a step names a Buy fastener line by. */
export const fastenerId = (b: { name: string; catalogId?: string }) => b.catalogId ?? `buy:${b.name}`;

/** The Buy rows this pass knows by id: the ones that fasten a build to the wall. */
export const LAG_ROW: Row = { name: '5/16" × 3" lag screws with washers', quantity: 4, estimatedCost: 0.98 * 4, unit: "each", searchQuery: "5/16 x 3 lag screw", notes: "Into the wall studs." };
export const STRUCTURAL_ROW: Row = { name: "GRK RSS #9 x 3-1/8 structural screws", quantity: 1, unit: "box", catalogId: "structural-screws", searchQuery: "GRK RSS #9 x 3-1/8", estimatedCost: 14, notes: "The long screws the steps drive into the studs." };
export const STRUCTURAL_ID = fastenerId(STRUCTURAL_ROW);
export const TAPCON_ID = "tapcon";
export const LAG_ID = fastenerId(LAG_ROW);
export const WALL_ANCHORS_ID = "buy:Rated wall anchors";
export const ANTI_TIP_ID = "buy:Furniture anti-tip kit";

/** The words a step uses for a fastener it carries, from its id: the step text renders from the data. */
const FASTENER_TEXT: Record<string, string> = {
  [STRUCTURAL_ID]: '3" structural screws',
  [TAPCON_ID]: '3/16" × 2 3/4" Tapcon concrete screws',
  [LAG_ID]: '5/16" × 3" lag screws',
  [WALL_ANCHORS_ID]: "rated wall anchors",
  [ANTI_TIP_ID]: "anti-tip kit",
};
export const fastenerText = (f: FastenerUse) => FASTENER_TEXT[f.id] ?? f.id.replace(/^buy:/, "");

/** The screws that fasten this build into the wall: Tapcons on masonry, else structural screws. */
export const wallScrew = (project: YardProject, qty: number): FastenerUse => ({ id: project.assumptions?.wallType === "masonry" ? TAPCON_ID : STRUCTURAL_ID, qty });
export const structural = (qty: number): FastenerUse => ({ id: STRUCTURAL_ID, qty });

/** The fastener ids this pass and I46 tie by id: the ones that hold a build to the wall or to itself as framing. */
export const TIED_BY_ID = new Set([STRUCTURAL_ID, TAPCON_ID, LAG_ID, WALL_ANCHORS_ID, ANTI_TIP_ID]);
export const tiedById = (b: Row) => TIED_BY_ID.has(fastenerId(b));

/** Buy rows that fasten the build to the wall and get their own install step when no step lists them. */
export const WALL_ANCHOR: RegExp[] = [/\blag (?:screws?|bolts?)\b/i, /\banti-tip\b/i, /\b(?:wall anchors?|toggle bolts?)\b/i];
export const anchorKind = (b: Row) => WALL_ANCHOR.find((k) => k.test(b.name));

/** Whether some step installs this Buy row: a step lists its id. */
export function anchorInstalled(plan: BuildPlan, b: Row): boolean {
  const id = fastenerId(b);
  return plan.instructions.some((s) => (s.fastenersUsed ?? []).some((f) => f.id === id));
}

const working = (s: Step) => !/^(?:Cut|Confirm)\b/i.test(s.title);

function anchorStep(project: YardProject, b: Row, note: string | undefined): Step {
  const back = project.panels.find((p) => !p.drawerId && BACK_PART.test(p.name));
  const through = back ? `through the ${back.name.replace(/\s*\d+$/, "")}` : "through the back rail";
  const said = note ? ` ${note.replace(/\s*$/, "").replace(/([^.!?])$/, "$1.")}` : "";
  if (/\blag\b/i.test(b.name)) {
    const n = Math.max(2, b.quantity || 4);
    const fastenersUsed = [{ id: fastenerId(b), qty: n }];
    return {
      step: 0,
      title: "Lag the cabinet to the wall studs",
      description: `Stand the cabinet against the wall where it lives and find two studs behind it with a stud finder; mark their centers.${said} Predrill ${through} into each stud and drive the ${n} × ${b.name} (${Math.ceil(n / 2)} per stud, high and low), snug the washers to the face, and stop before they strip. Load nothing onto it until every lag is in a stud.`,
      partsUsed: back ? [back.name] : [],
      fastenersUsed,
    };
  }
  const fastenersUsed = [{ id: fastenerId(b), qty: Math.max(1, b.quantity || 1) }];
  if (/anti-tip/i.test(b.name)) {
    return {
      step: 0,
      title: "Strap the top to a wall stud with the anti-tip kit",
      description: `With the unit standing where it lives, find a stud behind its top with a stud finder. Screw the anti-tip kit's bracket to the top back edge and its wall bracket into the stud, then connect the strap snug, so the unit cannot tip forward.${said}`,
      partsUsed: [],
      fastenersUsed,
    };
  }
  return {
    step: 0,
    title: "Set the rated wall anchors",
    description: `Hold the unit level on the wall and mark its screw holes. Drive a screw into a stud wherever a hole lands on one, and set a rated wall anchor at each hole that misses a stud before driving its screw.${said}`,
    partsUsed: [],
    fastenersUsed,
  };
}

/** The sentence of a note about this anchor, by its own hardware word ("Lag the cabinet …", "anti-tip"). */
const NOTE_WORD = [/\blag(?:s|ged|ging)?\b/i, /\banti-tip\b/i, /\b(?:wall )?anchors?\b|\btoggle/i];

/** The step that drives wall screws a build buys with no step to drive them ('wall mounted drop leaf table'). */
function wallScrewStep(project: YardProject, b: Row): Step {
  const back = project.panels.find((p) => !p.drawerId && BACK_PART.test(p.name));
  const f: FastenerUse = { id: fastenerId(b), qty: 4 };
  return {
    step: 0,
    title: "Screw it to the wall studs",
    description: `Hold it level on the wall where it lives and find two studs behind it with a stud finder. Predrill ${back ? `through the ${back.name.replace(/\s*\d+$/, "")}` : "through its back rail"} and drive ${f.qty} × ${fastenerText(f)} into the studs, 2 per stud. Load nothing onto it until every screw is in a stud.`,
    partsUsed: back ? [back.name] : [],
    fastenersUsed: [f],
  };
}

/** Wall screw lines a step drives into the studs: the wall-mount line, never a frame's own structural screws. */
const WALL_SCREW_IDS = new Set([STRUCTURAL_ID, TAPCON_ID]);

/**
 * Both directions, by id. A fastener a step lists that Buy does not carry is added to Buy (the known rows only). A
 * wall-anchor Buy row no step lists gets the step that installs it, and so do the wall screws of a build that hangs
 * on the wall or stands in an alcove.
 */
export function stepsInstallWallAnchors(project: YardProject, plan: BuildPlan): BuildPlan {
  let bom = plan.bom;
  const onBuy = new Set(bom.map(fastenerId));
  const used = new Set(plan.instructions.flatMap((s) => (s.fastenersUsed ?? []).map((f) => f.id)));
  if (used.has(STRUCTURAL_ID) && !onBuy.has(STRUCTURAL_ID)) bom = [...bom, { ...STRUCTURAL_ROW }];
  let instructions = plan.instructions;
  const hangs = project.assumptions?.installMode !== "freestanding";
  for (const b of bom) {
    const k = anchorKind(b);
    if (anchorInstalled({ ...plan, instructions }, b)) continue;
    if (!k) {
      if (hangs && WALL_SCREW_IDS.has(fastenerId(b))) instructions = [...instructions, wallScrewStep(project, b)];
      continue;
    }
    const word = NOTE_WORD[WALL_ANCHOR.indexOf(k)];
    // Only the note's sentence about this anchor rides along ("Kids bookcase: 42" tall …" stays in the notes).
    const note = (project.notes ?? []).flatMap((n) => n.split(/(?<=[.!?])\s+/)).find((n) => word.test(n));
    const st = anchorStep(project, b, note);
    // "… before the bed is mounted": anchor the box as soon as its back is on, before anything hangs from it.
    const before = note && /\bbefore\b/i.test(note);
    const backs = project.panels.filter((p) => !p.drawerId && BACK_PART.test(p.name)).map((p) => p.name);
    const backAt = before ? instructions.findIndex((s) => working(s) && !(s.fastenersUsed ?? []).length && (s.partsUsed ?? []).some((n) => backs.includes(n))) : -1;
    const at = backAt >= 0 ? backAt + 1 : instructions.length;
    instructions = [...instructions.slice(0, at), st, ...instructions.slice(at)];
  }
  if (instructions === plan.instructions && bom === plan.bom) return plan;
  return { ...plan, bom, instructions: instructions.map((s, i) => ({ ...s, step: i + 1 })) };
}
