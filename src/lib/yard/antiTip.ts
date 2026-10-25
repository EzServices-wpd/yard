/**
 * Critic row 292 (safety): a freestanding unit that can tip gets an anti-tip kit on Buy. That is the STURDY Act / ASTM
 * F2057 tip-over case: bookcases, shelf units, cabinets, wardrobes, linen and pantry towers, dressers, chests and
 * nightstands. A unit counts when it stands on the floor (installMode freestanding) and is over 30" tall, or holds
 * drawers and stands 27" or taller finished (F2057's clothing-storage line; an open drawer moves the weight forward). Beds, kitchen islands and bases, carts, desks, vanities and play
 * structures are not casework that tips (a coat bench's tall back is), and a unit some step already fastens to the
 * studs needs no kit. The strap step comes from stepsInstallWallAnchors (#127), which carries the kit by id
 * ({ id: ANTI_TIP_ID, qty }), so I46 ties the Buy line to its step by id, never by a word.
 */
import type { BuildPlan, YardProject } from "./types";
import { anchorKind } from "./wallAnchorSteps";

type Row = BuildPlan["bom"][number];

export const ANTI_TIP_ROW: Row = {
  name: "Furniture anti-tip kit",
  quantity: 1,
  unit: "kit",
  searchQuery: "furniture anti tip kit wall anchor strap",
  estimatedCost: 9.98,
  notes: "Strap or bracket from the top back into a wall stud so the unit cannot tip forward.",
};

/** Fitted programs that are casework standing on the floor. */
const CASEWORK = new Set(["bookcase", "storage", "closet", "wardrobe", "pantry", "media"]);
/** Builds under those programs that are not tip-prone casework. */
const NOT_CASEWORK = /\b(?:bed|island|kitchen (?:base|cart)|cart|playhouse|treehouse|bench)\b/i;
/** Casework a builder outside the fitted programs makes. */
const CASEWORK_NAME = /\b(?:locker|dresser|wardrobe|armoire|bookcase|bookshelf|nightstand)\b/i;
/** A coat bench / hall tree: a bench with a tall coat back that tips forward under a hung load. */
const HALL_TREE = /\b(?:coat bench|hall tree)\b/i;
const TALL_IN = 30;
/** CPSC / ASTM F2057: clothing storage with drawers is a tip-over risk at 27" finished height and up. */
const DRAWER_TIP_IN = 27;
/** A part that makes the unit roll. */
const ROLLS = /\b(?:casters?|wheels?)\b/i;

/** Whether this build is freestanding casework that can tip: over 30" tall, or with drawers and 27" or taller. */
export function needsAntiTip(project: YardProject): boolean {
  if (project.displayOnly || project.refused) return false;
  if (project.assumptions?.installMode !== "freestanding") return false;
  const program = project.fitted?.program;
  const hallTree = HALL_TREE.test(project.name);
  if (!(program && CASEWORK.has(program)) && !CASEWORK_NAME.test(project.name) && !hallTree) return false;
  if (NOT_CASEWORK.test(project.name) && !hallTree) return false;
  // A unit on casters rolls: strapping it to a wall defeats the wheels ('rolling bar cart' builds as a Storage unit).
  if (project.panels.some((p) => ROLLS.test(p.name))) return false;
  const drawers = project.panels.some((p) => p.drawerId);
  return project.overall.height > TALL_IN || (drawers && project.overall.height >= DRAWER_TIP_IN);
}

/** A step that already fastens the unit to the wall studs ("Set it over the toilet and lag into studs"). */
const STUD_STEP = /\b(?:into|on|to) (?:the |two |a )?(?:wall )?studs?\b|\bwall studs?\b/i;

/** Adds the anti-tip kit to Buy for freestanding casework that can tip and has nothing holding it to the wall yet. */
export function withAntiTipKit(project: YardProject, plan: BuildPlan): BuildPlan {
  if (!needsAntiTip(project)) return plan;
  if (plan.bom.some((b) => anchorKind(b))) return plan;
  if (plan.instructions.some((s) => STUD_STEP.test(s.title))) return plan;
  // The Buy pack count counts the kit like any other line (totals.packs is summed before this pass).
  return { ...plan, bom: [...plan.bom, { ...ANTI_TIP_ROW }], totals: { ...plan.totals, packs: plan.totals.packs + ANTI_TIP_ROW.quantity } };
}
