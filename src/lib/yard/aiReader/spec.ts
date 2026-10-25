/**
 * AI prompt reader (I49): a cheap xAI model reads ONLY the measurements and counts the regex path might misread.
 * The deterministic engine still makes every part, cut, Buy row and step; the reader never names a part.
 * Every field quotes the person's words verbatim (validate.ts); anything assumed is thrown away.
 */
export const AXES = ["W", "D", "H", "L", "DIAM", "unknown"] as const;
export const UNITS = ["in", "ft", "ft-in", "cm", "mm", "none"] as const;
export const OF = ["overall", "part", "product"] as const;
export const COUNT_THINGS = ["drawers", "doors", "shelves", "rods", "steps", "bins", "legs", "seats", "tiers", "bays", "cubbies", "hooks", "pieces", "other"] as const;

type Field = { quote: string; confidence: number; assumed: boolean };
/** `value` is the number in its own unit ("6" for "6 ft"); `inches` the conversion. `of`: the build's own box, a part, or a bought item. */
export type ReaderSize = Field & { axis: (typeof AXES)[number]; value: number; unit: (typeof UNITS)[number]; inches: number; of: (typeof OF)[number] };
export type ReaderCount = Field & { thing: (typeof COUNT_THINGS)[number]; n: number };
export type ReaderSpec = { sizes: ReaderSize[]; counts: ReaderCount[] };

const conf = { type: "number", minimum: 0, maximum: 1 };
const field = { quote: { type: "string" }, confidence: conf, assumed: { type: "boolean" } };
const obj = (properties: Record<string, unknown>) => ({ type: "object", additionalProperties: false, required: Object.keys(properties), properties });
const str = (e: readonly string[]) => ({ type: "string", enum: [...e] });
export const READER_SCHEMA = {
  name: "yard_reader_spec",
  strict: true,
  schema: obj({
    sizes: { type: "array", maxItems: 8, items: obj({ axis: str(AXES), value: { type: "number" }, unit: str(UNITS), inches: { type: "number" }, of: str(OF), ...field }) },
    counts: { type: "array", maxItems: 8, items: obj({ thing: str(COUNT_THINGS), n: { type: "integer", minimum: 0 }, ...field }) },
  }),
} as const;

/** Stable text first so xAI's prefix cache can serve it. */
export const READER_SYSTEM = `You are Yard's prompt reader. Yard turns one typed build request into a 3D model, cut list, Buy list and steps. You read the measurements and counts in ONE request and return ONE JSON object matching the schema. You never design.
Rules
1. Read only what the person typed. Never add a size or count that is not in the text.
2. Every entry carries "quote": the exact words copied from the request (a verbatim substring). If you cannot quote it, leave it out.
3. "assumed": false for anything read from the words. Never invent a size or count.
4. "confidence": 0..1 (1 = unambiguous, like "30 wide").
5. sizes: one entry per typed measurement.
   - axis: W (wide/width, or "long" on tables, benches, shelves and boxes), D (deep), H (tall/high), L (length of a long thing), DIAM, or "unknown".
   - Triples "30x18x72" / "30 by 18 by 72": W, D, H in typed order unless words name the axes. Pairs "60 by 80": W then D for beds, tables, boxes; W then H for upright storage, frames and windows.
   - unit: in, ft, ft-in (6'2"), cm, mm, or none (bare number). inches: converted (ft x12, cm /2.54, mm /25.4); mixed fractions are exact ("24 1/2" = 24.5).
   - of: "overall" for the build's own box; "part" for a part ("24 inch knee space"); "product" for a bought item or the thing it holds ("36 by 48 window", "for a 65 inch TV"). Ages are never sizes.
6. counts: only when a number (digit, number word, "pair" = 2, "two-step" = 2 steps, "3-drawer" = 3 drawers) is typed for that thing.
Output JSON only.`;
