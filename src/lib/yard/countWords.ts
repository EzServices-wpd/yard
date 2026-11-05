/**
 * Class F: count words and readCount, the count reader of the I41 checker and its notes (typedFeatures).
 */
export const NUM: Record<string, number> = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12 };
/** A size word after a number makes it a size ("36 wide shelves"), never a count. */
const SIZE_WORD = "(?!(?:wide|tall|deep|high|long|inch|inches|in|ft|feet|foot|by|x)\\b)";
/** A negated feature that names hardware for it ("no drawer slides") is not a count of zero. */
const NOT_HARDWARE = "(?!\\s+(?:slides?|pulls?|knobs?|fronts?|hardware|locks?|hinges?|stops?|runners?|pins?|brackets?|supports?))";

export type Count = { n: number; words: string; at: number };

/**
 * Class F (rows 736, 739): the count typed before `noun` (a regex source).
 * - digits or zero to twelve, with one optional non-size word between ("3 open shelves", "twelve shelves", "0 shelves");
 * - "no / without / w/o [a | any] [one word] noun" is 0 ("no open shelves"), but not hardware ("no drawer slides").
 * "a holder for 6 rods" counts what it holds, not its parts.
 */
export function readCount(text: string, noun: string): Count | null {
  const lower = text.toLowerCase();
  const num = lower.match(new RegExp(`(?<![\\d/.x×-])(?<!\\d\\s)(?<!\\b(?:for|holds?|holding|fits?)\\s)\\b(\\d+|${Object.keys(NUM).join("|")})[\\s-]+(?:${SIZE_WORD}[a-z]+\\s+)?(?:${noun})`));
  if (num) return { n: /\d/.test(num[1]) ? parseInt(num[1], 10) : NUM[num[1]], words: num[0], at: num.index ?? 0 };
  const no = lower.match(new RegExp(`\\b(?:no|without|w/o)\\s+(?:(?:a|any)\\s+)?(?:[a-z]+\\s+)?(?:${noun})${NOT_HARDWARE}`));
  if (no) return { n: 0, words: no[0].replace(/^(?:without|w\/o)\s+(?:(?:a|any)\s+)?/, "no "), at: no.index ?? 0 };
  return null;
}
