import type { YardProject } from "./types";

/**
 * Words that never name the object: a size, a place, a style, a stock, a count. "over"/"under" set a bunk's layout
 * (twin over full), never the object. (Moved from promptMain so the routing gate reads the same list.)
 */
export const FORM_NEUTRAL = /^(?:over|under|small|big|large|tall|short|wide|deep|long|mini|tiny|giant|toy|toys|model|miniature|scale|simple|basic|easy|modern|rustic|farmhouse|shaker|classic|plain|kids?|child|children|toddler|baby|twin|full|queen|king|double|single|wall|corner|floating|pocket|outdoor|indoor|garden|backyard|patio|porch|kitchen|bathroom|bedroom|garage|office|living|entry|entryway|hall|hallway|mudroom|laundry|room|cedar|pine|oak|maple|walnut|plywood|lumber|wood|wooden|scrap|pallet|popsicle|sticks?|dowels?|straws?|toothpicks?|cardboard|pvc|pipe|balsa|skewers?|inch|inches|feet|foot|high|top|open|fronts?|doors?|drawers?|shelves|shelf|one|two|three|four|five|six|white|black|red|blue|green|the|and)$/;

/** The fitted storage fallback's bare carcase parts: uprights or sides, a back, a top or a front, a bottom. */
const GENERIC_BOX_PART = /^(?:(?:left|right)\s+(?:upright|side)|back|top|front|bottom)$/i;
/** The only object words a bare storage carcase answers to. */
const GENERIC_BOX_WORD = /^(?:storage|unit|units|box|boxes|carcase|carcass)$/;

/**
 * The generic fallback body (Critic 10-17, after #71): a storage-program carcase made only of the bare box parts, with no
 * shelves, doors, lid, dividers or hardware. Whatever title it carries ("Planter box", "Boot Tray", "Storage unit"), it
 * is the same box the engine builds for a noun it does not know.
 */
export function genericFallbackBox(p: YardProject): boolean {
  return p.kind === "closet" && p.fitted?.program === "storage" && !(p.instances ?? []).length && p.panels.length > 0 &&
    p.panels.every((x) => GENERIC_BOX_PART.test(x.name ?? ""));
}

/** The typed object words before any "with/for/from …" tail: numbers, stock sizes, places and styles dropped. */
function objectWords(prompt: string): string[] {
  const phrase = prompt.toLowerCase().replace(/^[a-z]+:\s*/, "").split(/\s+(?:with|for|from|of|out|in|that|to|made|using|on|at|by)\s+/)[0];
  return phrase.split(/[\s-]+/).filter((t) => !/\d/.test(t)).flatMap((t) => t.split(/[^a-z]+/))
    .filter((w) => w.length >= 3 && !FORM_NEUTRAL.test(w));
}

/** A title without its sizes, lowercased: 'Cedar Planter box 36" × 30" × 16"' → "cedar planter box". */
const stem = (t?: string) => (t ?? "").replace(/\s+\d.*$/, "").trim().toLowerCase();
/** A typed ask for something hung on a wall. */
const WALL_ASK = /\b(?:wall|mounted|hanging|hung)\b/;

/**
 * A build only wins over the learner when it is the asked-for form (Critic 10-17, after #71). On the generic fallback box:
 * - Under the fallback's default title (Storage unit) or a title that only repeats the prompt over another stem
 *   ("Boot Tray" over a Planter box), it is the asked form only for a plain storage ask ("storage unit", "cedar box");
 *   any other typed object word (boot tray, under-stairs) gets the learner.
 * - Under a dedicated stem the parser chose for the typed noun (Planter box for a planter or a raised bed), it owns the
 *   noun, but not a wall-hung ask: a bare box with nothing to hang it by (wall planter, wall mounted planter).
 */
export function genericBoxOverAsk(prompt: string, p: YardProject): boolean {
  if (!genericFallbackBox(p)) return false;
  const title = stem(p.name);
  const own = stem(p.fitted?.name) || title;
  if (title !== own || /\bstorage unit\b/.test(own)) return objectWords(prompt).some((w) => !GENERIC_BOX_WORD.test(w));
  // The bare box has no cleat, hanger or rail, so it cannot be a wall-hung form, whatever its install note says.
  return WALL_ASK.test(prompt.toLowerCase());
}
