/** Class F: count words, read the same way by the I41 checker (typedFeatures) and by compose's part-or-product split. */
export const NUM: Record<string, number> = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12 };
/** A count: digits, a number word, or "no" (zero). */
export const COUNT_WORD = `\\d+|no|${Object.keys(NUM).join("|")}`;
