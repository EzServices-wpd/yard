/**
 * I9 (hardware the steps or notes name is on Buy): one vocabulary for both the check and the fix. A step that says
 * "into studs or wall anchors" puts a pack of wall anchors on Buy; the invariant reads the same words the same way.
 * A verb is not hardware ("Pull any nails", "Pull the cup back"), and "no hinges" / "without a latch" is not a use.
 */
import type { BomLine, BuildPlan, YardProject } from "./types";
import { decorateBom } from "./listings";

export const HARDWARE = ["hinge", "pull", "knob", "carriage bolt", "lag screw", "latch", "wall anchor", "caster", "drawer slide", "glide", "coat hook", "stud tie"] as const;
export type HardwareWord = (typeof HARDWARE)[number];

/** "pull" / "hinge" as a verb (Pull any nails, hinge it on the axle) is not a cabinet pull or a hinge to buy. */
const VERB_AFTER = "(?!\\s+(?:any|out|the|it|them|off|back|tight|apart|each|a|an|up|down|away|free|clear)\\b)";

/**
 * "stud tie": a step that anchors/ties/straps/secures a freestanding frame to a wall stud needs a bracket to do it
 * with (bunk bed "Anchor the frame to a wall stud" had nothing on Buy). Screwing a cleat or back straight into a stud
 * needs no extra part, so only those verbs count. Bought as corner braces, an L bracket or an anti-tip kit.
 */
const STUD_TIE_SAID = /\b(?:anchor|tie|strap|secure)(?:s|d|ed)?\s+(?:(?:the|this|it|each)\s+)?(?:(?:frame|unit|bed|tower|post|posts|top)\s+)?(?:in)?to\s+(?:a\s+|the\s+)?wall\s+studs?\b/i;
const STUD_TIE_BOUGHT = /corner brace|L[- ]bracket|anti-tip|wall strap/i;

function said(word: HardwareWord, text: string): boolean {
  if (word === "stud tie") return STUD_TIE_SAID.test(text);
  const re = new RegExp(`\\b${word}s?\\b${word === "pull" || word === "hinge" ? VERB_AFTER : ""}`, "i");
  return re.test(text) && !new RegExp(`\\bno ${word}s?\\b|\\bwithout (?:a |any )?${word}`, "i").test(text);
}

function saidText(p: YardProject, plan: Pick<BuildPlan, "instructions">): string {
  return `${(p.notes ?? []).join(" ")} ${plan.instructions.map((s) => `${s.title} ${s.description}`).join(" ")}`;
}

function boughtText(plan: Pick<BuildPlan, "bom">): string {
  return plan.bom.map((b) => `${b.name} ${b.searchQuery ?? ""}`).join(" | ");
}

/** Hardware the steps or notes tell you to use that no Buy line buys. */
export function hardwareSaidNotBought(p: YardProject, plan: Pick<BuildPlan, "instructions" | "bom">): HardwareWord[] {
  const text = saidText(p, plan);
  const buy = boughtText(plan);
  return HARDWARE.filter((h) => said(h, text) && !(h === "stud tie" ? STUD_TIE_BOUGHT : new RegExp(`\\b${h}`, "i")).test(buy));
}

/**
 * Buy lines for hardware the steps name. Priced from a checked listing; a word with no checked listing is left for
 * I9 to report rather than given a made-up price.
 */
const BUY_FOR: Partial<Record<HardwareWord, () => BomLine>> = {
  // Home Depot: E-Z Ancor Twist-N-Lock #8 x 1-1/4" drywall anchors with screws, 20-pack, $7.15 (checked 2026-10-16).
  "wall anchor": () => ({
    name: '#8 self-drilling wall anchors with screws, 20 pack',
    quantity: 1,
    unit: "pack",
    estimatedCost: 7.15,
    notes: "For each hang screw that lands between studs. Drive into a stud wherever one is there.",
  }),
  // Home Depot: Everbilt 3 in. zinc-plated corner brace, 4-pack (model 15307), $4.67, screws not included (checked 2026-10-16).
  "stud tie": () => ({
    name: '3" steel corner braces, 4 pack',
    quantity: 1,
    unit: "pack",
    estimatedCost: 4.67,
    notes: "Tie the frame into a wall stud: one leg on the frame, one on the stud, #8 screws at least 2 1/2\" long into the stud.",
  }),
};

export function withSaidHardware(p: YardProject, plan: BuildPlan): BuildPlan {
  const add = decorateBom(hardwareSaidNotBought(p, plan).flatMap((h) => (BUY_FOR[h] ? [BUY_FOR[h]!()] : [])));
  return add.length ? { ...plan, bom: [...plan.bom, ...add] } : plan;
}
