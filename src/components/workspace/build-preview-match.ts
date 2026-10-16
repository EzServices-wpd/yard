/**
 * Which Building-overlay preview fits a prompt. Only whole type words count (word boundaries), and
 * anything uncertain (birdhouse, step ladder, guitar case, tv stand, plant stand) gets null, which
 * the overlay draws as a neutral frame instead of stand-in furniture.
 */
export const PREVIEW_TYPES: { id: string; re: RegExp }[] = [
  { id: "coop", re: /\b(?:chicken coop|coop|hen ?house|rabbit hutch|hutch)\b/ },
  { id: "linen", re: /\b(?:linen closet|closet|cabinet|pantry|wardrobe|armoire|cupboard)\b/ },
  { id: "desk", re: /\b(?:desk|vanity|dresser|nightstand)\b/ },
  { id: "table", re: /\b(?:dining table|coffee table|side table|end table|kitchen table|table|kitchen island)\b/ },
  { id: "bench", re: /\b(?:entry bench|mudroom bench|bench)\b/ },
  { id: "bookcase", re: /\b(?:bookcase|bookshelf|bookshelves|book shelf|shelving unit|shelves|shelf)\b/ },
];

/** Words that make a match uncertain: the noun is something else that only sounds like a type. */
const NOT_A_TYPE = /\b(?:bird ?house|ladder|guitar|tv stand|plant stand|stand)\b/;

export function previewIdFor(prompt?: string): string | null {
  const p = (prompt ?? "").toLowerCase();
  if (!p.trim() || NOT_A_TYPE.test(p)) return null;
  return PREVIEW_TYPES.find((t) => t.re.test(p))?.id ?? null;
}
