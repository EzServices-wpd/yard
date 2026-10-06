/**
 * Plan text says what to do. Every step, tip, note, cut row and Buy line goes through one final
 * pass that turns "do not / cannot / never" sentences into the positive action, and every decimal
 * size into a shop fraction. Rules are phrase patterns (shop grammar), never per-project patches.
 */
import { fractionizeInches } from "./inchText";
import type { BuildPlan } from "./types";

type Rule = [RegExp, string | ((...m: string[]) => string)];

const plural = (subject: string) => /\b(they|we|you)\b/i.test(subject) || (/s$/i.test(subject.trim()) && !/ss$/i.test(subject.trim()));
const verb = (subject: string, one: string, many: string) => (plural(subject) ? many : one);

const RULES: Rule[] = [
  // Confirm before cutting.
  [/\s*[—–-]+\s*do not cut yet\b/gi, " before the first cut"],
  // Whole stock.
  [/\bFull pieces\. Do not cut\./g, "Full pieces, used whole as bought."],
  [/\bDo not cut\./g, "Use it whole, as bought."],
  [/(^|[.;]\s*)Do not cut\b/g, "$1Use it whole"],
  // Square while shimming / gluing.
  [/\s*[—–-]+\s*do not twist the ([\w ]+?)\./gi, (_m, what) => `, keeping the ${what} square.`],
  [/\bDo not rack (the [\w ]+?) to match ([^.]+)\./gi, (_m, what, wall) => `Keep ${what} square, even against ${wall}.`],
  [/;\s*do not rack (the [\w ]+?)\./g, (_m, what) => `; keep ${what} square.`],
  [/\s*[—–-]+\s*do not rack (the [\w ]+?)\./g, (_m, what) => `, keeping ${what} square.`],
  [/\bso (the [\w ]+?|it|they) cannot rack\b/gi, (_m, s) => `so ${s} ${verb(s, "stays", "stay")} square`],
  [/\bDo not rack (the [\w ]+?)( while [^.]*)?(?= to follow|\.)/gi, (_m, what, when) => `Keep ${what} square${when ?? ""}`],
  [/ to follow the flare\./g, "; the flare comes from the cut parts."],
  // Loose shelves on pins.
  [/\bDo not glue the shelves; the pins hold them/gi, "Leave the shelves loose on the pins"],
  [/\bDo not use shelf pins\b/gi, "Use fixed shelves here, screwed in place"],
  [/;\s*do not pin them\b/gi, " in place"],
  // Spans a divider shortens.
  [/\bso (the [\w ]+?) don't span the full ([^.]+?)\./gi, (_m, what, run) => `so ${what} span less than the full ${run}.`],
  // Lids that hinge next.
  [/\bDo not glue or screw (the \w+) on as a fixed top\b/gi, (_m, what) => `Leave ${what} loose for now`],
  // Wall-hung layouts.
  [/This hangs on the wall\s*[—–-]+\s*do not mark a footprint on the floor\./gi, "This hangs on the wall, so the layout marks go on the wall."],
  // Bought glazing.
  [/\s*[—–-]+\s*do not cut(?: it)? from (?:the )?plywood\./gi, "; it comes cut to size from a glass shop, apart from the plywood."],
  [/\bDo not nest ([\w"×/ ]+?) on the plywood sheet\./gi, (_m, what) => `Cut the ${what} from its own stock, apart from the plywood sheet.`],
  [/\bDo not treat it like a full-width lid sitting on the uprights\./gi, "It sits between the uprights, apart from a full-width lid."],
  // Things that stay put.
  [/\bso (the [\w ]+?|it|they|jars|bottles) cannot tip(?: forward)?\b/gi, (_m, s) => `so ${s} ${verb(s, "stays", "stay")} upright`],
  [/\bso (the [\w ]+?|it|they|jars|bottles) cannot (?:slide|roll|fall) off\b/gi, (_m, s) => `so ${s} ${verb(s, "stays", "stay")} on`],
  [/\bso (the [\w ]+?|it|they) cannot slam shut on fingers\b/gi, (_m, s) => `so ${s} ${verb(s, "closes", "close")} gently, clear of fingers`],
  [/\bso (the [\w ]+?|it|they) cannot slam(?: shut)?\b(?! on fingers)/gi, (_m, s) => `so ${s} ${verb(s, "closes", "close")} gently`],
  [/\bnever through openings or outside the silhouette\b/g, "inside the silhouette and clear of openings"],
  [/\bso (the [\w ]+?|it|they) cannot tip\b/gi, (_m, s) => `so ${s} ${verb(s, "stays", "stay")} upright`],
  [/(?:,? or sit it on a counter and still lag it) so it cannot tip/gi, ", or sit it on a counter and still lag it so it stays upright"],
  // Studs.
  [/\bso it cannot hit two studs at\b/gi, "so it reaches only one stud at"],
  [/\bso it cannot take a screw in two studs\b/gi, "so it reaches only one stud"],
  [/\bDo not drive four corner screws and call them studs\./gi, "Drive stud screws only where a stud is."],
  [/\s*[—–-]+\s*not four corner screws into studs\./gi, "; stud screws go only where a stud is."],
  // Sheets.
  [/\b(These|The) ([\w ]+?) do not fit one sheet\b/gi, (_m, d, what) => `${d} ${what} are larger than one sheet`],
  [/\bfaces that do not fit a 4×8\b/gi, "faces larger than a 4×8"],
  [/\bA stranger cannot cut a (\w+) (larger|longer|wider) than the (\w+)\s*[—–-]+\s*/gi, (_m, what, cmp, stock) => `A ${what} ${cmp} than the ${stock} is spliced from two pieces — `],
  [/\bA stranger cannot cut a (\w+) (larger|longer|wider) than the (\w+)\b/gi, (_m, what, cmp, stock) => `A ${what} ${cmp} than the ${stock} is spliced from two pieces`],
  [/\bYou cannot fix that later\./g, "Square it now, while it is easy to fix."],
  // Fitting.
  [/\s*[—–-]+\s*don't force\./gi, " — ease it into place."],
  [/,\s*never [^.]*\./g, "."],
];

/** The wording rules alone (no fraction pass): build notes read positively, same grammar as the plan. */
export function positiveSentence(text: string): string {
  let out = text;
  if (/\b(?:cannot|can't|do not|don't|never|not four)\b/i.test(out)) for (const [re, to] of RULES) out = out.replace(re, to as never);
  return out;
}

export function positiveText(text: string): string;
export function positiveText(text: string | undefined): string | undefined;
export function positiveText(text: string | undefined): string | undefined {
  if (!text) return text;
  let out = text;
  if (/\b(?:cannot|can't|do not|don't|never|not four)\b/i.test(out)) for (const [re, to] of RULES) out = out.replace(re, to as never);
  // Whole-degree angles read without a trailing ".0".
  out = out.replace(/(\d)\.0°/g, "$1°");
  return fractionizeInches(out);
}

/** The last pass over every string a person reads in the plan. */
export function positivePlan(plan: BuildPlan): BuildPlan {
  return {
    ...plan,
    instructions: plan.instructions.map((s) => ({ ...s, title: positiveText(s.title), description: positiveText(s.description), tips: positiveText(s.tips) })),
    bom: plan.bom.map((b) => ({ ...b, name: positiveText(b.name), notes: positiveText(b.notes) })),
    cutList: plan.cutList.map((c) => ({ ...c, name: positiveText(c.name), notes: positiveText(c.notes), material: positiveText(c.material) })),
    feasibility: plan.feasibility && {
      ...plan.feasibility,
      summary: positiveText(plan.feasibility.summary),
      issues: (plan.feasibility.issues ?? []).map((i) => ({ ...i, message: positiveText(i.message) })),
    },
  };
}
