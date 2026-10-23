/**
 * Critic row 292 (safety): a freestanding unit that can tip gets an anti-tip kit on Buy and the step that straps it to
 * a wall stud. That is the STURDY Act / ASTM F2057 tip-over case: bookcases, shelf units, cabinets, wardrobes, linen
 * and pantry towers, dressers, chests and nightstands. A unit counts when it stands on the floor (installMode
 * freestanding) and is over 30" tall or holds drawers (an open drawer moves the weight forward). Beds, kitchen
 * islands and bases, carts, desks, vanities and play structures are not casework that tips (a coat bench's tall
 * back is), and a unit some step already fastens to
 * the studs needs no kit. The step names the kit by id in fastenersUsed, so the tie is exact (row 291).
 */
import type { BuildPlan, YardProject } from "./types";

type Step = BuildPlan["instructions"][number];
type Row = BuildPlan["bom"][number];

export const ANTI_TIP_ROW: Row = {
  name: "Furniture anti-tip kit",
  quantity: 1,
  unit: "kit",
  searchQuery: "furniture anti tip kit wall anchor strap",
  estimatedCost: 9.98,
  notes: "Strap or bracket from the top back into a wall stud so the unit cannot tip forward.",
};
export const ANTI_TIP_ID = `buy:${ANTI_TIP_ROW.name}`;

/** Fitted programs that are casework standing on the floor. */
const CASEWORK = new Set(["bookcase", "storage", "closet", "wardrobe", "pantry", "media"]);
/** Builds under those programs that are not tip-prone casework. */
const NOT_CASEWORK = /\b(?:bed|island|kitchen (?:base|cart)|cart|playhouse|treehouse|bench)\b/i;
/** Casework a builder outside the fitted programs makes. */
const CASEWORK_NAME = /\b(?:locker|dresser|wardrobe|armoire|bookcase|bookshelf|nightstand)\b/i;
/** A coat bench / hall tree: a bench with a tall coat back that tips forward under a hung load. */
const HALL_TREE = /\b(?:coat bench|hall tree)\b/i;
const TALL_IN = 30;

/** Whether this build is freestanding casework that can tip: over 30" tall, or with drawers. */
export function needsAntiTip(project: YardProject): boolean {
  if (project.displayOnly || project.refused) return false;
  if (project.assumptions?.installMode !== "freestanding") return false;
  const program = project.fitted?.program;
  const hallTree = HALL_TREE.test(project.name);
  if (!(program && CASEWORK.has(program)) && !CASEWORK_NAME.test(project.name) && !hallTree) return false;
  if (NOT_CASEWORK.test(project.name) && !hallTree) return false;
  const drawers = project.panels.some((p) => p.drawerId);
  return project.overall.height > TALL_IN || drawers;
}

/** A step that already fastens the unit to the wall studs ("Set it over the toilet and lag into studs"). */
const STUD_STEP = /\b(?:into|on|to) (?:the |two |a )?(?:wall )?studs?\b|\bwall studs?\b/i;

const strapStep = (): Step => ({
  step: 0,
  title: "Strap the top to a wall stud with the anti-tip kit",
  description: `With the unit standing where it lives, find a stud behind its top with a stud finder. Screw the ${ANTI_TIP_ROW.name}'s bracket to the top back edge and its wall bracket into the stud, then connect the strap snug, so the unit cannot tip forward.`,
  partsUsed: [],
  fastenersUsed: [ANTI_TIP_ID],
});

/** Adds the anti-tip kit and its strap step to freestanding casework that can tip, and the step to a kit Buy already has. */
export function stepsStrapAntiTip(project: YardProject, plan: BuildPlan): BuildPlan {
  const kit = plan.bom.find((b) => /\banti-tip\b/i.test(b.name));
  const steps = plan.instructions;
  const strapped = steps.some((s) => (s.fastenersUsed ?? []).includes(kit ? `buy:${kit.name}` : ANTI_TIP_ID) || /\banti-tip\b/i.test(`${s.title} ${s.description}`));
  if (kit) {
    if (strapped || kit.name !== ANTI_TIP_ROW.name) return plan;
  } else if (!needsAntiTip(project) || steps.some((s) => STUD_STEP.test(s.title))) {
    return plan;
  }
  const bom = kit ? plan.bom : [...plan.bom, { ...ANTI_TIP_ROW }];
  return { ...plan, bom, instructions: [...steps, strapStep()].map((s, i) => ({ ...s, step: i + 1 })) };
}
