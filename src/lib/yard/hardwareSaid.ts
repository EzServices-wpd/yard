/**
 * I9 (hardware the steps or notes name is on Buy): one vocabulary for both the check and the fix. A step that says
 * "into studs or wall anchors" puts a pack of wall anchors on Buy; the invariant reads the same words the same way.
 * A verb is not hardware ("Pull any nails", "Pull the cup back"), and "no hinges" / "without a latch" is not a use.
 */
import type { BomLine, BuildPlan, YardProject } from "./types";
import { decorateBom } from "./listings";

export const HARDWARE = ["hinge", "pull", "knob", "carriage bolt", "lag screw", "latch", "wall anchor", "caster", "drawer slide", "glide", "coat hook"] as const;
export type HardwareWord = (typeof HARDWARE)[number];

/** "pull" / "hinge" as a verb (Pull any nails, hinge it on the axle) is not a cabinet pull or a hinge to buy. */
const VERB_AFTER = "(?!\\s+(?:any|out|the|it|them|off|back|tight|apart|each|a|an|up|down|away|free|clear)\\b)";

function said(word: HardwareWord, text: string): boolean {
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
  return HARDWARE.filter((h) => said(h, text) && !new RegExp(`\\b${h}`, "i").test(buy));
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
};

export function withSaidHardware(p: YardProject, plan: BuildPlan): BuildPlan {
  const add = decorateBom(hardwareSaidNotBought(p, plan).flatMap((h) => (BUY_FOR[h] ? [BUY_FOR[h]!()] : [])));
  return add.length ? { ...plan, bom: [...plan.bom, ...add] } : plan;
}
