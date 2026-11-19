/**
 * Honest-gate checks (H-*): a build the gate must never pass, whatever its invariants and typed-word honor say.
 *
 *   H-standin   the build is a stand-in or fallback, not the asked-for object: the engine's own stand-in marks
 *               (genericFormMark: unmatched body, "simple stand-in", not learned yet, spine-only boat; standIn /
 *               unmatched flags), the generic fallback box over an ask for something else (genericBoxOverAsk), or
 *               the engine's fallback notes (closed shell of the typed envelope, anatomy-class build, the stick-lattice
 *               model builder on a real-use ask).
 *   H-craft     craft stock (sticks, skewers, straws, balsa, card) on an ask that is load-bearing, outdoor or sized
 *               for a person, when the words never asked for a model or for craft stock. The rule is the grader's
 *               own, read from the typed words only, so an engine change cannot grade itself.
 *   H-unpriced  a Buy line with no price: the total understates what the user will spend.
 *
 * Each is a hard fail (grade "fail"). An honest, expected refusal is still a pass (no build to judge).
 */

type Hit = { cls: "H-standin" | "H-craft" | "H-unpriced"; msg: string };
export type HonestEngine = {
  genericFormMark?: (p: any) => string | null;
  genericBoxOverAsk?: (prompt: string, p: any) => boolean;
};

// ---------------------------------------------------------------- craft on a real build (typed words only)
const CRAFT_STOCK = /\b(?:popsicle|craft[- ]?stick|toothpick|skewer|drinking straw|straws?\b|balsa|cardboard|chipboard|matchstick|lolly)/i;
const CRAFT_ID = /^(?:popsicle|craft|toothpick|bamboo-skewer|straw|balsa|cardboard|chipboard)/;
/** The words ask for a model or for craft stock: sticks are right. */
const ASKS_MODEL = /\b(?:model|miniature|mini|scale|toy|replica|diorama|desk ?top|tabletop|figurine|ornament|craft|popsicle|toothpicks?|skewers?|straws?|balsa|cardboard|matchsticks?|lolly|stem project|school project|science project)\b/i;
/** A child or a climber puts weight on it. */
const CHILD_OR_CLIMB = /\b(?:toddler|kids?'?|child(?:ren)?'?s?|baby|step stool|learning tower|climb(?:ing|er)?|ladder|steps?\b|stairs?)\b/i;
/** It carries weight: a person, a load, or things set on it. */
const LOAD_BEARING = /\b(?:bench|chair|stool|seat|bed|bunk|table|desk|stand|rack|shelf|shelves|shelving|bookcase|cabinet|dresser|armoire|wardrobe|closet|vanity|island|cart|workbench|post|platform|loft|crib|swing|hammock|ramp|step|ladder|tower|trellis|arbor|pergola|gate|fence|mailbox|hook|holder|hanger)\b/i;
/** It lives outdoors. */
const OUTDOOR = /\b(?:outdoor|outside|garden|yard|backyard|patio|porch|deck|lawn|planter|raised bed|compost|chicken|coop|hutch|doghouse|dog house|birdhouse|bird feeder|shed|sandbox|sand box|cornhole|mailbox|fence|gate|arbor|pergola|trellis|cold frame|greenhouse|picnic|adirondack)\b/i;
/** A subject people build as a model (a tower, a bridge, a ship): real only where it is put to use outdoors. */
const MODEL_SUBJECT = /\b(?:tower|bridge|ship|boat|galleon|schooner|sailboat|yacht|submarine|castle|windmill|lighthouse|rocket|plane|airplane|car|truck|train|house|cathedral|pyramid|roller coaster|ferris wheel|dome|globe|skyscraper)\b/i;
const USED_OUTDOORS = /\b(?:garden|backyard|yard|patio|porch|lawn|over (?:the|a|my) (?:creek|stream|pond|ditch))\b/i;
/** Sized for a person: 12" or more typed as a size, or doors and drawers. */
function personSized(lower: string): boolean {
  if (/\b(?:doors?|drawers?)\b/.test(lower)) return true;
  for (const m of lower.matchAll(/(\d+(?:\.\d+)?)\s*(?:"|''|in\b|inch(?:es)?\b|-inch\b|(ft|feet|foot|')\b)/g)) {
    const inches = Number(m[1]) * (m[2] ? 12 : 1);
    if (inches >= 12) return true;
  }
  return false;
}
/** Exported for its own test: true when craft stock would be wrong for these words. */
export function realUseAsk(prompt: string): boolean {
  const lower = prompt.toLowerCase();
  if (ASKS_MODEL.test(lower)) return false;
  if (CHILD_OR_CLIMB.test(lower)) return true;
  if (MODEL_SUBJECT.test(lower)) return USED_OUTDOORS.test(lower);
  return LOAD_BEARING.test(lower) || OUTDOOR.test(lower) || personSized(lower);
}
const craftBuilt = (p: any, plan: any) =>
  CRAFT_ID.test(p?.primaryMaterialId ?? "") || (plan?.bom ?? []).some((b: any) => CRAFT_STOCK.test(b.name ?? ""));

// ---------------------------------------------------------------- the checks
export function honestChecks(E: HonestEngine, prompt: string, p: any, plan: any): Hit[] {
  const hits: Hit[] = [];
  let mark: string | null = null;
  try { mark = E.genericFormMark?.(p) ?? null; } catch { /* older engine */ }
  if (!mark && p?.standIn) mark = "stand-in";
  if (!mark && p?.unmatched) mark = "unmatched body";
  if (!mark) { try { if (E.genericBoxOverAsk?.(prompt, p)) mark = "generic fallback box"; } catch { /* older engine */ } }
  // The engine's own fallback notes: a plywood shell of the typed envelope, a build from a name's anatomy class, or
  // the stick-lattice model builder (right for a model, a stand-in for something people use, in any stock).
  const notes = (p?.notes ?? []).join(" / ");
  if (!mark && /closed shell of the typed envelope/i.test(notes)) mark = "closed shell of the typed envelope";
  if (!mark && /No published wire for this name/i.test(notes)) mark = "anatomy-class fallback";
  if (!mark && /built from short sticks braced together/i.test(notes) && realUseAsk(prompt)) mark = "stick-lattice model for a real-use ask";
  if (mark) hits.push({ cls: "H-standin", msg: `${mark}: "${p?.name ?? "?"}" is not the asked-for object` });
  if (craftBuilt(p, plan) && realUseAsk(prompt)) hits.push({ cls: "H-craft", msg: `craft stock (${p?.primaryMaterialId ?? "sticks"}) on a load-bearing, outdoor or person-sized ask` });
  const unpriced = (plan?.bom ?? []).filter((b: any) => !(Number(b.estimatedCost) > 0)).map((b: any) => b.name);
  if (unpriced.length) hits.push({ cls: "H-unpriced", msg: `${unpriced.length} Buy line(s) with no price: ${unpriced.slice(0, 3).join("; ")}` });
  return hits;
}
