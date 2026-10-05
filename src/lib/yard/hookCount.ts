/**
 * One hook count for the whole plan: the count the person typed ("five hooks", "5 pegs"),
 * else one hook every 6" of rail. Steps and Buy both read this.
 */
const WORDS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12 };

export function typedHookCount(text: string, pegs = false): number | null {
  const hay = text.toLowerCase();
  const noun = pegs ? "(?:hooks?|pegs?)" : "hooks?";
  const digits = hay.match(new RegExp(`(\\d+)\\s*${noun}\\b`));
  if (digits) return Math.max(2, Math.min(12, parseInt(digits[1], 10)));
  const word = hay.match(new RegExp(`\\b(${Object.keys(WORDS).join("|")})\\s+(?:coat\\s+)?${noun}\\b`));
  if (word) return Math.max(2, Math.min(12, WORDS[word[1]]));
  return null;
}

export function hookCount(opts: { prompt?: string; name?: string; railWidth: number; pegs?: boolean }): number {
  return (
    // "4 pegs" and "4 hooks" both name what hangs the coats.
    typedHookCount(opts.prompt ?? "", true) ??
    typedHookCount(opts.name ?? "", true) ??
    Math.max(3, Math.min(8, Math.round(opts.railWidth / 6)))
  );
}

/** Screws that hold each hook to the rail. */
export const SCREWS_PER_HOOK = 2;
